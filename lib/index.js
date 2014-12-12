/* jshint camelcase: false */ //for js_beautify and indent_size
'use strict';

var fs       = require('fs-extra');
var glob     = require('glob');
var path     = require('path');
var async    = require('async');
var beautify = require('js-beautify').js_beautify;
var pngquant = require('node-pngquant-native');
var imgOptim = require('image-optim');

var helper         = require('./Helper/index.js');
var SwfParser      = require('./Gordon/parser.js');
var processSwf     = require('./SwfObjectProcessor/index.js');
var CanvasRenderer = require('./CanvasRenderer/index.js');

// For non-ascii characters in SWF class names
var JSON_WRITE_OPTIONS = { encoding:'binary' };

// Jeff's only API method
function extractSwf(exportParams, cb) {
	var jeff = new Jeff();

	// Setting up Jeff ...
	jeff._init(exportParams, function (swfUris) {
		// ... for extractiong
		jeff._extractFileGroups(swfUris, cb);
	});
};
module.exports = extractSwf;

function Jeff() {
	this._parser   = new SwfParser();      // Parser of swf files
	this._renderer = new CanvasRenderer(); // Renderer for swf images and vectorial shapes

	// Extraction options
	this._options = null;

	// Parameters applying to the file group being processed
	this._fileGroupName          = undefined; // Name
	this._fileGroupRatio         = undefined; // Export ratio
	this._swfObjectsPerFileGroup = undefined; // Array holding swf objects per file
	this._swfObjects             = undefined; // Merged swf objects
	this._symbolList             = undefined; // List of symbols to extract
	this._symbols                = undefined; // Symbols corresponding to the swfObjects

	// Parameters applying to the class group being processed
	this._classGroupName         = undefined; // Name
	this._classGroupList         = undefined; // Classes
	this._hierarchy              = undefined; // Hierarchy of the symbols

}

function JeffOptions(params) {
	// Primary options
	this.inputDir          = params.inputDir          || '.';
	this.outDir            = params.outDir            || '.';
	this.source            = params.source            || '*.swf';

	// Secondary options
	this.scope             = params.scope             || 'main';
	this.renderFrames      = params.renderFrames      || false;
	this.ratio             = params.ratio             || 1;

	// Optimisation options
	this.imageOptim        = params.imageOptim        || false;
	this.imageQuality      = params.imageQuality      || 100;
	this.createAtlas       = params.createAtlas       || false;
	this.powerOf2Images    = params.powerOf2Images    || false;
	this.maxImageDim       = params.maxImageDim       || 2048;
	this.simplify          = params.simplify          || false;
	this.beautify          = params.beautify          || false;
	this.flatten           = params.flatten           || false;
	this.compressMatrices  = params.compressMatrices  || false;

	// Advanced options
	this.exportAtRoot      = params.exportAtRoot      || false;
	this.splitClasses      = params.splitClasses      || false;
	this.ignoreImages      = params.ignoreImages      || false;
	this.ignoreData        = params.ignoreData        || false;
	this.outlineEmphasis   = params.outlineEmphasis   || 1;

	// Advanced++ options (aka Legacy options)
	// Not usable as command line options
	this.defaultGroupRatio = params.defaultGroupRatio || 1;
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
	this.customReadFile    = params.customReadFile;
	this.fixedSize         = params.fixedSize;

	// Whether only one frame is being rendered
	// Boolean used for naming purpose
	this.onlyOneFrame      = (this.renderFrames instanceof Array) && (this.renderFrames.length === 1);

	// Checking for uncompatible options
	if (this.renderFrames && this.simplify) {
		this.simplify = false;
		// console.warn('[Jeff] Option to simplify will be ignored');
	}

	if (this.renderFrames && this.flatten) {
		this.flatten = false;
		// console.warn('[Jeff] Option to flatten will be ignored');
	}

	if (this.renderFrames && this.compressMatrices) {
		this.compressMatrices = false;
		// console.warn('[Jeff] Option to compress matrices will be ignored');
	}
}

Jeff.prototype._init = function (options, cb) {

	this._options = new JeffOptions(options);

	// Making sure the input directory exists
	if (!fs.existsSync(this._options.inputDir)) {
		throw new Error('Directory not found: ' + this._options.inputDir);
		return;
	}

	// Creating output directory if inexistant
	if (!fs.existsSync(this._options.outDir)) {
		fs.mkdirsSync(this._options.outDir);
	}

	// Starting extraction on source file(s)
	if (this._options.source instanceof Array) {
		cb(this._options.source);
	} else {
		glob(this._options.source, { cwd: this._options.inputDir }, function (error, uris) {
			cb(uris);
		})
	}
};

Jeff.prototype._extractFileGroups = function (swfUris, endExtractionCb) {
	var nbFiles  = 0;
	var nbErrors = 0;

	var filesPerGroup = helper.makeFileGroups(swfUris, this._options.fileGroups);
	console.log('Starting conversion of', swfUris.length, 'file(s)');

	var self = this;
	async.eachSeries(filesPerGroup,
		function (fileGroup, next) {
			// Logging number of processed files
			if ((nbFiles % Math.floor(swfUris.length / 10)) === 0) {
				console.log((nbFiles * 100 / swfUris.length).toFixed(0) + '% of', swfUris.length, ' files done...');
			}
			nbFiles += fileGroup.input.length;
			self._parseFileGroup(fileGroup, next);
		},
		function (error) {
			if (error) {
				if (endExtractionCb) {
					return endExtractionCb(error);
				} else {
					throw new Error('Error!', error);
				}
			}

			console.log('Jeff Converted ' + nbFiles + ' swf files out of ' + swfUris.length + '. Failures: ' + nbErrors);
			if (endExtractionCb) endExtractionCb(null, { files: nbFiles, errors: nbErrors });
		}
	);
};

Jeff.prototype._parseFileGroup = function (fileGroup, nextGroupCb) {
	this._swfObjectsPerFileGroup = [];
	this._fileGroupName          = fileGroup.output;
	this._fileGroupRatio         = this._options.ratio * (this._options.fileGroupRatios[this._fileGroupName] || this._options.defaultGroupRatio);
	var self = this;
	async.eachSeries(fileGroup.input,
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

	var self = this;
	var swfObjects = [];
	function onFileRead(error, swfData) {
		if (error) return nextSwfCb(error);
		self._parser.parse(swfName, swfData,
			function (swfObject) {
				var id = swfObject.id;
				// console.log('object', JSON.stringify(swfObject));
				// console.log('properties!!', swfObject.id);
				// for (var p in swfObject) {
				// 	console.log(p);
				// }
				if (id === undefined) {

					if (swfObject.type === 'scalingGrid') {
						swfObjects[swfObject.appliedTo].scalingGrid = swfObject.rect;
						return;
					}

					// TODO: handle labels
					if (swfObject.type === 'labels') {
						return;
					}

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
				self._swfObjectsPerFileGroup.push(swfObjects);
				nextSwfCb(error);
			}
		);
	}

	if (this._options.customReadFile) {
		this._options.customReadFile(swfName, onFileRead);
	} else {
		fs.readFile(path.join(this._options.inputDir, swfName), onFileRead);
	}
};

Jeff.prototype._processFileGroup = function (nextGroupCb) {
	var exportMain = (this._options.scope === 'main');

	// Merging symbols in swfObjectsPerGroup with respect to their priorities (the lower the index the higher the priority)
	var swfObjects = helper.groupSwfObjects(this._swfObjectsPerFileGroup);
	var allClasses = helper.getClasses(swfObjects, exportMain);
	var symbols    = processSwf(swfObjects, allClasses, this);

	// Generating a list of classes to export with respect to options
	var classList;
	if (exportMain) {
		classList = helper.getMains(swfObjects);
	} else {
		classList = helper.filterClasses(allClasses, this._options.exclusiveList, this._options.ignoreList, this._options.ignoreExpression);
	}

	// Making separation of the symbols with respect to the classGroups and splitClasses options
	var classGroups = helper.groupClasses(classList, this._options.classGroups, this._options.splitClasses);

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

	if (this._options.scope === 'classes') {
		imgPath = path.join(imgPath, this._classGroupName);
	}

	// TODO: find a more elegant way to deal with this case: may be add an option to remove any suffix?
	// Issue: we have image name resolution in 2 places
	// Also see CanvasRenderer.renderFrames (renderImages file) for canvasName resolution
	if (!this._options.createAtlas && (!this._options.onlyOneFrame || Object.keys(this._classGroupList).length > 1)) {
		// The image is not unique, its name would have to be more specific
		imgPath = path.join(imgPath, imgName);
	}

	if (this._options.exportAtRoot) {
		imgPath = path.basename(imgPath);
	}
	
	return path.join(this._options.outDir, imgPath + '.png');
};

Jeff.prototype._generateJsonFileName = function () {
	var jsonPath = this._fileGroupName;

	if (this._options.scope === 'classes') {
		jsonPath = path.join(jsonPath, this._classGroupName);
	}

	if (this._options.exportAtRoot) {
		jsonPath = path.basename(jsonPath);
	}

	return path.join(this._options.outDir, jsonPath + '.json');
};

function writeFile(outputFileName, data, options) {
	var subDir = path.dirname(outputFileName);
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

	if (this._options.imageQuality < 100) {
		png = pngquant.compress(png, { quality: [this._options.imageQuality, 100] });
	}

	if (!this._options.customWriteFile || !this._options.customWriteFile(pngName, png)) {
		writeFile(pngName, png);

		if (this._options.imageOptim) {
			imgOptim.optimize(pngName, function() {})
		}
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

	if (this._options.beautify) {
		jsonData = beautify(jsonData, { indent_size: 4 });
	}

	if (!this._options.customWriteFile || !this._options.customWriteFile(jsonName, jsonData, JSON_WRITE_OPTIONS)) {
		writeFile(jsonName, jsonData, JSON_WRITE_OPTIONS);
	}
};

Jeff.prototype._extractImages = function (imageList) {
	if (this._options.ignoreImages) {
		return;
	}

	var nbImages = imageList.length;
	for (var i = 0, nImages = nbImages; i < nImages; i += 1) {
		var imgName = this._generateImageName(imageList[i].name);
		this._canvasToPng(imgName, imageList[i].img);
	}
};

Jeff.prototype._extractData = function (graphicProperties) {
	var dataToExport;
	if (this._options.renderFrames) {
		dataToExport = helper.generateFrameByFrameData(this._symbols, this._symbolList, graphicProperties, this._firstFrameOnly);
	} else {
		dataToExport = helper.generateMetaData(this._symbols, this._symbolList, graphicProperties);
	}

	// Applying post-process, if any
	if (this._options.postProcess) {
		if (this._options.postProcess instanceof Array) {
			var nProcesses = this._options.postProcess.length;
			for (var p = 0; p < nProcesses; p += 1) {
				this._options.postProcess[p](dataToExport, this._symbols);
			}
		} else {
			this._options.postProcess(dataToExport, this._symbols);
		}
	}

	if (this._options.ignoreData) {
		return;
	}

	if (this._options.flatten)          { dataToExport = helper.flattenAnimations(dataToExport); }
	if (this._options.simplify)         { dataToExport = helper.simplifyAnimation(dataToExport); }
	if (this._options.compressMatrices) { dataToExport = helper.delocateMatrices(dataToExport); }

	var jsonFileName = this._generateJsonFileName();
	this._dataToJson(jsonFileName, dataToExport);
};

Jeff.prototype._extractClassGroup = function (imageList, graphicProperties, nextClassListCb) {
	this._extractImages(imageList);
	this._extractData(graphicProperties);

	nextClassListCb();
};
