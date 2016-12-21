'use strict';
var renderImageToCanvas = require('./renderImageToCanvas.js');

/* List of known issues:
	- drawImage does implicit conversion of image position to integer
	(due to node canvas, issue #395 on https://github.com/LearnBoost/node-canvas)

	- Global Composite Operations Bug: source-in can result in an overflow if rendered image is bigger than the mask
	(due to node canvas, issue #416 on https://github.com/LearnBoost/node-canvas)

	- Global Composite Operations Bug (Another): source-in can result in dark outlines of the image when rotated
	(due to node canvas, not reported)

	- Alpha of gradient fill style bug
	(due to node canvas, issue #417 on https://github.com/LearnBoost/node-canvas)

	- Drawing images of dimension (w, h) = (0, 0) or with a scale of 0 makes a canvas unsuable
	(due to node canvas, not reported)

	- putImageData does not always use the last updated data
	(seems to be due to node canvas, not reported)

	- Path point positions need to be rounded to one decimal value when creating a vectorial path
	(due to node canvas, not reported)

	- When rendering images the size of the canvas could be too small if glows or shadows are being applied
		(Fix: consider glow and shadow dimensions when setting canvas dimension, increased dimension should be notified to the extractor)

	- Not tested but probably does not work: rendering rotated shapes with an alpha blend mode will not have the same result as in flash
*/

// N.B Considering the number of issues with node canvas and how difficult it is to install for some configurations
// and how slow it performs some task like blendings and filters (it has no shader) it is very likely that it will be replaced by a WebGL 
// vectorial rendering library.

function CanvasRenderer() {
	this._renderImageToCanvas = renderImageToCanvas;

	this._rendering = false;
	this._callback  = undefined;
	this._images    = {};
	this._extractor = {};
	this._options   = {};

}
module.exports = CanvasRenderer;

CanvasRenderer.prototype._init = function (extractor, callback) {
	if (this._rendering === true) {
		console.warn('[CanvasRenderer.init] Could not start rendering because another rendering is pending');
		return;
	}

	this._rendering = true;
	this._callback  = callback;
	this._images    = {};
	this._extractor = extractor;
	this._options   = extractor._options;
};

// CanvasRenderer's only public method/attribute
CanvasRenderer.prototype.renderSymbols = function (extractor, cb) {
	// Initialisation of the Canvas Renderer with respect to the extractor's parameters
	this._init(extractor, cb);

	// Prerendering images into canvasses
	this._prepareImages();
};