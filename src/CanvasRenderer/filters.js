'use strict';

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

function blendNormal(srcData, dstData) {
// var test = true;
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255;

		var dr = dstData[i];
		var dg = dstData[i + 1];
		var db = dstData[i + 2];

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

		// if (test && sa > 0.1 && sa < 0.5) {
		// 	console.log('found!', dr, dg, db, da, r);
		// 	console.log('src!', sr, sg, sb, sa);
		// 	console.log('res!', dstData[i + 0], dstData[i + 1], dstData[i + 2], dstData[i + 3]);
		// 	test = false;
		// }
	}

	return dstData;
}

function knockoutUnder(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		srcData[i + 3] *= (1 - dstData[i + 3] / 255);
	}
	return srcData;
}

function knockoutInner(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		srcData[i + 3] *= dstData[i + 3] / 255;
	}
	return srcData;
}

function blendInner(srcData, dstData) {
	var nBytes = srcData.length;
	for (var i = 0; i < nBytes; i += 4) {
		var da = dstData[i + 3] / 255;
		var sa = srcData[i + 3] / 255;

		var dr = dstData[i];
		var dg = dstData[i + 1];
		var db = dstData[i + 2];

		var sr = srcData[i];
		var sg = srcData[i + 1];
		var sb = srcData[i + 2];

		var sz = (1 - sa);
		var dz = (1 - da);

		var r = 1 - Math.pow(sa, 4);

		srcData[i]     = (dr * sz + sa * sr) * r + (1 - r) * sr;
		srcData[i + 1] = (dg * sz + sa * sg) * r + (1 - r) * sg;
		srcData[i + 2] = (db * sz + sa * sb) * r + (1 - r) * sb;
		srcData[i + 3] = da * 255;
		// dstData[i + 3] = (sa + da - sa * da) * 255;
	}
	return srcData;
}

function blend(source, destination, inner, knockout, onTop, hideDestination) {
	var srcData = source.data;
	var dstData = destination.data;
	if (inner) {
		if (knockout) {
			return knockoutInner(srcData, dstData);
		} else {
			return blendInner(srcData, dstData);
		}
	}

	if (onTop) {
		if (knockout) {
			return srcData;
		} else {
			return blendNormal(srcData, dstData);
		}
	}

	if (knockout) {
		return knockoutUnder(srcData, dstData);
	} else {
		if (hideDestination) {
			return srcData;
		} else {
			return blendNormal(dstData, srcData);
		}
	}
}

function blurAlphaHorizontal(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);

	for (var y = 0; y < h; y += 1) {
		var a = 0;
		var i1 = y * w * 4;
		var i2 = i1;
		var i3 = i1;

		for (var x = 0; x < radius2; x += 1) {
			a  += pixelsIn[i2 + 3];
			i2 += 4;
		}

		for (x = 0; x < radius1; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (x + radius2 < w) {
		    	a  += pixelsIn[i2 + 3];
		    	i2 += 4;
			}
			i3 += 4;
		}

		for (x = radius1; x + radius2 < w; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  += pixelsIn[i2 + 3] - pixelsIn[i1 + 3];
			i1 += 4;
			i2 += 4;
			i3 += 4;
		}

		for (x = w - radius2; x < w; x += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  -= pixelsIn[i1 + 3];
			i1 += 4;
			i3 += 4;
		}
	}
}

function blurAlphaVertical(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	var offset = 4 * w;
	for (var x = 0; x < w; x += 1) {
		var a = 0;
		var i1 = 4 * x;
		var i2 = i1;
		var i3 = i1;

		for (var y = 0; y < radius2; y += 1) {
			a  += pixelsIn[i2 + 3];
			i2 += offset;
		}

		for (y = 0; y < radius1; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (y + radius2 < h) {
		    	a  += pixelsIn[i2 + 3];
		    	i2 += offset;
			}
			i3 += offset;
		}

		for (y = radius1; y + radius2 < h; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  += pixelsIn[i2 + 3] - pixelsIn[i1 + 3];
			i1 += offset;
			i2 += offset;
			i3 += offset;
		}

		for (y = h - radius2; y < h; y += 1) {
			pixelsOut[i3 + 3] = a * blurCoeff;
			a  -= pixelsIn[i1 + 3];
			i1 += offset;
			i3 += offset;
		}
	}
}

function glow(context, params, dim, bounds, color, angle, distance) {
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
	var nbPasses  = params.numPasses;

	var dx = Math.round(Math.cos(angle) * distance);
	var dy = Math.round(Math.sin(angle) * distance);

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.min(left,   left   + Math.min(dx, 0) - halfBlurX * nbPasses));
	var blurRight  = Math.min(bounds.right,  Math.max(right,  right  + Math.max(dx, 0) + halfBlurX * nbPasses));
	var blurTop    = Math.max(0,             Math.min(top,    top    + Math.min(dy, 0) - halfBlurY * nbPasses));
	var blurBottom = Math.min(bounds.bottom, Math.max(bottom, bottom + Math.max(dy, 0) + halfBlurY * nbPasses));

	// var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - Math.abs(dx) - halfBlurX)));
	// var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + Math.abs(dx) + halfBlurX)));
	// var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - Math.abs(dy) - halfBlurY)));
	// var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + Math.abs(dy) + halfBlurY)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// var offsetIdx = (Math.round(dy * w) + Math.round(dx)) * 4;
	//      k = (y0 * w + x0) * 4 - offsetIdx;

	// Constructing blur
	var blurBuffer = context.createImageData(w, h);
	var glowBuffer = context.getImageData(blurLeft, blurTop, w, h);

	var glowData  = glowBuffer.data;
	var i, nBytes = glowData.length;

	if (distance > 0) {
		// shifting every pixel
		var xStart, xEnd1, xEnd2, xStep;
		if (dx < 0) {
			xStart = 0;
			xEnd1  = dx + w - 1;
			xEnd2  = w - 1;
			xStep  = 1;
		} else {
			xStart = w - 1;
			xEnd1  = dx - 1;
			xEnd2  = -1;
			xStep  = -1;
		}

		var yStart, yEnd1, yEnd2, yStep;
		if (dy < 0) {
			yStart = 0;
			yEnd1  = dy + h - 1;
			yEnd2  = h - 1;
			yStep  = 1;
		} else {
			yStart = h - 1;
			yEnd1  = dy - 1;
			yEnd2  = -1;
			yStep  = -1;
		}

		var x, y, k;
		for (x = xStart; x !== xEnd1; x += xStep) {
			for (y = yStart; y !== yEnd1; y += yStep) {
				// only shifting alpha values
				k = 4 * (y * w + x) + 3;
				glowData[k] = glowData[k - 4 * (dy * w + dx)];
			}

			// Setting alpha values to 0 for every pixel whose offset is out of bounds
			for (y = yEnd1; y !== yEnd2; y += yStep) {
				glowData[4 * (y * w + x) + 3] = 0;
			}
		}

		// Setting alpha values to 0 for every pixel whose offset is out of bounds
		for (y = yStart; y !== yEnd2; y += yStep) {
			for (x = xEnd1; x !== xEnd2; x += xStep) {
				glowData[4 * (y * w + x) + 3] = 0;
			}
		}
	}

	if (inner) {
		// inverting image alpha
		for (i = 0; i < nBytes; i += 4) {
			glowData[i + 3] = 255 - glowData[i + 3];
		}
	}

	for (var p = 0; p < nbPasses; p += 1) {
		if (halfBlurX > 0) blurAlphaHorizontal(glowBuffer.data, blurBuffer.data, halfBlurX, w, h);
		if (halfBlurY > 0) blurAlphaVertical(blurBuffer.data, glowBuffer.data, halfBlurY, w, h);
	}

	// context.putImageData(glowBuffer, blurLeft, blurTop);

	// // Drawing bounding box (debugging purpose)
	// context.setTransform(1, 0, 0, 1, 0, 0);
	// context.globalAlpha = 1;
	// context.lineWidth   = 2;
	// context.strokeStyle = '#cc3333';
	// context.strokeRect(blurLeft, blurTop, w, h);
	// return;

	// Applying colors
	var strength = params.strength;
	for (i = 0; i < nBytes; i += 4) {
		glowData[i]     = r;
		glowData[i + 1] = g;
		glowData[i + 2] = b;
		glowData[i + 3] = a * Math.min(Math.floor(strength * glowData[i + 3]), 255);
	}

	var dstBuffer = context.getImageData(blurLeft, blurTop, w, h);



	// Rewriting the content of the buffer
	// N.B should be unnecessary but there must be a bug somewhere
	// as using putImageData on dstBuffer directly does not work


	// THIS SHOULD WORK
	// dstBuffer.data = blend(glowBuffer, dstBuffer, inner, params.knockout, false, params.compositeSource);
	// context.putImageData(dstBuffer, blurLeft, blurTop);


	// DOING THIS INSTEAD
	var pixelData = blend(glowBuffer, dstBuffer, inner, params.knockout, false, !params.compositeSource);
	var tmpBuffer = context.createImageData(w, h);
	var tmpData   = tmpBuffer.data;
	for (i = 0; i < nBytes; i += 4) {
		tmpData[i]     = pixelData[i];
		tmpData[i + 1] = pixelData[i + 1];
		tmpData[i + 2] = pixelData[i + 2];
		tmpData[i + 3] = pixelData[i + 3];
	}
	context.putImageData(tmpBuffer, blurLeft, blurTop);


	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
}

exports.dropShadow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.dropShadowColor, params.angle, params.distance);
};

exports.glow = function (context, params, dim, bounds) {
	glow(context, params, dim, bounds, params.glowColor, 0, 0);
};

function blurVertical(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	for (var y = 0; y < h; y += 1) {
		var r = 0;
		var g = 0;
		var b = 0;
		var a = 0;
		var i1 = y * w * 4;
		var i2 = i1;
		var i3 = i1;
		var alpha;

		for (var x = 0; x < radius2; x += 1) {
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			i2 += 4;
		}

		for (x = 0; x < radius1; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (x + radius2 < w) {
				alpha = pixelsIn[i2 + 3];
		    	r += pixelsIn[i2]     * alpha;
		    	g += pixelsIn[i2 + 1] * alpha;
		    	b += pixelsIn[i2 + 2] * alpha;
		    	a += alpha;
		    	i2 += 4;
			}
			i3 += 4;
		}

		for (x = radius1; x + radius2 < w; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += 4;
			i2 += 4;
			i3 += 4;
		}

		for (x = w - radius2; x < w; x += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += 4;
			i3 += 4;
		}
	}
}

function blurHorizontal(pixelsIn, pixelsOut, radius1, w, h) {
	var radius2 = radius1 + 1;
	var blurCoeff = 1 / (radius1 + radius2);
	var offset = 4 * w;
	for (var x = 0; x < w; x += 1) {
		var r = 0;
		var g = 0;
		var b = 0;
		var a = 0;
		var i1 = 4 * x;
		var i2 = i1;
		var i3 = i1;
		var alpha;

		for (var y = 0; y < radius2; y += 1) {
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			i2 += offset;
		}

		for (y = 0; y < radius1; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			if (y + radius2 < h) {
				alpha = pixelsIn[i2 + 3];
		    	r += pixelsIn[i2]     * alpha;
		    	g += pixelsIn[i2 + 1] * alpha;
		    	b += pixelsIn[i2 + 2] * alpha;
		    	a += alpha;
		    	i2 += offset;
			}
			i3 += offset;
		}

		for (y = radius1; y + radius2 < h; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i2 + 3];
			r += pixelsIn[i2]     * alpha;
			g += pixelsIn[i2 + 1] * alpha;
			b += pixelsIn[i2 + 2] * alpha;
			a += alpha;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += offset;
			i2 += offset;
			i3 += offset;
		}

		for (y = h - radius2; y < h; y += 1) {
			pixelsOut[i3]     = r / a;
			pixelsOut[i3 + 1] = g / a;
			pixelsOut[i3 + 2] = b / a;
			pixelsOut[i3 + 3] = a * blurCoeff;
			alpha = pixelsIn[i1 + 3];
			r -= pixelsIn[i1]     * alpha;
			g -= pixelsIn[i1 + 1] * alpha;
			b -= pixelsIn[i1 + 2] * alpha;
			a -= alpha;
			i1 += offset;
			i3 += offset;
		}
	}
}

exports.blur = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top + dim.height;

	var halfBlurX = Math.floor(params.blurX / 2);
	var halfBlurY = Math.floor(params.blurY / 2);
	var nbPasses  = params.numPasses;

	if (halfBlurX === 0 && halfBlurY === 0) {
		return;
	}

	// Determining bounds for the blur
	var blurLeft   = Math.max(0,             Math.round(Math.min(left,   left   - halfBlurX * nbPasses)));
	var blurRight  = Math.min(bounds.right,  Math.round(Math.max(right,  right  + halfBlurX * nbPasses)));
	var blurTop    = Math.max(0,             Math.round(Math.min(top,    top    - halfBlurY * nbPasses)));
	var blurBottom = Math.min(bounds.bottom, Math.round(Math.max(bottom, bottom + halfBlurY * nbPasses)));

	var w = blurRight - blurLeft;
	var h = blurBottom - blurTop;

	if (w <= 0 || h <= 0) {
		return;
	}

	// Constructing blur
	var blurBuffer1 = context.createImageData(w, h);
	var blurBuffer2 = context.getImageData(blurLeft, blurTop, w, h);
	for (var p = 0; p < nbPasses; p += 1) {
		if (halfBlurX > 0) blurVertical(blurBuffer2.data, blurBuffer1.data, halfBlurX, w, h);
		if (halfBlurY > 0) blurHorizontal(blurBuffer1.data, blurBuffer2.data, halfBlurY, w, h);
	}

	context.putImageData(blurBuffer2, blurLeft, blurTop);

	// Updating dimension of the image
	dim.left   = blurLeft;
	dim.top    = blurTop;
	dim.right  = blurRight;
	dim.bottom = blurBottom;
	dim.width  = w;
	dim.height = h;
};

	// Gg = function(pixels, offset, c, d, e, f, h, l, w, r) {
 //            for (var y = 0; y < r; ++y) {

 //            	var p = 0;
 //            	var i2 = y * w * 4 + offset;
 //            	var i1 = i2;
 //                for (var x = 0; x < l; ++x) {
 //                	p += pixels[i1];
 //                	i1 += 4;
 //                }

 //                var i3 = c;
 //                for (x = 0; x < h; ++x) {
 //                	pixels[i3] = p * f;
 //                	if (x + l < w) {
 //                		p += pixels[i1];
 //                		i1 += 4;
 //                	}
 //                	i3 += d;
 //                }

 //                for (x = h; x + l + 4 <= w; x += 4) {
 //                	pixels[i3] = p * f;
 //                	i3 += d;
 //                	p += pixels[i1] - pixels[i2];
 //                	pixels[i3] = p * f;
 //                	i3 += d;
 //                	p += pixels[i1 + 4] - pixels[i2 + 4];
 //                	pixels[i3] = p * f;
 //                	i3 += d;
 //                	p += pixels[i1 + 8] - pixels[i2 + 8];
 //                	pixels[i3] = p * f;
 //                	i3 += d;
 //                	p += pixels[i1 + 12] - pixels[i2 + 12];
 //                	i2 += 16;
 //                	i1 += 16;
 //                }

 //                for (x = w - l; x + l < w; ++x) {
 //                	pixels[i3] = p * f;
 //                	p += pixels[i1] - pixels[i2];
 //                	i2 += 4;
 //                	i1 += 4;
 //                	i3 += d;
 //                }

 //                for (x = w - l; x < w; ++x) {
 //                	pixels[i3] = p * f;
 //                	p -= pixels[i2];
 //                	i2 += 4;
 //                	i3 += d;
 //                }

 //                c += e
 //            }
 //        },



exports.bevel = function (context, params, dim, bounds) {
	/* jshint maxstatements: 100 */
	/* jshint maxdepth: 10 */
	var left   = dim.left;
	var top    = dim.top;
	var right  = left + dim.width;
	var bottom = top  + dim.height;

	var halfAlpha = 255 / 2;
	var strength = params.strength;
	var angle    = params.angle;
	var ni = Math.cos(angle);
	var nj = Math.sin(angle);

	var d  = params.distance;
	var di = Math.ceil(ni * d);
	var dj = Math.ceil(nj * d);

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

	var halfBlurX = Math.ceil(params.blurX / 2);
	var halfBlurY = Math.ceil(params.blurY / 2);
	var nbPasses  = params.numPasses;
	var blurArea  = (2 * halfBlurX + 1) * (2 * halfBlurY + 1);

	// Determining bounds for the blur
	var bevelLeft   = Math.max(0,             Math.min(left,   left   - halfBlurX * nbPasses - di));
	var bevelRight  = Math.min(bounds.right,  Math.max(right,  right  + halfBlurX * nbPasses + di));
	var bevelTop    = Math.max(0,             Math.min(top,    top    - halfBlurY * nbPasses - dj));
	var bevelBottom = Math.min(bounds.bottom, Math.max(bottom, bottom + halfBlurY * nbPasses + dj));

	var w = bevelRight  - bevelLeft;
	var h = bevelBottom - bevelTop;

	if (w <= 0 || h <= 0) {
		return;
	}


	// Constructing blur
	var blurBuffer = context.getImageData(bevelLeft, bevelTop, w, h);
	if (halfBlurX !== 0 || halfBlurY !== 0) {
		var blurBufferTmp = context.createImageData(w, h);
		for (var p = 0; p < nbPasses; p += 1) {
			if (halfBlurX > 0) blurVertical(blurBuffer.data, blurBufferTmp.data, halfBlurX, w, h);
			if (halfBlurY > 0) blurHorizontal(blurBufferTmp.data, blurBuffer.data, halfBlurY, w, h);
		}
	}

	// Constructing bevel
	var bevelBuffer = context.createImageData(w, h);
	var bevelData   = bevelBuffer.data;
	var sourceData  = blurBuffer.data;

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

	// blending bevel image with original
	var dstBuffer = context.getImageData(bevelLeft, bevelTop, w, h);

	// SHOULD DO THIS
	// dstBuffer.data = blend(bevelBuffer, dstBuffer, params.inner, params.knockout, params.onTop);
	// context.putImageData(dstBuffer, bevelLeft, bevelTop);

	// DOING THIS INSTEAD
	var pixelData = blend(bevelBuffer, dstBuffer, params.inner, params.knockout, params.onTop);
	var tmpBuffer = context.createImageData(w, h);
	var tmpData   = tmpBuffer.data;
	var nBytes    = pixelData.length;
	for (i = 0; i < nBytes; i += 4) {
		tmpData[i]     = pixelData[i];
		tmpData[i + 1] = pixelData[i + 1];
		tmpData[i + 2] = pixelData[i + 2];
		tmpData[i + 3] = pixelData[i + 3];
	}
	context.putImageData(tmpBuffer, bevelLeft, bevelTop);

	// Updating dimension of the image
	dim.left   = bevelLeft;
	dim.top    = bevelTop;
	dim.right  = bevelRight;
	dim.bottom = bevelBottom;
	dim.width  = w;
	dim.height = h;
};