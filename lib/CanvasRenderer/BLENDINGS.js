/* jslint node: true */
'use strict';

var BLENDINGS = {};
module.exports = BLENDINGS;

// TODO: verify all the blendings to make sure the source and destination alpha values are considered correctly
BLENDINGS.add = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes  = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;

		dstData[i]     = Math.min(dstData[i]     + srcData[i]     * as, 255);
		dstData[i + 1] = Math.min(dstData[i + 1] + srcData[i + 1] * as, 255);
		dstData[i + 2] = Math.min(dstData[i + 2] + srcData[i + 2] * as, 255);
		dstData[i + 3] = (as + ad - as * ad) * 255;
		// dstData[i]     = srcData[i];
		// dstData[i + 1] = srcData[i + 1];
		// dstData[i + 2] = srcData[i + 2];
		// dstData[i + 3] = srcData[i + 3];
	}

	// // Drawing bounding box
	// destination.setTransform(1, 0, 0, 1, 0, 0);
	// destination.globalAlpha = 1;
	// destination.lineWidth = 4;
	// destination.strokeStyle = '#cc3333';
	// destination.strokeRect(left, top, right - left, bottom - top);
	// // destination.fillStyle = '#cc6666';
	// // destination.fillRect(0, 0, graphicWidth, graphicHeight);

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.substract = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;

		dstData[i]     = Math.max(dstData[i]     - srcData[i]     * as, 0);
		dstData[i + 1] = Math.max(dstData[i + 1] - srcData[i + 1] * as, 0);
		dstData[i + 2] = Math.max(dstData[i + 2] - srcData[i + 2] * as, 0);
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.lighten = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;

		dstData[i]     = Math.max(dstData[i],     srcData[i]     * as);
		dstData[i + 1] = Math.max(dstData[i + 1], srcData[i + 1] * as);
		dstData[i + 2] = Math.max(dstData[i + 2], srcData[i + 2] * as);
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.invert = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;
		var z = (1 - 2 * as);

		dstData[i]     = 255 * as + dstData[i]     * z;
		dstData[i + 1] = 255 * as + dstData[i + 1] * z;
		dstData[i + 2] = 255 * as + dstData[i + 2] * z;
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.difference = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var rd = dstData[i];
		var gd = dstData[i + 1];
		var bd = dstData[i + 2];
		var ad = dstData[i + 3] / 255;

		var as = srcData[i + 3] / 255;
		var rs = srcData[i]     * as;
		var gs = srcData[i + 1] * as;
		var bs = srcData[i + 2] * as;

		dstData[i]     = (rd < rs) ? rs - rd : rd - rs;
		dstData[i + 1] = (gd < gs) ? gs - gd : gd - gs;
		dstData[i + 2] = (bd < bs) ? bs - bd : bd - bs;
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}
	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.multiply = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;
		var zs = (1 - as);
		var zd = (1 - ad);

		dstData[i]     = dstData[i]     * (zs + as * srcData[i]     / 255) + zd * srcData[i];
		dstData[i + 1] = dstData[i + 1] * (zs + as * srcData[i + 1] / 255) + zd * srcData[i + 1];
		dstData[i + 2] = dstData[i + 2] * (zs + as * srcData[i + 2] / 255) + zd * srcData[i + 2];
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.darken = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var as = srcData[i + 3] / 255;
		var ad = dstData[i + 3] / 255;

		dstData[i]     = Math.min(dstData[i],     srcData[i]     * as);
		dstData[i + 1] = Math.min(dstData[i + 1], srcData[i + 1] * as);
		dstData[i + 2] = Math.min(dstData[i + 2], srcData[i + 2] * as);
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.overlay = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {
		var rd = dstData[i];
		var gd = dstData[i + 1];
		var bd = dstData[i + 2];

		var rs = srcData[i];
		var gs = srcData[i + 1];
		var bs = srcData[i + 2];

		var ad = dstData[i + 3] / 255;
		var as = srcData[i + 3] / 255;
		var z = (1 - as);

		dstData[i]     = rd * z + as * ((rd < 128) ? 2 * rd * rs : 65025 - 2 * (255 - rd) * (255 - rs)) / 255;
		dstData[i + 1] = gd * z + as * ((gd < 128) ? 2 * gd * gs : 65025 - 2 * (255 - gd) * (255 - gs)) / 255;
		dstData[i + 2] = bd * z + as * ((bd < 128) ? 2 * bd * bs : 65025 - 2 * (255 - bd) * (255 - bs)) / 255;
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

BLENDINGS.hardlight = function (source, destination, dim, bounds) {
	var left   = Math.max(dim.left,   bounds.left);
	var top    = Math.max(dim.top,    bounds.top);
	var right  = Math.min(dim.right,  bounds.right);
	var bottom = Math.min(dim.bottom, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var srcBuffer = source.getImageData(left, top, width, height);
	var dstBuffer = destination.getImageData(left, top, width, height);
	var srcData = srcBuffer.data;
	var dstData = dstBuffer.data;
	var nBytes = dstData.length;

	for (var i = 0; i < nBytes; i += 4) {

		var ad = dstData[i + 3] / 255;

		var rd = dstData[i]     * ad;
		var gd = dstData[i + 1] * ad;
		var bd = dstData[i + 2] * ad;

		var as = srcData[i + 3] / 255;
		var z = (1 - as);

		var rs = srcData[i];
		var gs = srcData[i + 1];
		var bs = srcData[i + 2];

		dstData[i]     = dstData[i]     * z + (as * ((rs < 128) ? 2 * rd * rs : 65025 - 2 * (255 - rd) * (255 - rs)) / 255);
		dstData[i + 1] = dstData[i + 1] * z + (as * ((gs < 128) ? 2 * gd * gs : 65025 - 2 * (255 - gd) * (255 - gs)) / 255);
		dstData[i + 2] = dstData[i + 2] * z + (as * ((bs < 128) ? 2 * bd * bs : 65025 - 2 * (255 - bd) * (255 - bs)) / 255);
		dstData[i + 3] = (as + ad - as * ad) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
};