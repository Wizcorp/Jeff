'use strict';
var SwfImgRenderer  = require('./SwfImgRenderer/index');

/* List of known issues:
	- drawImage does implicit conversion of image position to integer (due to node canvas, issue #395 on https://github.com/LearnBoost/node-canvas)
	- Global Composite Operations Bug: source-in can result in an overflow if renderer image is bigger than the mask (due to node canvas, issue #416 on https://github.com/LearnBoost/node-canvas)
	- Alpha of gradient fill style Bug (due to node canvas, issue #417 on https://github.com/LearnBoost/node-canvas)
	- Drawing images of dimension (w, h) = (0, 0) or with a scale of 0 makes a canvas unsuable (bug in node Canvas, not reported)
	- Another Global Composite Operations Bug: source-in can result in dark outlines of the image when rotated (bug in node Canvas, not reported)
	- putImageData does not always use the last updated data (seems to be a bug in node Canvas, not reported)
	- When rendering images the size of the canvas could be too small if glows or shadows are being applied
		(Fix: consider glow and shadow dimensions when setting canvas dimension, increased dimension should be notified to the extractor)
	- Not tested but probably does not work: rendering rotated shapes with an alpha blend mode will not have the same result as in flash
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
	this._framesToRender = exporter._renderFrames;
	this._onlyOneFrame   = exporter._onlyOneFrame;
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
	this._rendering      = true;
};

// CanvasRenderer's only public method/attribute
CanvasRenderer.prototype.renderSymbols = function (exporter, cb) {
	// Initialisation of the Canvas Renderer with respect to the exporter's parameters
	this._init(exporter, cb);

	// Prerendering images into canvasses
	this._prepareImages();
};