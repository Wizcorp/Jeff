/* jslint node: true */
/* jshint camelcase: false */ //for js_beautify and indent_size

'use strict';

var fs          = require('fs-extra');
var path        = require('path');
var async       = require('async');
var beautify    = require('js-beautify').js_beautify;
var pngquant    = require('node-pngquant-native');
var helper      = require('./Helper/index.js');
var SwfParser   = require('./Gordon/parser.js');
var AssetLoader = require('./AssetLoader.js');
var processSwf  = require('./SwfObjectProcessor/index.js');
var CanvasRenderer; //delayed require to allow unit testing without Canvas

// For non-ascii characters in SWF identifiers
var JSON_WRITE_OPTIONS = { encoding:'binary' };

/*  Non-exhaustive list of unsupported features
	- Scaling Grid
	- DoAbc
	- ActionScript
	- Texts
	- Buttons
*/

function Jeff() {
	if (!CanvasRenderer) {
		CanvasRenderer = require('./CanvasRenderer/index.js');
	}
	this.parser        = new SwfParser();
	this.assetLoader   = new AssetLoader();
	this.renderer      = new CanvasRenderer();
	this.exportPending = false;

	// Parameters applying to the file group being processed
	this.fileGroupName          = undefined; // Name
	this.fileGroupRatio         = undefined; // Export ratio
	this.swfObjectsPerFileGroup = undefined; // Array holding swf objects per file
	this.swfObjects             = undefined; // Merged swf objects
	this.symbols                = undefined; // Symbols corresponding to the swfObjects

	// Parameters applying to the class group being processed
	this.classGroupName         = undefined; // Name
	this.classGroupList         = undefined; // Classes
	this.hierarchy              = undefined; // Hierarchy of the symbols
}

module.exports = Jeff;

Jeff.prototype.extractSwf = function (exportParams, cb) {
	if (this.exportPending) {
		return cb('Jeff already exporting ' + this.srcPattern);
	}

	var self = this;
	this.initialize(exportParams, function () {
		self.extractMore(cb);
	});
};

Jeff.prototype.initialize = function (params, cb) {

	this.inputDir          = params.inputDir          || './';
	this.outDir            = params.outDir            || './';
	this.srcPattern        = params.srcPattern        || '*.swf';
	this.scope             = params.scope             || 'main';
	this.exportAtRoot      = params.exportAtRoot      || false;
	this.ignoreData        = params.ignoreData        || false;
	this.ignoreImages      = params.ignoreImages      || false;
	this.firstFrameOnly    = params.firstFrameOnly    || false;
	this.renderFrames      = params.renderFrames      || this.firstFrameOnly;
	this.createAtlas       = params.createAtlas       || false;
	this.powerOf2Images    = params.powerOf2Images    || false;
	this.splitClasses      = params.splitClasses      || false;
	this.beautify          = params.beautify          || false;
	this.simplify          = params.simplify          || false;
	this.ratio             = params.ratio             || 1;
	this.defaultGroupRatio = params.defaultGroupRatio || 1;
	this.outlineEmphasis   = params.outlineEmphasis   || 1;
	this.imageQuality      = params.imageQuality      || 100;
	this.maxImageDim       = params.maxImageDim       || 2048;
	this.classGroups       = params.classGroups       || {};
	this.fileGroups        = params.fileGroups        || {};
	this.fileGroupRatios   = params.fileGroupRatios   || {};
	this.classRatios       = params.classRatios;
	this.container         = params.container;
	this.ignoreExpression  = params.ignoreExpression;
	this.ignoreList        = params.ignoreList;
	this.removeList        = params.removeList;
	this.exclusiveList     = params.exclusiveList;
	this.postProcess       = params.postProcess;
	this.customWriteFile   = params.customWriteFile;
	this.fixedSize         = params.fixedSize;

	// TODO: manage optimisation options
	// TODO: add json compression option
	this.delocateMatrices = true;
	this.flatten          = true;

	if (!fs.existsSync(this.inputDir)) {
		cb('Directory not found: ' + this.inputDir);
		return;
	}

	if (!fs.existsSync(this.outDir)) {
		fs.mkdirsSync(this.outDir);
	}

	this.assetLoader.initialize(this.inputDir, cb);
	this.exportPending = true;
};

Jeff.prototype.extractMore = function (endExtractionCb) {
	var nbFiles  = 0;
	var nbErrors = 0;

	var uris = this.assetLoader.find(this.srcPattern);
	var filesPerGroup = helper.makeFileGroups(uris, this.fileGroups);
	console.log('Starting conversion of', uris.length, 'file(s) corresponding to', this.srcPattern);

	var self = this;
	async.eachSeries(filesPerGroup,
		function (group, next) {
			/// Logging number of processed files
			if ((nbFiles % Math.floor(uris.length / 10)) === 0) {
				console.log((nbFiles * 100 / uris.length).toFixed(0) + '% of', uris.length, ' files done...');
			}
			nbFiles += group.input.length;
			self.extractGroup(group, next);
		},
		function (error) {
			self.exportPending = false;
			if (error) return endExtractionCb(error);
			console.log('Converted ' + nbFiles + ' swf/swl files out of ' + uris.length + '. Failures: ' + nbErrors);
			endExtractionCb(null, { files: nbFiles, errors: nbErrors });
		}
	);
};

Jeff.prototype.extractGroup = function (group, nextGroupCb) {
	var swfObjectsPerGroup  = [];
	this.swfObjectsPerGroup = swfObjectsPerGroup;
	this.fileGroupName  = group.output;
	this.fileGroupRatio = this.ratio * (this.fileGroupRatios[this.fileGroupName] || this.defaultGroupRatio);

	var self = this;
	async.eachSeries(group.input,
		function (swfName, next) {
			self.parseFile(swfName, next);
		},
		function (error) {
			if (error) return nextGroupCb(error);
			self.extractFileGroup(nextGroupCb);
		}
	);
};

Jeff.prototype.parseFile = function (swfName, nextSwfCb) {
	var swfObjects = [];
	var self = this;
	this.assetLoader.getAsset(swfName,
		function (error, swfData) {
			if (error) return nextSwfCb(error);
			self.parser.parse(swfName, swfData,
				function (swfObject) {
					var id = swfObject.id;
					if (id === undefined) {

						// TODO: handle header
						if (swfObject.type === 'header') {
							return;
						}

						// TODO: handle DoAbc
						if (swfObject.type === 'DoAbc') {
							return;
						}

						console.log('Jeff.parseFile: swfObject not handled, ', swfObject);
						return;
					}

					swfObjects[id] = swfObject;
				},
				function (error) {
					self.swfObjectsPerGroup.push(swfObjects);
					nextSwfCb(error);
				}
			);
		}
	);
};

Jeff.prototype.extractFileGroup = function (nextGroupCb) {
	var exportMain = (this.scope === 'main');

	// Regrouping symbols in swfObjectsPerGroup by merging them
	// with respect to their priorities (the lower the index the higher the priority)
	var swfObjects = helper.groupSwfObjects(this.swfObjectsPerGroup);
	var allClasses = helper.getClasses(swfObjects, exportMain);
	var symbols    = processSwf(swfObjects, allClasses, this);

	// Generating a list of classes to export with respect to options
	var classList;
	if (exportMain) {
		classList = helper.getMains(swfObjects)
	} else {
		classList = helper.filterClasses(allClasses, this.exclusiveList, this.ignoreList, this.ignoreExpression);
	}

	// Making separation of the symbols with respect to the splitClasses options
	var classGroups = helper.groupClasses(classList, this.classGroups, this.splitClasses);

	this.swfObjects = swfObjects;
	this.symbols    = symbols;

	var self = this;
	async.eachSeries(classGroups,
		function (classGroup, nextClassListCb) {
			self.classGroupName = classGroup.name;
			self.classGroupList = classGroup.list;
			self.symbolList = helper.generateExportList(self.symbols, self.classGroupList);
			self.renderer.renderSymbols(self,
				function (imageList, graphicProperties) {
					self.extractClassGroup(imageList, graphicProperties, nextClassListCb);
				}
			);
		},
		nextGroupCb
	);
};

Jeff.prototype.generateImageName = function (imgName) {
	var imgPath = this.fileGroupName;

	if (this.scope === 'classes') {
		imgPath = path.join(imgPath, this.classGroupName);
	}

	if (!this.createAtlas && (!this.firstFrameOnly || Object.keys(this.classGroupList).length > 1)) {
		imgPath = path.join(imgPath, imgName);
	}

	if (this.exportAtRoot) {
		imgPath = path.basename(imgPath);
	}
	
	return path.join(this.outDir, imgPath + '.png');
};

Jeff.prototype.generateJsonFileName = function () {
	var jsonPath = path.join(this.outDir, this.fileGroupName);

	if (this.scope === 'classes') {
		jsonPath = path.join(jsonPath, this.classGroupName);
	}

	return jsonPath + '.json';
};

function writeFile(outputFileName, data, options) {
	var subDir = outputFileName.substr(0, outputFileName.lastIndexOf('/'));
	if (!fs.existsSync(subDir)) {
		fs.mkdirsSync(subDir);
	}

	fs.writeFileSync(outputFileName, data, options);
}

Jeff.prototype.canvasToPng = function (pngName, canvas) {
	if (canvas.width === 0 || canvas.height === 0) {
		return;
	}

	var url = canvas.toDataURL();
	var header = 'data:image/png;base64,';
	var len = header.length;
	var png = new Buffer(url.substr(len), 'base64');

	if (this.imageQuality < 100) {
		png = pngquant.compress(png, { quality: [this.imageQuality, 100] });
	}

	if (!this.customWriteFile || !this.customWriteFile(pngName, png)) {
		writeFile(pngName, png);
	}
};

function rounding(key, val) {
	if (typeof val === 'number') {
		if (val === 0) return 0;
		var powerOf10 = 1 + Math.max(Math.ceil(Math.log(Math.abs(val)) / Math.LN10), 2);
		var roundCoef = Math.pow(10, powerOf10);
		return Math.round(val * roundCoef) / roundCoef;
	}
	return val;
}

Jeff.prototype.dataToJson = function (jsonName, data) {
	var jsonData = JSON.stringify(data, rounding);

	if (this.beautify) {
		jsonData = beautify(jsonData, { indent_size: 4 });
	}

	if (!this.customWriteFile || !this.customWriteFile(jsonName, jsonData, JSON_WRITE_OPTIONS)) {
		writeFile(jsonName, jsonData, JSON_WRITE_OPTIONS);
	}
};

Jeff.prototype.extractClassGroup = function (imageList, graphicProperties, nextClassListCb) {
	if (!this.ignoreImages) {
		for (var i = 0, nImages = imageList.length; i < nImages; i += 1) {
			var imgName = this.generateImageName(imageList[i].name);
			this.canvasToPng(imgName, imageList[i].img);
		}
	}

	var dataToExport;
	if (this.renderFrames) {
		dataToExport = helper.generateFrameByFrameData(this.symbols, this.symbolList, graphicProperties, this.firstFrameOnly);
	} else {
		dataToExport = helper.generateMetaData(this.symbols, this.symbolList, graphicProperties);

		// Applying post-process, if any
		if (this.postProcess) {
			if (this.postProcess instanceof Array) {
				var nProcesses = this.postProcess.length;
				for (var p = 0; p < nProcesses; p += 1) {
					this.postProcess[p](dataToExport, this.symbols);
				}
			} else {
				this.postProcess(dataToExport, this.symbols);
			}
		}

		if (this.flatten) {
			dataToExport = helper.flattenAnimations(dataToExport);
		}

		if (this.simplify) {
			dataToExport = helper.simplifyAnimation(dataToExport);
		}

		if (this.delocateMatrices) {
			dataToExport = helper.delocateMatrices(dataToExport);
		}
	}

	if (!this.ignoreData) {
		var jsonFileName = this.generateJsonFileName();
		this.dataToJson(jsonFileName, dataToExport);
	}

	nextClassListCb();
};
