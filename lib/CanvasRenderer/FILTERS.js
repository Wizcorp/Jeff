/* jslint node: true */
'use strict';

var FILTERS = {};
module.exports = FILTERS;

FILTERS.colorMatrix = function (context, params, dim, bounds) {
	/* jslint maxstatements: 50 */
	var left   = Math.max(dim.left, bounds.left);
	var top    = Math.max(dim.top, bounds.top);
	var right  = Math.min(left + dim.width, bounds.right);
	var bottom = Math.min(top + dim.height, bounds.bottom);
	var width  = right - left;
	var height = bottom - top;

	if (width <= 0 || height <= 0) {
		return;
	}

	var pixelBuffer = context.getImageData(left, top, width, height);
	var pixelData   = pixelBuffer.data;
	var nBytes      = pixelData.length;
	var colorMatrix = params.matrix;

	var r0 = colorMatrix[0];
	var r1 = colorMatrix[1];
	var r2 = colorMatrix[2];
	var r3 = colorMatrix[3];
	var r4 = colorMatrix[4];

	var g0 = colorMatrix[5];
	var g1 = colorMatrix[6];
	var g2 = colorMatrix[7];
	var g3 = colorMatrix[8];
	var g4 = colorMatrix[9];

	var b0 = colorMatrix[10];
	var b1 = colorMatrix[11];
	var b2 = colorMatrix[12];
	var b3 = colorMatrix[13];
	var b4 = colorMatrix[14];

	var a0 = colorMatrix[15];
	var a1 = colorMatrix[16];
	var a2 = colorMatrix[17];
	var a3 = colorMatrix[18];
	var a4 = colorMatrix[19];

	for (var i = 0; i < nBytes; i += 4) {
		var r = pixelData[i];
		var g = pixelData[i + 1];
		var b = pixelData[i + 2];
		var a = pixelData[i + 3];

		pixelData[i]     = r * r0 + g * r1 + b * r2 + a * r3 + r4; // red
		pixelData[i + 1] = r * g0 + g * g1 + b * g2 + a * g3 + g4; // green
		pixelData[i + 2] = r * b0 + g * b1 + b * b2 + a * b3 + b4; // blue
		pixelData[i + 3] = r * a0 + g * a1 + b * a2 + a * a3 + a4; // blue
	}

	context.putImageData(pixelBuffer, left, top);
};

FILTERS.dropShadow = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var angle    = params.angle;
	var distance = params.distance;
	var strength = params.strength;
	var color    = params.dropShadowColor;

	var r = color.red;
	var g = color.green;
	var b = color.blue;
	var a = color.alpha;

	var blurX = Math.round(params.blurX);
	var blurY = Math.round(params.blurY);
	var halfBlurX = Math.round(blurX / 2);
	var halfBlurY = Math.round(blurY / 2);
	var blurArea = blurX * blurY;

	var dx = Math.cos(angle) * distance;
	var dy = Math.sin(angle) * distance;

	// Determining bounds for the blur
	var blurLeft   = Math.max(~~Math.min(left, left - Math.abs(dx) - blurX), 0);
	var blurRight  = Math.min(~~Math.max(right, right  + Math.abs(dx) + blurX), bounds.right);
	var blurTop    = Math.max(~~Math.min(top, top - Math.abs(dy) - blurY), 0);
	var blurBottom = Math.min(~~Math.max(bottom, bottom + Math.abs(dy) + blurY), bounds.bottom);

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	var offsetX = Math.round(dx);
	var offsetY = Math.round(dy);

	var offsetIdx = (offsetY * w + offsetX) * 4;

	var original = context.getImageData(blurLeft, blurTop, w, h);
	var originalData = original.data;
	var nBytes = originalData.length;

	// Constructing shadow
	var shadowData;
	for (var p = 0; p < params.numPasses; p += 1) {
		var pixelData = originalData;
		shadowData = new Array(nBytes);

		// Applying colors
		for (var n = 0; n < nBytes; n += 4) {
			shadowData[n] = r;
			shadowData[n + 1] = g;
			shadowData[n + 2] = b;
		}

		for (var i = 0; i < w; i += 1) {
			for (var j = 0; j < h; j += 1) {

				// Computing the blur
				var blur = 0;
				var nPix = blurArea;
				for (var x = 0; x < blurX; x += 1) {
					for (var y = 0; y < blurY; y += 1) {
						var x0 = i + x - halfBlurX;
						var y0 = j + y - halfBlurY;
						if (x0 < 0 || w < x0 || y0 < 0 || h <= y0) {
							nPix -= 1;
							continue;
						}
						// Computing the pixel index
						var l = (y0 * w + x0) * 4 - offsetIdx;
						// Adding alpha
						blur += pixelData[l + 3];
					}
				}

				var k = (j * w + i) * 4;
				shadowData[k + 3] = Math.min(~~(strength * a * blur / nPix), 255);
			}
		}

		pixelData = shadowData;
	}

	// Rewriting image on top of the shadow
	for (var m = 0; m < nBytes; m += 4) {
		var alpha = originalData[m + 3] / 255;

		originalData[m]     = ~~ (originalData[m] * alpha + shadowData[m] * (1 - alpha)); // red
		originalData[m + 1] = ~~ (originalData[m + 1] * alpha + shadowData[m + 1] * (1 - alpha)); // green
		originalData[m + 2] = ~~ (originalData[m + 2] * alpha + shadowData[m + 2] * (1 - alpha)); // blue
		originalData[m + 3] = ~~ (originalData[m + 3] * alpha + shadowData[m + 3] * (1 - alpha)); // blue
	}

	context.putImageData(original, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.width  = w;
	dim.height = h;
};

FILTERS.glow = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var strength = Math.min(params.strength, 1);
	var color    = params.glowColor;

	var r = color.red;
	var g = color.green;
	var b = color.blue;
	var a = color.alpha;

	var blurX = Math.round(params.blurX);
	var blurY = Math.round(params.blurY);
	var halfBlurX = Math.round(blurX / 2);
	var halfBlurY = Math.round(blurY / 2);
	var blurArea = blurX * blurY;

	// Determining bounds for the blur
	var blurLeft   = Math.max(~~Math.min(left, left - blurX), 0);
	var blurRight  = Math.min(~~Math.max(right, right + blurX), bounds.right);
	var blurTop    = Math.max(~~Math.min(top, top - blurY), 0);
	var blurBottom = Math.min(~~Math.max(bottom, bottom + blurY), bounds.bottom);

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	var original = context.getImageData(blurLeft, blurTop, w, h);
	var originalData = original.data;
	var nBytes = originalData.length;

	// Constructing glow
	var shadowData;
	for (var p = 0; p < params.numPasses; p += 1) {
		var pixelData = originalData;
		shadowData = new Array(nBytes);

		// Applying colors
		for (var n = 0; n < nBytes; n += 4) {
			shadowData[n] = r;
			shadowData[n + 1] = g;
			shadowData[n + 2] = b;
		}

		for (var i = 0; i < w; i += 1) {
			for (var j = 0; j < h; j += 1) {

				// Computing the blur for pixel (i, j)
				var blur = 0;
				var nPix = blurArea;
				for (var x = 0; x < blurX; x += 1) {
					for (var y = 0; y < blurY; y += 1) {
						var x0 = i + x - halfBlurX;
						var y0 = j + y - halfBlurY;
						if (x0 < 0 || w < x0 || y0 < 0 || h <= y0) {
							nPix -= 1;
							continue;
						}

						var l = (y0 * w + x0) * 4;
						// Adding pixel alpha to blur value
						blur += pixelData[l + 3];
					}
				}

				var k = (j * w + i) * 4;
				shadowData[k + 3] = Math.min(~~(strength * a * blur / nPix), 255);
			}
		}

		pixelData = shadowData;
	}

	// Rewriting image on top of the glow
	for (var m = 0; m < nBytes; m += 4) {
		var alpha = originalData[m + 3] / 255;

		originalData[m]     = ~~ (originalData[m] * alpha + shadowData[m] * (1 - alpha)); // red
		originalData[m + 1] = ~~ (originalData[m + 1] * alpha + shadowData[m + 1] * (1 - alpha)); // green
		originalData[m + 2] = ~~ (originalData[m + 2] * alpha + shadowData[m + 2] * (1 - alpha)); // blue
		originalData[m + 3] = ~~ (originalData[m + 3] * alpha + shadowData[m + 3] * (1 - alpha)); // blue
	}

	context.putImageData(original, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.width  = w;
	dim.height = h;
};


FILTERS.blur = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var blurX = Math.ceil(params.blurX);
	var blurY = Math.ceil(params.blurY);
	var halfBlurX = Math.ceil(blurX / 2);
	var halfBlurY = Math.ceil(blurY / 2);
	var blurArea = blurX * blurY;

	if (blurArea === 0) {
		return;
	}

	// Determining bounds for the blur
	var blurLeft   = Math.max(~~Math.min(left, left - blurX), 0);
	var blurRight  = Math.min(~~Math.max(right, right + blurX), bounds.right);
	var blurTop    = Math.max(~~Math.min(top, top - blurY), 0);
	var blurBottom = Math.min(~~Math.max(bottom, bottom + blurY), bounds.bottom);

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// Constructing blur
	var blurBuffer1 = context.createImageData(w, h);
	var blurBuffer2 = context.getImageData(blurLeft, blurTop, w, h);
	var nBytes = blurBuffer1.data.length;
	for (var p = 0; p < params.numPasses; p += 1) {
		// At each iteration buffers 1 and 2 are switched
		// as source and destination for computing the blur
		// p is even => blurBuffer1 is destination, blurBuffer2 is source
		// p is odd  => blurBuffer2 is destination, blurBuffer1 is source
		var pixelData = (p & 1) ? blurBuffer1.data : blurBuffer2.data;
		var blurData  = (p & 1) ? blurBuffer2.data : blurBuffer1.data;

		for (var i = 0; i < w; i += 1) {
			for (var j = 0; j < h; j += 1) {

				// Computing the pixel color
				var r = 0;
				var g = 0;
				var b = 0;
				var a = 0;
				var nPix = blurArea;
				for (var x = 0; x < blurX; x += 1) {
					for (var y = 0; y < blurY; y += 1) {
						var x0 = i + x - halfBlurX;
						var y0 = j + y - halfBlurY;
						if (x0 < 0 || w < x0 || y0 < 0 || h <= y0) {
							nPix -= 1;
							continue;
						}
						var l = (y0 * w + x0) * 4;

						// Adding alpha
						r += pixelData[l];
						g += pixelData[l + 1];
						b += pixelData[l + 2];
						a += pixelData[l + 3];
					}
				}

				var k = (j * w + i) * 4;
				blurData[k]     = ~~(r / nPix);
				blurData[k + 1] = ~~(g / nPix);
				blurData[k + 2] = ~~(b / nPix);
				blurData[k + 3] = ~~(a / nPix);
			}
		}
	}

	// If number of passes is even => blurBuffer2 was the final destination
	// If number of passes is odd  => blurBuffer1 was the final destination
	context.putImageData((params.numPasses & 1) ? blurBuffer1 : blurBuffer2, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.width  = w;
	dim.height = h;
};
