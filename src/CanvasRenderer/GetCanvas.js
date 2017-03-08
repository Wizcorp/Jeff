"use strict"

function GetCanvas(width, height) {
	var w = width || 300;
	var h = height || 150;
	var Canvas = null;

	if (typeof(window) !== 'undefined' && typeof(document) !== 'undefined' && typeof(document.createElement) !== 'undefined') {
		Canvas = document.createElement('canvas');
		Canvas.width = w;
		Canvas.h = h;
		return Canvas;
	} else {
		Canvas = require('canvas');
		return new Canvas(w, h);
	}
}

module.exports = GetCanvas;
