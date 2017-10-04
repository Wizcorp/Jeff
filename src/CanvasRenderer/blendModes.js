
function blend(blendEquation, source, destination, alpha, dim, bounds) {
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
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255 * alpha;

		if (sa === 0 && da === 0) {
			dstData[i]     = 0;
			dstData[i + 1] = 0;
			dstData[i + 2] = 0;
			dstData[i + 3] = 0;
			continue;
		}

		var dr = dstData[i];
		var dg = dstData[i + 1];
		var db = dstData[i + 2];

		var sr = srcData[i];
		var sg = srcData[i + 1];
		var sb = srcData[i + 2];

		var sz = (1 - sa);
		var dz = (1 - da);

		// To anyone who reads this comment
		// if you know why this code works when raising to the power 4 (rather than 1?)
		// let us know by posting on JEFF's github repo
		var r = da + dz * Math.pow(da / (sa + da), 4);

		dstData[i]     = (dr * sz + sa * blendEquation(sr, dr)) * r + (1 - r) * sr;
		dstData[i + 1] = (dg * sz + sa * blendEquation(sg, dg)) * r + (1 - r) * sg;
		dstData[i + 2] = (db * sz + sa * blendEquation(sb, db)) * r + (1 - r) * sb;
		dstData[i + 3] = (sa + da - sa * da) * 255;
	}

	destination.putImageData(dstBuffer, left, top);
	// // Drawing bounding box (debugging purpose)
	// destination.setTransform(1, 0, 0, 1, 0, 0);
	// destination.globalAlpha = 1;
	// destination.lineWidth   = 4;
	// destination.strokeStyle = '#cc3333';
	// destination.strokeRect(left, top, right - left, bottom - top);
}

// Flash Blend mode 3
function multiply(colorSource, colordDest) { return colorSource * colordDest / 255; }
exports.multiply = function (source, destination, alpha, dim, bounds) { blend(multiply, source, destination, alpha, dim, bounds); };

// Flash Blend mode 4
function screen(colorSource, colordDest) { return 255 - (255 - colorSource) * (255 - colordDest) / 255; }
exports.screen = function (source, destination, alpha, dim, bounds) { blend(screen, source, destination, alpha, dim, bounds); };

// Flash Blend mode 5
function lighten(colorSource, colordDest) { return Math.max(colorSource, colordDest); }
exports.lighten = function (source, destination, alpha, dim, bounds) { blend(lighten, source, destination, alpha, dim, bounds); };

// Flash Blend mode 6
function darken(colorSource, colordDest) { return Math.min(colorSource, colordDest); }
exports.darken = function (source, destination, alpha, dim, bounds) { blend(darken, source, destination, alpha, dim, bounds); };

// Flash Blend mode 7
function difference(colorSource, colordDest) { return (colordDest < colorSource) ? colorSource - colordDest : colordDest - colorSource; }
exports.difference = function (source, destination, alpha, dim, bounds) { blend(difference, source, destination, alpha, dim, bounds); };

// Flash Blend mode 8
function add(colorSource, colordDest) { return colordDest + colorSource; }
exports.add = function (source, destination, alpha, dim, bounds) { blend(add, source, destination, alpha, dim, bounds); };

// Flash Blend mode 9
function substract(colorSource, colordDest) { return colordDest - colorSource; }
exports.substract = function (source, destination, alpha, dim, bounds) { blend(substract, source, destination, alpha, dim, bounds); };

// Flash Blend mode 10
function invert(colorSource, colordDest) { return 255 - colordDest; }
exports.invert = function (source, destination, alpha, dim, bounds) { blend(invert, source, destination, alpha, dim, bounds); };

// Flash Blend mode 11
exports.alpha = function (source, destination, alpha, dim, bounds) {
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
		dstData[i + 3] *= alpha * srcData[i + 3] / 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

// Flash Blend mode 12
exports.erase = function (source, destination, alpha, dim, bounds) {
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
		dstData[i + 3] *= (255 - alpha * srcData[i + 3]) / 255;
	}

	destination.putImageData(dstBuffer, left, top);
};

// Flash Blend mode 13
function overlay(colorSource, colordDest) {
	if (colordDest < 128) {
		return 2 * colorSource * colordDest / 255;
	} else {
		return 255 - 2 * (255 - colorSource) * (255 - colordDest) / 255;
	}
}
exports.overlay = function (source, destination, alpha, dim, bounds) { blend(overlay, source, destination, alpha, dim, bounds); };

// Flash Blend mode 14
function hardlight(colorSource, colordDest) {
	if (colorSource < 128) {
		return 2 * colorSource * colordDest / 255;
	} else {
		return 255 - 2 * (255 - colorSource) * (255 - colordDest) / 255;
	}
}
exports.hardlight = function (source, destination, alpha, dim, bounds) { blend(hardlight, source, destination, alpha, dim, bounds); };