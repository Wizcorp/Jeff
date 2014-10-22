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
var processSwf  = require('./SwfObjectProcessor/index.js');
var CanvasRenderer; //delayed require to allow unit testing without Canvas

// For non-ascii characters in SWF identifiers
var JSON_WRITE_OPTIONS = { encoding:'binary' };

// TODOs

/*  Non-exhaustive list of unsupported features:
	- Scaling Grid
	- DoAbc
	- ActionScript
	- Texts
	- Buttons
*/

/* Optimisation options:
	- option to compress json files
	- option to compress images without quality loss
	- export vectorial drawings
	- export keyframe based meta-data
*/

function Jeff() {
	if (!CanvasRenderer) {
		CanvasRenderer = require('./CanvasRenderer/index.js');
	}
	this._parser        = new SwfParser();
	this._renderer      = new CanvasRenderer();
	this._exportPending = false;

	// Parameters applying to the file group being processed
	this._fileGroupName          = undefined; // Name
	this._fileGroupRatio         = undefined; // Export ratio
	this._swfObjectsPerFileGroup = undefined; // Array holding swf objects per file
	this._swfObjects             = undefined; // Merged swf objects
	this._symbols                = undefined; // Symbols corresponding to the swfObjects

	// Parameters applying to the class group being processed
	this._classGroupName         = undefined; // Name
	this._classGroupList         = undefined; // Classes
	this._hierarchy              = undefined; // Hierarchy of the symbols
}

module.exports = Jeff;

// Jeff's only public method/attribute
Jeff.prototype.extractSwf = function (exportParams, cb) {
	if (this._exportPending) {
		return cb('Jeff already exporting ' + this._source);
	}

	var self = this;
	this._init(exportParams, function (swfUris) {
		self._extractFileGroups(swfUris, cb);
	});
};

Jeff.prototype._init = function (params, cb) {

	// Primary options
	this._inputDir          = params.inputDir          || './';
	this._outDir            = params.outDir            || './';
	this._source            = params.source            || '.*\\.swf';

	// Secondary options
	this._scope             = params.scope             || 'main';
	this._renderFrames      = params.renderFrames      || params.firstFrameOnly;
	this._ratio             = params.ratio             || 1;

	// Optimisation options
	this._imageQuality      = params.imageQuality      || 100;
	this._createAtlas       = params.createAtlas       || false;
	this._powerOf2Images    = params.powerOf2Images    || false;
	this._maxImageDim       = params.maxImageDim       || 2048;
	this._simplify          = params.simplify          || false;
	this._beautify          = params.beautify          || false;
	this._flatten           = params.flatten           || false;
	this._compressMatrices  = params.compressMatrices  || false;

	// Advanced options
	this._exportAtRoot      = params.exportAtRoot      || false;
	this._firstFrameOnly    = params.firstFrameOnly    || false;
	this._splitClasses      = params.splitClasses      || false;
	this._ignoreImages      = params.ignoreImages      || false;
	this._ignoreData        = params.ignoreData        || false;
	this._outlineEmphasis   = params.outlineEmphasis   || 1;

	// Advanced++ options (aka Legacy options)
	this._defaultGroupRatio = params.defaultGroupRatio || 1;
	this._classGroups       = params.classGroups       || {};
	this._fileGroups        = params.fileGroups        || {};
	this._fileGroupRatios   = params.fileGroupRatios   || {};
	this._classRatios       = params.classRatios;
	this._container         = params.container;
	this._ignoreExpression  = params.ignoreExpression;
	this._ignoreList        = params.ignoreList;
	this._removeList        = params.removeList;
	this._exclusiveList     = params.exclusiveList;
	this._postProcess       = params.postProcess;
	this._customWriteFile   = params.customWriteFile;
	this._fixedSize         = params.fixedSize;

	if (!fs.existsSync(this._inputDir)) {
		throw new Error('Directory not found: ' + this._inputDir);
		return;
	}

	if (!fs.existsSync(this._outDir)) {
		fs.mkdirsSync(this._outDir);
	}

	if (this._source instanceof Array) {
		cb(this._source);
	} else {
		helper.getFileURIs(this._inputDir, this._source, cb);
	}

	this._exportPending = true;
};

Jeff.prototype._extractFileGroups = function (swfUris, endExtractionCb) {
	var nbFiles  = 0;
	var nbErrors = 0;

	var filesPerGroup = helper.makeFileGroups(swfUris, this._fileGroups);
	console.log('Starting conversion of', swfUris.length, 'file(s) corresponding to', this._source);

	var self = this;
	async.eachSeries(filesPerGroup,
		function (group, next) {
			/// Logging number of processed files
			if ((nbFiles % Math.floor(swfUris.length / 10)) === 0) {
				console.log((nbFiles * 100 / swfUris.length).toFixed(0) + '% of', swfUris.length, ' files done...');
			}
			nbFiles += group.input.length;
			self._parseFileGroup(group, next);
		},
		function (error) {
			self._exportPending = false;
			if (error) {
				if (endExtractionCb) {
					return endExtractionCb(error);
				} else {
					throw new Error('Extraction failed', error);
				}
			}

			console.log('Converted ' + nbFiles + ' swf/swl files out of ' + swfUris.length + '. Failures: ' + nbErrors);
			if (endExtractionCb) endExtractionCb(null, { files: nbFiles, errors: nbErrors });
		}
	);
};

Jeff.prototype._parseFileGroup = function (group, nextGroupCb) {
	var swfObjectsPerGroup  = [];
	this._swfObjectsPerGroup = swfObjectsPerGroup;
	this._fileGroupName  = group.output;
	this._fileGroupRatio = this._ratio * (this._fileGroupRatios[this._fileGroupName] || this._defaultGroupRatio);

	var self = this;
	async.eachSeries(group.input,
		function (swfName, next) {
			self._parseFile(swfName, next);
		},
		function (error) {
			if (error) return nextGroupCb(error);
			self._processFileGroup(nextGroupCb);
		}
	);
};

Jeff.prototype._parseFile = function (swfName, nextSwfCb) {
	var swfObjects = [];
	var self = this;

	// this._assetLoader.getAsset(swfName,
	fs.readFile(this._inputDir + '/' + swfName,
		function (error, swfData) {
			if (error) return nextSwfCb(error);
			self._parser.parse(swfName, swfData,
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
					self._swfObjectsPerGroup.push(swfObjects);
					nextSwfCb(error);
				}
			);
		}
	);
};

Jeff.prototype._processFileGroup = function (nextGroupCb) {
	var exportMain = (this._scope === 'main');

	// Merging symbols in swfObjectsPerGroup with respect to their priorities (the lower the index the higher the priority)
	var swfObjects = helper.groupSwfObjects(this._swfObjectsPerGroup);
	var allClasses = helper.getClasses(swfObjects, exportMain);
	var symbols    = processSwf(swfObjects, allClasses, this);

	// Generating a list of classes to export with respect to options
	var classList;
	if (exportMain) {
		classList = helper.getMains(swfObjects);
	} else {
		classList = helper.filterClasses(allClasses, this._exclusiveList, this._ignoreList, this._ignoreExpression);
	}

	// Making separation of the symbols with respect to the classGroups and splitClasses options
	var classGroups = helper.groupClasses(classList, this._classGroups, this._splitClasses);

	this._swfObjects = swfObjects;
	this._symbols    = symbols;

	var self = this;
	async.eachSeries(classGroups,
		function (classGroup, nextClassListCb) {
			self._classGroupName = classGroup.name;
			self._classGroupList = classGroup.list;
			self._symbolList = helper.generateExportList(self._symbols, self._classGroupList);
			self._renderer.renderSymbols(self,
				function (imageList, graphicProperties) {
					self._extractClassGroup(imageList, graphicProperties, nextClassListCb);
				}
			);
		},
		nextGroupCb
	);
};

Jeff.prototype._generateImageName = function (imgName) {
	var imgPath = this._fileGroupName;

	if (this._scope === 'classes') {
		imgPath = path.join(imgPath, this._classGroupName);
	}

	if (!this._createAtlas && (!this._firstFrameOnly || Object.keys(this._classGroupList).length > 1)) {
		imgPath = path.join(imgPath, imgName);
	}

	if (this._exportAtRoot) {
		imgPath = path.basename(imgPath);
	}
	
	return path.join(this._outDir, imgPath + '.png');
};

Jeff.prototype._generateJsonFileName = function () {
	var jsonPath = path.join(this._outDir, this._fileGroupName);

	if (this._scope === 'classes') {
		jsonPath = path.join(jsonPath, this._classGroupName);
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

Jeff.prototype._canvasToPng = function (pngName, canvas) {
	if (canvas.width === 0 || canvas.height === 0) {
		return;
	}

	var url = canvas.toDataURL();
	var header = 'data:image/png;base64,';
	var len = header.length;
	var png = new Buffer(url.substr(len), 'base64');

	if (this._imageQuality < 100) {
		png = pngquant.compress(png, { quality: [this._imageQuality, 100] });
	}

	if (!this._customWriteFile || !this._customWriteFile(pngName, png)) {
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

Jeff.prototype._dataToJson = function (jsonName, data) {
	var jsonData = JSON.stringify(data, rounding);

	if (this._beautify) {
		jsonData = beautify(jsonData, { indent_size: 4 });
	}

	if (!this._customWriteFile || !this._customWriteFile(jsonName, jsonData, JSON_WRITE_OPTIONS)) {
		writeFile(jsonName, jsonData, JSON_WRITE_OPTIONS);
	}
};

Jeff.prototype._extractClassGroup = function (imageList, graphicProperties, nextClassListCb) {
	if (!this._ignoreImages) {
		for (var i = 0, nImages = imageList.length; i < nImages; i += 1) {
			var imgName = this._generateImageName(imageList[i].name);
			this._canvasToPng(imgName, imageList[i].img);
		}
	}

	var dataToExport;
	if (this._renderFrames) {
		dataToExport = helper.generateFrameByFrameData(this._symbols, this._symbolList, graphicProperties, this._firstFrameOnly);
	} else {
		dataToExport = helper.generateMetaData(this._symbols, this._symbolList, graphicProperties);

		// Applying post-process, if any
		if (this._postProcess) {
			if (this._postProcess instanceof Array) {
				var nProcesses = this._postProcess.length;
				for (var p = 0; p < nProcesses; p += 1) {
					this._postProcess[p](dataToExport, this._symbols);
				}
			} else {
				this._postProcess(dataToExport, this._symbols);
			}
		}

		if (this._flatten) {
			dataToExport = helper.flattenAnimations(dataToExport);
		}

		if (this._simplify) {
			dataToExport = helper.simplifyAnimation(dataToExport);
		}

		if (this._compressMatrices) {
			dataToExport = helper.delocateMatrices(dataToExport);
		}
	}

	if (!this._ignoreData) {
		var jsonFileName = this._generateJsonFileName();
		this._dataToJson(jsonFileName, dataToExport);
	}

	nextClassListCb();
};
