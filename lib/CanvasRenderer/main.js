'use strict';
var SwfImgRenderer  = require('./SwfImgRenderer/index');

/* List of known issues:
	- drawImage does implicit conversion of image position to integer (due to node canvas, issue #395 on https://github.com/LearnBoost/node-canvas)
	- Global Composite Operations Bug (due to node canvas, issue #416 on https://github.com/LearnBoost/node-canvas)
	- Alpha of gradient fill style Bug (due to node canvas, issue #417 on https://github.com/LearnBoost/node-canvas)
	- Drawing images of dimension (w, h) = (0, 0) or with a scale of 0 makes a canvas unsuable (bug in node Canvas, not reported)
	- When rendering images the size of the canvas could be too small if glows or shadows are being applied
		(Fix: consider glow and shadow dimensions when setting canvas dimension, increased dimension should be notified to the extractor)
*/

/* TODO List:
	- manage case when images (other than atlas) should be exported with power of 2 dimensions
*/

function CanvasRenderer() {
	this._imgRenderer = new SwfImgRenderer();
	this._rendering   = false;

}
module.exports = CanvasRenderer;

CanvasRenderer.prototype._init = function (exporter, callback) {
	if (this._rendering === true) {
		console.warn('[CanvasRenderer.init] Could not start rendering because another rendering is pending');
		return;
	}

	this._exporter       = exporter;
	this._ratio          = exporter._fileGroupRatio;
	this._createAtlas    = exporter._createAtlas;
	this._frameByFrame   = exporter._renderFrames;
	this._firstFrameOnly = exporter._firstFrameOnly;
	this._powerOf2Images = exporter._powerOf2Images;
	this._maxImageDim    = exporter._maxImageDim;
	this._symbols        = exporter._symbols;
	this._symbolList     = exporter._symbolList;
	this._classGroupList = exporter._classGroupList;
	this._classRatios    = exporter._classRatios;
	this._fixedSize      = exporter._fixedSize;
	this._outlineCoeff   = 1 / (exporter._outlineEmphasis);
	
	this._callback       = callback;
	this._images         = {};

	this._nElemsToPrepare = 0;
	this._nElemsReady     = 0;
	this._rendering       = true;
};

CanvasRenderer.prototype._notifyImageAsReady = function () {
	this._nElemsReady += 1;

	// Try to start rendering of swf objects
	// Will succeed only if there is no more image to prepare
	this._tryAndStartRendering();
};

CanvasRenderer.prototype._tryAndStartRendering = function () {
	if (this._nElemsReady === this._nElemsToPrepare) {
		// All images haves been prepared
		// Start rendering of swf objects
		this._renderImages();
	}
};

// CanvasRenderer's only public method/attribute
CanvasRenderer.prototype.renderSymbols = function (exporter, cb) {
	// Initialisation of the Canvas Renderer with respect to the exporter's parameters
	this._init(exporter, cb);

	// Prerendering images into canvasses
	this._prepareImages();

	// Try to start the rendering of swf objects
	// Will succeed only if there is no image to prepare
	this._tryAndStartRendering();
};

