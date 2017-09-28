/* jshint camelcase: false */ //for js_beautify and indent_size
'use strict';

var fs       = require('fs-extra');
var glob     = require('glob');
var path     = require('path');
var async    = require('async');
var beautify = require('js-beautify').js_beautify;
var pngquant = require('node-pngquant-native');
var imgOptim = require('image-optim');
var pjson    = require('../package.json');

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

	// Information about source files
	this._fileHeaderInfo         = undefined;

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
	this.inputDir            = params.inputDir            || '.';
	this.outDir              = params.outDir              || null;
	this.source              = params.source              || '*.swf';

	// Secondary options
	this.scope               = params.scope               || 'main';
	this.renderFrames        = params.renderFrames        || false;
	this.ratio               = params.ratio               || 1;

	// Optimisation options
	this.imageOptim          = params.imageOptim          || false;
	this.imageQuality        = params.imageQuality        || 100;
	this.createAtlas         = params.createAtlas         || false;
	this.powerOf2Images      = params.powerOf2Images      || false;
	this.maxImageDim         = params.maxImageDim         || 2048;
	this.simplify            = params.simplify            || false;
	this.beautify            = params.beautify            || false;
	this.flatten             = params.flatten             || false;
	this.compressMatrices    = params.compressMatrices    || false;

	// Advanced options
	this.exportAtRoot        = params.exportAtRoot        || false;
	this.splitClasses        = params.splitClasses        || false;
	this.ignoreImages        = params.ignoreImages        || false;
	this.ignoreData          = params.ignoreData          || false;
	this.minificationFilter  = params.minificationFilter  || 'linear';
	this.magnificationFilter = params.magnificationFilter || 'linear';
	this.outlineEmphasis     = params.outlineEmphasis     || 1;

	// Advanced++ options
	// Not usable as command line options
	this.defaultGroupRatio   = params.defaultGroupRatio   || 1;
	this.classGroups         = params.classGroups         || {};
	this.fileGroups          = params.fileGroups          || {};
	this.fileGroupRatios     = params.fileGroupRatios     || {};
	this.returnData          = params.returnData          || false;
	this.attributeFilter     = params.attributeFilter;
	this.attributeFilter     = params.attributeFilter;
	this.classRatios         = params.classRatios;
	this.container           = params.container;
	this.ignoreExpression    = params.ignoreExpression;
	this.ignoreList          = params.ignoreList;
	this.removeList          = params.removeList;
	this.exclusiveList       = params.exclusiveList;
	this.postProcess         = params.postProcess;
	this.customWriteFile     = params.customWriteFile;
	this.customReadFile      = params.customReadFile;
	this.fixedSize           = params.fixedSize;
	this.fallbackFrameRate   = params.fallbackFrameRate   || 25;
	// 1: minimal log level, 10: maximum log level. TODO: needs to be implemented on every console.warn/log/error
	this.verbosity           = params.verbosity           || 3;

	// Whether only one frame is being rendered
	// Boolean used for naming purpose
	this.onlyOneFrame = (this.renderFrames instanceof Array) && (this.renderFrames.length === 1);

	if (this.outDir === null) {
		// Returning data if output directory not specified
		this.returnData = true;

		this.writeToDisk = false;
	} else {
		// Writing to disk only if output directory is specified
		this.writeToDisk = true;
	}

	// Checking for uncompatible options
	if (this.renderFrames) {
		if (this.simplify) {
			this.simplify = false;
			// console.warn('[Jeff] Option to simplify will be ignored');
		}

		if (this.flatten) {
			this.flatten = false;
			// console.warn('[Jeff] Option to flatten will be ignored');
		}

		if (this.compressMatrices) {
			this.compressMatrices = false;
			// console.warn('[Jeff] Option to compress matrices will be ignored');
		}
	}
}

Jeff.prototype._init = function (options, cb) {
	this._options = new JeffOptions(options);
	this._extractedData = [];
	this._fileHeaderInfo = {};

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
		var self = this;
		glob(this._options.source, { cwd: this._options.inputDir }, function (error, uris) {
			console.error('uris', self._options.source, uris)
			cb(uris);
		})
	}
};

Jeff.prototype._extractFileGroups = function (swfUris, endExtractionCb) {
	var nbFiles  = 0;
	var nbErrors = 0;

	var filesPerGroup = helper.groupFiles(swfUris, this._options.fileGroups);
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
			if (endExtractionCb) {
				endExtractionCb(null, { files: nbFiles, errors: nbErrors }, self._extractedData);
			}
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
	if (this._options.verbosity >= 5) {
		console.log('parsing: ' + swfName);
	}
	var self = this;
	var swfObjects = [];
	function onFileRead(error, swfData) {
		if (error) return nextSwfCb(error);
		self._parser.parse(swfName, swfData,
			function (swfObject) {
				var id = swfObject.id;
				swfObject._swfName = swfName;
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

					if (swfObject.type === 'header') {
						self._fileHeaderInfo[swfName] = swfObject;
						return;
					}

					// TODO: handle labels
					if (swfObject.type === 'labels') {
						return;
					}

					// TODO: handle DoAbc
					if (swfObject.type === 'DoAbc') {
						return;
					}

					// TODO: handle DoAction
					if (swfObject.type === 'DoAction') {
						return;
					}

					console.log('Jeff.parseFile: swfObject not handled, ', swfObject);
					return;
				}

				swfObjects[id] = swfObject;
			},
			function (error) {
				// propagate original files' frame rate to their objects
				for (var id in swfObjects) {
					var object = swfObjects[id];
					if (self._fileHeaderInfo[object._swfName]) {
						object._frameRate = self._fileHeaderInfo[object._swfName].frameRate;
					}
				}

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
			self._symbolList = helper.generateExportList(self._symbols, self._classGroupList, self._options.attributeFilter);
			self._renderer.renderSymbols(self,
				function (imageList, graphicProperties) {
					self._extractClassGroup(imageList, graphicProperties, nextClassListCb);
				}
			);
		},
		nextGroupCb
	);
};

Jeff.prototype._extractClassGroup = function (imageList, graphicProperties, nextClassListCb) {
	var imageNames = this._generateImageNames(imageList);
	var data = this._generateExportData(graphicProperties, imageNames);
	if (this._options.writeToDisk) {
		this._writeImagesToDisk(imageList, imageNames);
		if (!this._options.ignoreData) {
			this._writeDataToDisk(data);
		}
	}

	if (this._options.returnData) {
		this._extractedData.push({
			imageNames: imageNames,
			images: imageList,
			data: data
		});
	}

	nextClassListCb();
};

Jeff.prototype._generateImageNames = function (imageList) {
	var imageNames = [];
	if (this._options.ignoreImages) {
		return imageNames;
	}

	for (var i = 0; i < imageList.length; i += 1) {
		imageNames[i] = this._generateImageName(imageList[i].name);
	}
	return imageNames;
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

	return imgPath + '.png';
};

Jeff.prototype._writeImagesToDisk = function (imageList, imageNames) {
	for (var i = 0; i < imageNames.length; i += 1) {
		var imagePath = path.join(this._options.outDir, imageNames[i]);
		this._canvasToPng(imagePath, imageList[i].img);
	}
};

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

// TODO: frame rate should be stored on symbols instead of graphic properties
Jeff.prototype._retrieveFrameRate = function (graphicProperties) {
	var frameRate;
	var fallback = this._options.fallbackFrameRate;
	for (var id in graphicProperties) {
		var graphicProperty = graphicProperties[id];
		if (graphicProperty.frameRate) {
			if (!frameRate) {
				frameRate = graphicProperty.frameRate;
			} else if (graphicProperty.frameRate !== frameRate) {
				if (this._options.verbosity >= 3) {
					console.warn('multiple elements have different framerates, using fallback (' + fallback + 'fps)');
				}
				return fallback;
			}
		}
	}
	return frameRate || fallback;
};

Jeff.prototype._generateExportData = function (graphicProperties, imageNames) {
	// Constructing symbols data that will be included in the export
	var exportSymbolsData;
	if (this._options.renderFrames) {
		exportSymbolsData = helper.generateFrameByFrameData(this._symbols, this._symbolList, graphicProperties, this._options.onlyOneFrame);
	} else {
		exportSymbolsData = helper.generateMetaData(this._symbols, this._symbolList, graphicProperties);
	}

	// Applying post-process, if any
	if (this._options.postProcess) {
		if (this._options.postProcess instanceof Array) {
			var nProcesses = this._options.postProcess.length;
			for (var p = 0; p < nProcesses; p += 1) {
				this._options.postProcess[p](exportSymbolsData, this._symbols);
			}
		} else {
			this._options.postProcess(exportSymbolsData, this._symbols);
		}
	}

	if (this._options.ignoreData) {
		return;
	}

	// Constructing metadata of conversion properties (for importing purpose)
	var exportProperties = {
		app: 'https://www.npmjs.com/package/jeff',
		version: pjson.version,
		frameRate: this._retrieveFrameRate(graphicProperties),
		scale: this._options.ratio,
		filtering: [this._options.minificationFilter, this._options.magnificationFilter],
		mipmapCompatible: this._options.powerOf2Images,
		compressedMatrices: this._options.compressMatrices,
		prerendered: this._options.renderFrames ? true : false
	};

	if (imageNames.length === 1) {
		exportProperties.image = imageNames[0];
	} else {
		exportProperties.images = imageNames;
	}

	var exportData = {
		meta: exportProperties
	};

	if (this._options.flatten)  { exportSymbolsData = helper.flattenAnimations(exportSymbolsData); }
	if (this._options.simplify) { exportSymbolsData = helper.simplifyAnimation(exportSymbolsData); }
	exportData.symbols = exportSymbolsData;

	if (this._options.compressMatrices) {
		var delocatedMatrices = helper.delocateMatrices(exportSymbolsData);
		exportData.transforms = delocatedMatrices.transforms;
		exportData.colors     = delocatedMatrices.colors;
	}

	return exportData;
};

Jeff.prototype._writeDataToDisk = function (data) {
	var jsonFileName = this._generateJsonFileName();
	this._dataToJson(jsonFileName, data);
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

function writeFile(outputFileName, data, options) {
	var subDir = path.dirname(outputFileName);
	if (!fs.existsSync(subDir)) {
		fs.mkdirsSync(subDir);
	}

	fs.writeFileSync(outputFileName, data, options);
}
