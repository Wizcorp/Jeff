'use strict';

var Canvas = require('canvas');

// TODO:
// - bevel filter
// - gradient glow filter
// - convolution filter
// - gradient bevel filter

exports.colorMatrix = function (context, params, dim, bounds) {
	/* jslint maxstatements: 50 */
	var left   = Math.max(dim.left, bounds.left);
	var top    = Math.max(dim.top,  bounds.top);
	var right  = Math.min(left + dim.width,  bounds.right);
	var bottom = Math.min(top  + dim.height, bounds.bottom);
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

function blendMore(srcData, dstData, inner, knockout) {
var test = true;
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255;

		if (inner) {
			sa *= da;
		}

		if (sa === 0 && da === 0) {
			dstData[i]     = 0;
			dstData[i + 1] = 0;
			dstData[i + 2] = 0;
			dstData[i + 3] = 0;
			continue;
		}

		var dr, dg, db;
		if (knockout) {
			dr = 255;
			dg = 255;
			db = 255;
		} else {
			dr = dstData[i];
			dg = dstData[i + 1];
			db = dstData[i + 2];
		}

		var sr = srcData[i];
		var sg = srcData[i + 1];
		var sb = srcData[i + 2];

		var sz = (1 - sa);
		var dz = (1 - da);

		// To anyone who reads this comment
		// if you know why this code works when raising to the power 4
		// let me know at bchevalier@wizcorp.jp
		var r = da + dz * Math.pow(da / (sa + da), 4);

		dstData[i]     = (dr * sz + sa * sr) * r + (1 - r) * sr;
		dstData[i + 1] = (dg * sz + sa * sg) * r + (1 - r) * sg;
		dstData[i + 2] = (db * sz + sa * sb) * r + (1 - r) * sb;
		dstData[i + 3] = (sa + da - sa * da) * 255;

		// if (test && da > 0.1) {
		// 	console.log('found!', dr, dg, db, da, r);
		// 	console.log('src!', sr, sg, sb, sa);
		// 	console.log('res!', dstData[i + 0], dstData[i + 1], dstData[i + 2], dstData[i + 3]);
		// 	test = false;
		// }

		// dstData[i]     = (dr * sz + sa * sr);
		// dstData[i + 1] = (dg * sz + sa * sg);
		// dstData[i + 2] = (db * sz + sa * sb);
		// dstData[i + 3] = (sa + da - sa * da) * 255;
	}
}
				// dstData[m]     = dstData[m]     * alphaDst + srcData[m]     * (1 - alphaDst); // red
				// dstData[m + 1] = dstData[m + 1] * alphaDst + srcData[m + 1] * (1 - alphaDst); // green
				// dstData[m + 2] = dstData[m + 2] * alphaDst + srcData[m + 2] * (1 - alphaDst); // blue
				// dstData[m + 3] = 255 * (alphaSrc + alphaDst - alphaSrc * alphaDst); // alpha

function blend(source, destination, inner, knockout, onTop) {

	onTop = onTop || inner;
	var srcData = onTop ? source.data : destination.data;
	var dstData = onTop ? destination.data : source.data;
console.log(inner, knockout, onTop);

	blendMore(srcData, dstData, inner, knockout);
	destination.data = dstData;

	// if (knockout) {
	// 	if (inner) {
	// 		// Rewriting image on top of the shadow
	// 		for (var m = 0; m < nBytes; m += 4) {
	// 			var alphaSrc = srcData[m + 3] / 255;
	// 			var alphaDst = dstData[m + 3] / 255;

	// 			dstData[m]     = 255 * (1 - alphaSrc) + srcData[m]     * alphaSrc; // red
	// 			dstData[m + 1] = 255 * (1 - alphaSrc) + srcData[m + 1] * alphaSrc; // green
	// 			dstData[m + 2] = 255 * (1 - alphaSrc) + srcData[m + 2] * alphaSrc; // blue
	// 			dstData[m + 3] = 255 * (alphaSrc + alphaDst - alphaSrc * alphaDst); // alpha
	// 		}
	// 	} else {
	// 		// Rewriting image on top of the shadow
	// 		for (var m = 0; m < nBytes; m += 4) {
	// 			var alphaSrc = srcData[m + 3] / 255;
	// 			var alphaDst = dstData[m + 3] / 255;

	// 			dstData[m]     = 255 * alphaDst + srcData[m]     * (1 - alphaDst); // red
	// 			dstData[m + 1] = 255 * alphaDst + srcData[m + 1] * (1 - alphaDst); // green
	// 			dstData[m + 2] = 255 * alphaDst + srcData[m + 2] * (1 - alphaDst); // blue
	// 			dstData[m + 3] = 255 * (alphaSrc + alphaDst - alphaSrc * alphaDst); // alpha
	// 		}
	// 	}
	// } else {
	// 	if (inner) {
	// 		// Rewriting image on top of the shadow
	// 		for (var m = 0; m < nBytes; m += 4) {
	// 			var alphaSrc = srcData[m + 3] / 255;
	// 			var alphaDst = dstData[m + 3] / 255;

	// 			dstData[m]     = dstData[m]     * (1 - alphaSrc) + srcData[m]     * alphaSrc; // red
	// 			dstData[m + 1] = dstData[m + 1] * (1 - alphaSrc) + srcData[m + 1] * alphaSrc; // green
	// 			dstData[m + 2] = dstData[m + 2] * (1 - alphaSrc) + srcData[m + 2] * alphaSrc; // blue
	// 			dstData[m + 3] = 255 * (alphaSrc + alphaDst - alphaSrc * alphaDst); // alpha
	// 		}
	// 	} else {
	// 		// Rewriting image on top of the shadow
	// 		for (var m = 0; m < nBytes; m += 4) {
	// 			var alphaSrc = srcData[m + 3] / 255;
	// 			var alphaDst = dstData[m + 3] / 255;

	// 			dstData[m]     = dstData[m]     * alphaDst + srcData[m]     * (1 - alphaDst); // red
	// 			dstData[m + 1] = dstData[m + 1] * alphaDst + srcData[m + 1] * (1 - alphaDst); // green
	// 			dstData[m + 2] = dstData[m + 2] * alphaDst + srcData[m + 2] * (1 - alphaDst); // blue
	// 			dstData[m + 3] = 255 * (alphaSrc + alphaDst - alphaSrc * alphaDst); // alpha
	// 		}
	// 	}
	// }
}

function glow(context, params, dim, bounds, color, strength, angle, distance) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var r = color.red;
	var g = color.green;
	var b = color.blue;
	var a = color.alpha;
	var inner = params.inner;

	var halfBlurX = Math.floor(params.blurX / 2);
	var halfBlurY = Math.floor(params.blurY / 2);
	var blurArea  = (2 * halfBlurX + 1) * (2 * halfBlurY + 1);

	if (blurArea <= 1) {
		return;
	}

	var dx = Math.cos(angle) * distance;
	var dy = Math.sin(angle) * distance;

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - Math.abs(dx) - halfBlurX)));
	var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + Math.abs(dx) + halfBlurX)));
	var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - Math.abs(dy) - halfBlurY)));
	var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + Math.abs(dy) + halfBlurY)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	var offsetX = Math.round(dx);
	var offsetY = Math.round(dy);

	var offsetIdx = (offsetY * w + offsetX) * 4;

	var dstBuffer = context.getImageData(blurLeft, blurTop, w, h);
	var dstData   = dstBuffer.data;
	var pixelData = dstData;

	// Constructing shadow
	var glowBuffer, glowData;
	var p, n, i, j, k, x, y;
	var nBytes = dstData.length;
	for (p = 0; p < params.numPasses; p += 1) {
		glowBuffer = context.createImageData(w, h);
		glowData   = glowBuffer.data;

		for (i = 0; i < w; i += 1) {
			for (j = 0; j < h; j += 1) {

				// Computing the blur
				var blur = 0;
				var nPix = blurArea;
				for (x = - halfBlurX; x <= halfBlurX; x += 1) {
					for (y = - halfBlurY; y <= halfBlurY; y += 1) {
						var x0 = i + x;
						var y0 = j + y;
						if (x0 < 0 || w <= x0 || y0 < 0 || h <= y0) {
							nPix -= 1;
							continue;
						}

						// Computing the pixel index
						k = (y0 * w + x0) * 4 - offsetIdx;

						// Adding alpha
						blur += inner ? 255 - pixelData[k + 3] : pixelData[k + 3];
					}
				}

				k = (j * w + i) * 4;
				glowData[k + 3] = Math.min(~~(strength * a * blur / nPix), 255);
			}
		}

		pixelData = glowData;
	}

	// Applying colors
	for (n = 0; n < nBytes; n += 4) {
		glowData[n]     = r;
		glowData[n + 1] = g;
		glowData[n + 2] = b;
	}

	blend(glowBuffer, dstBuffer, inner, params.knockout, false);
	// context.putImageData(dstBuffer, blurLeft, blurTop);

	// Rewriting the content of the buffer
	var tmpBuffer = context.createImageData(w, h);
	var tmpData = tmpBuffer.data;
	for (var i = 0; i < nBytes; i += 4) {
		tmpData[i]     = pixelData[i];
		tmpData[i + 1] = pixelData[i + 1];
		tmpData[i + 2] = pixelData[i + 2];
		tmpData[i + 3] = pixelData[i + 3];
	}
	context.putImageData(tmpBuffer, blurLeft, blurTop);

	// // Drawing bounding box (debugging purpose)
	// context.setTransform(1, 0, 0, 1, 0, 0);
	// context.globalAlpha = 1;
	// context.lineWidth   = 4;
	// context.strokeStyle = '#cc3333';
	// context.strokeRect(blurLeft, blurTop, w, h);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
}

exports.dropShadow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.dropShadowColor, params.strength, params.angle, params.distance);
};

exports.glow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.glowColor, params.strength, 0, 0);
};


exports.blur = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var halfBlurX = Math.floor(params.blurX / 2);
	var halfBlurY = Math.floor(params.blurY / 2);
	var blurArea  = (2 * halfBlurX + 1) * (2 * halfBlurY + 1);

	if (blurArea <= 1) {
		return;
	}

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - halfBlurX)));
	var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + halfBlurX)));
	var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - halfBlurY)));
	var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + halfBlurY)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// Constructing blur
	var blurBuffer1 = context.createImageData(w, h);
	var blurBuffer2 = context.getImageData(blurLeft, blurTop, w, h);
	var nBytes = blurBuffer1.data.length;
	var p, i, j, k, x, y;
	for (p = 0; p < params.numPasses; p += 1) {
		// At each iteration buffers 1 and 2 are switched
		// as source and destination for computing the blur
		// p is even => blurBuffer1 is destination, blurBuffer2 is source
		// p is odd  => blurBuffer2 is destination, blurBuffer1 is source
		var pixelData = (p & 1) ? blurBuffer1.data : blurBuffer2.data;
		var blurData  = (p & 1) ? blurBuffer2.data : blurBuffer1.data;

		for (i = 0; i < w; i += 1) {
			for (j = 0; j < h; j += 1) {

				// Computing the pixel color
				var r = 0;
				var g = 0;
				var b = 0;
				var a = 0;
				var nPix = blurArea;
				for (x = - halfBlurX; x <= halfBlurX; x += 1) {
					for (y = - halfBlurY; y <= halfBlurY; y += 1) {
						var x0 = i + x;
						var y0 = j + y;
						if (x0 < 0 || w <= x0 || y0 < 0 || h <= y0) {
							nPix -= 1;
							continue;
						}
						k = (y0 * w + x0) * 4;

						// Adding alpha
						r += pixelData[k];
						g += pixelData[k + 1];
						b += pixelData[k + 2];
						a += pixelData[k + 3];
					}
				}

				k = (j * w + i) * 4;

				var alpha = a / nPix;
				blurData[k]     = r / nPix * 255 / alpha;
				blurData[k + 1] = g / nPix * 255 / alpha;
				blurData[k + 2] = b / nPix * 255 / alpha;
				blurData[k + 3] = alpha;
			}
		}
	}

	// If number of passes is even => blurBuffer2 was the final destination
	// If number of passes is odd  => blurBuffer1 was the final destination
	context.putImageData((params.numPasses & 1) ? blurBuffer1 : blurBuffer2, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
};


exports.bevel = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top  + dim.height;

	var halfAlpha = 255 / 2;
	var strength = params.strength / 2;
	var angle    = params.angle;
	var ni = Math.cos(angle);
	var nj = Math.sin(angle);

	var d  = params.distance;
	var di = Math.round(ni * d);
	var dj = Math.round(nj * d);

	var shadowColor = params.shadowColor;
	var sr = shadowColor.red;
	var sg = shadowColor.green;
	var sb = shadowColor.blue;
	var sa = shadowColor.alpha;

	var highlightColor = params.highlightColor;
	var hr = highlightColor.red;
	var hg = highlightColor.green;
	var hb = highlightColor.blue;
	var ha = highlightColor.alpha;
	console.log('shadowColor', shadowColor);
	console.log('highlightColor', highlightColor);

	var halfBlurX = Math.ceil(params.blurX / 2);
	var halfBlurY = Math.ceil(params.blurY / 2);
	var blurArea  = (2 * halfBlurX + 1) * (2 * halfBlurY + 1);

	if (blurArea === 0) {
		return;
	}

	// Determining bounds for the blur
	var bevelLeft   = Math.max(0,             Math.round(Math.min(left,   left   - halfBlurX - di)));
	var bevelRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + halfBlurX + di)));
	var bevelTop    = Math.max(0,             Math.round(Math.min(top,    top    - halfBlurY - dj)));
	var bevelBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + halfBlurY + dj)));

	var w = bevelRight  - bevelLeft;
	var h = bevelBottom - bevelTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// Constructing bevel
	var bevelBuffer = context.createImageData(w, h);
	var dstBuffer   = context.getImageData(bevelLeft, bevelTop, w, h);
	var bevelData  = bevelBuffer.data;
	var sourceData = dstBuffer.data;
	var i, j, k, x, y;
	for (i = 0; i < w; i += 1) {
		for (j = 0; j < h; j += 1) {

			// highlight pixel position
			var hpi = i + di;
			var hpj = j + dj;

			// shadow pixel position
			var spi = i - di;
			var spj = j - dj;

			var hpAlpha, spAlpha;
			if (hpi < 0 || w <= hpi || hpj < 0 || h <= hpj) {
				hpAlpha = 0;
			} else {
				hpAlpha = sourceData[(hpj * w + hpi) * 4 + 3];
			}

			if (spi < 0 || w <= spi || spj < 0 || h <= spj) {
				spAlpha = 0;
			} else {
				spAlpha = sourceData[(spj * w + spi) * 4 + 3];
			}

			var alpha = (hpAlpha - spAlpha) * strength + halfAlpha;

			k = (j * w + i) * 4;
			if (halfAlpha < alpha) {
				bevelData[k]     = hr;
				bevelData[k + 1] = hg;
				bevelData[k + 2] = hb;
				bevelData[k + 3] = ha * (alpha - halfAlpha);
			} else {
				bevelData[k]     = sr;
				bevelData[k + 1] = sg;
				bevelData[k + 2] = sb;
				bevelData[k + 3] = sa * (halfAlpha - alpha);
			}
		}
	}

	// TODO: blurring bevel image

	// blending bevel image with original
	blend(bevelBuffer, dstBuffer, params.inner, params.knockout, params.onTop);
	context.putImageData(dstBuffer, bevelLeft, bevelTop);

	// Updating dimension of the image
	dim.left   = bevelLeft;
	dim.top    = bevelTop;
	dim.right  = bevelRight;
	dim.bottom = bevelBottom;
	dim.width  = w;
	dim.height = h;
};