/* jslint node: true */
'use strict';
var Canvas          = require('canvas');
var FILTERS         = require('./FILTERS.js');
var BLENDINGS       = require('./BLENDINGS.js');
var SwfImgRenderer  = require('./SwfImgRenderer/index.js');
var BoxPartitioning = require('./BoxPartitioning.js');

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
	this.imgRenderer = new SwfImgRenderer();
	this.rendering   = false;

}
module.exports = CanvasRenderer;

CanvasRenderer.prototype.init = function (exporter, callback) {
	if (this.rendering === true) {
		console.warn('[CanvasRenderer.init] Could not start rendering because another rendering is pending');
		return;
	}

	this.exporter       = exporter;
	this.ratio          = exporter.fileGroupRatio;
	this.createAtlas    = exporter.createAtlas;
	this.frameByFrame   = exporter.renderFrames;
	this.firstFrameOnly = exporter.firstFrameOnly;
	this.powerOf2Images = exporter.powerOf2Images;
	this.maxImageDim    = exporter.maxImageDim;
	this.symbols        = exporter.symbols;
	this.symbolList     = exporter.symbolList;
	this.classGroupList = exporter.classGroupList;
	this.classRatios    = exporter.classRatios;
	this.fixedSize      = exporter.fixedSize;
	this.outlineCoeff   = 1 / (exporter.outlineEmphasis);
	
	this.callback       = callback;
	this.images         = {};

	this.nElemsToPrepare = 0;
	this.nElemsReady     = 0;
	this.rendering       = true;
};

CanvasRenderer.prototype.prepareImages = function (notifyImageAsReady) {

	var self = this;
	var onWrittenCallBack = function (imageData, imageBuffer) {
		var img = new Canvas.Image(); // Create a new Image
		img.src = imageBuffer;

		if (img.width > 0 && img.height > 0) {

			// Creating canvas for drawing the image
			var imageCanvas  = new Canvas();
			var imageContext = imageCanvas.getContext('2d');

			imageCanvas.width  = img.width;
			imageCanvas.height = img.height;

			self.images[imageData.id] = imageCanvas;

			imageContext.drawImage(img, 0, 0, img.width, img.height);
		} else {
			console.warn('[CanvasRenderer.prepareImages] Image is empty', imageData.id);
		}

		notifyImageAsReady();
	};

	// Creating the list of images
	var idString, imagesToPrepare = {};
	for (idString in this.symbolList) {
		var symbolId = this.symbolList[idString];
		var symbol   = this.symbols[symbolId];

		if (symbol.isImage) {
			imagesToPrepare[symbolId] = symbol.swfObject;
		}

		var images = symbol.images;
		if (images) {
			for (var i = 0; i < images.length; i += 1) {
				var imageData = images[i];
				imagesToPrepare[imageData.id] = imageData.image;
			}
		}
	}


	for (idString in imagesToPrepare) {
		this.nElemsToPrepare += 1;
		this.imgRenderer.render(imagesToPrepare[idString], onWrittenCallBack);
	}
};

// function transformInverse(m) {
// 	var a = m[0];
// 	var b = m[1];
// 	var c = 0;
// 	var d = m[2];
// 	var e = m[3];
// 	var f = 0;
// 	var g = m[4];
// 	var h = m[5];
// 	var i = 1;

// 	var c11 = e * i - h * f;
// 	var c21 = -(b * i - h * c);
// 	var c31 = b * f - e * c;
// 	var c12 = -(d * i - g * f);
// 	var c22 = a * i - g * c;
// 	var c32 = -(a * f - d * c);
// 	var c13 = d * h - g * e;
// 	var c23 = -(a * h - g * b);
// 	var c33 = a * e - d * b;

// 	var det = a * c11 + b * c12 + c * c13;

// 	return [
// 		c11 / det,
// 		c21 / det,
// 		c31 / det,
// 		c12 / det,
// 		c22 / det,
// 		c32 / det,
// 		c13 / det,
// 		c23 / det,
// 		c33 / det
// 	];
// }

function transformPoint(t, x, y) {
	return {
		x: t[0] * x + t[2] * y + t[4],
		y: t[1] * x + t[3] * y + t[5]
	};
}

function multiplyTransforms(t0, t1) {
	var a0 = t0[0];
	var b0 = t0[1];
	var c0 = t0[2];
	var d0 = t0[3];
	var e0 = t0[4];
	var f0 = t0[5];

	return [
		a0 * t1[0] + c0 * t1[1],
		b0 * t1[0] + d0 * t1[1],
		a0 * t1[2] + c0 * t1[3],
		b0 * t1[2] + d0 * t1[3],
		a0 * t1[4] + c0 * t1[5] + e0,
		b0 * t1[4] + d0 * t1[5] + f0,
	];
}

function multiplyColors(parentColor, childColor) {
	return [
		childColor[0] * parentColor[0],
		childColor[1] * parentColor[1],
		childColor[2] * parentColor[2],
		childColor[3] * parentColor[3],
		childColor[4] * parentColor[0] + parentColor[4],
		childColor[5] * parentColor[1] + parentColor[5],
		childColor[6] * parentColor[2] + parentColor[6],
		Math.max(-1, Math.min(1, childColor[7] * parentColor[3] + parentColor[7]))
	];
}

CanvasRenderer.prototype.drawShapes = function (shapes, context, transform, isMask) {
	/* jslint maxstatements: 100 */

	for (var idx = 0; idx < shapes.length; idx += 1) {
		var idxFills = shapes[idx].fills;
		var idxLines = shapes[idx].lines;

		for (var f = 1; f < idxFills.length; f += 1) {
			this.fillShape(context, idxFills[f], transform, isMask);
		}

		for (var l = 1; l < idxLines.length; l += 1) {
			this.outlineShape(context, idxLines[l], transform, isMask);
		}
	}
};

CanvasRenderer.prototype.createPath = function (context, shape, transform, pixelHinting) {
	context.beginPath();
	var p, seg;
	var point1, point2;
	for (var s = 0; s < shape.length; s += 1) {
		var path = shape[s].records;
		if (pixelHinting) {
			// Pixel hinting, all the values have to be rounded
			point1 = transformPoint(transform, path[0].x1 / 20, path[0].y1 / 20);
			context.moveTo(Math.round(point1.x), Math.round(point1.y));
			for (p = 0; p < path.length; p += 1) {
				seg = path[p];
				point2 = transformPoint(transform, seg.x2 / 20, seg.y2 / 20);
				if (seg.c) {
					point1 = transformPoint(transform, seg.cx / 20, seg.cy / 20);
					context.quadraticCurveTo(Math.round(point1.x), Math.round(point1.y), Math.round(point2.x), Math.round(point2.y));
				} else {
					context.lineTo(Math.round(point2.x), Math.round(point2.y));
				}
			}
		} else {
			point1 = transformPoint(transform, path[0].x1 / 20, path[0].y1 / 20);
			context.moveTo(point1.x, point1.y);
			for (p = 0; p < path.length; p += 1) {
				seg = path[p];
				point2 = transformPoint(transform, seg.x2 / 20, seg.y2 / 20);
				if (seg.c) {
					point1 = transformPoint(transform, seg.cx / 20, seg.cy / 20);
					context.quadraticCurveTo(point1.x, point1.y, point2.x, point2.y);
				} else {
					context.lineTo(point2.x, point2.y);
				}
			}
		}
	}
};

var GRADIENT_LENGTH = 820 / 20;
CanvasRenderer.prototype.outlineShape = function (context, shape, transform, isMask) {
	if (shape.length === 0) {
		return;
	}

	var line = shape[0].lineStyle;
	if (!line) {
		return;
	}

	var pixelHinting = (line === undefined) ? false : ((line.pixelHinting === undefined) ? false : line.pixelHinting);
	this.createPath(context, shape, transform, pixelHinting);

	var s, color, alpha, scale;

	context.save();

	if (line.capStart) {
		context.lineCap = line.capStart.toLowerCase();
	}

	if (line.join) {
		context.lineJoin = line.join.toLowerCase();
	}

	if (line.fill === undefined) {
		// In Flash, lines cannot look smaller than with a width of 1
		// Line width has to vary with transformation matrix
		scale = 1;
		if (!line.noHScale) {
			var scaleX = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
			var scaleY = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
			scale = 0.5 * (scaleX + scaleY);
		}
		context.lineWidth = Math.max(line.width * scale, 1);

		color = line.color;
		alpha = isMask ? 1 : ((color.alpha === undefined) ? 1 : color.alpha);
		context.strokeStyle = 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, this.outlineCoeff) + ')';
	} else {
		var fill = line.fill;
		var matrix = fill.matrix;
		var stops  = fill.stops;

		transform = multiplyTransforms(transform, [matrix.scaleX, matrix.skewX, matrix.skewY, matrix.scaleY, matrix.moveX / 20, matrix.moveY / 20]);

		scale = 1;
		if (!line.noHScale) {
			var scaleX = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
			var scaleY = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
			scale = 0.5 * (scaleX + scaleY);
		}
		context.lineWidth = Math.max(line.width, 1) / scale;
		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);

		var gradient;
		switch (fill.type) {
		case 'focal-radial':
			// focal radial not supported yet -> to verify but seems not feasible in canvas
			// replaced by regular radial
		case 'radial':
			gradient = context.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_LENGTH);
			break;
		case 'linear':
			gradient = context.createLinearGradient(- GRADIENT_LENGTH, 0, GRADIENT_LENGTH, 0);
			break;
		}

		for (s = 0; s < stops.length; s += 1) {
			var stop  = stops[s];
			color = stop.color;

			// TODO: remove multiplication with globalAlpha when node canvas has fixed the issue
			alpha = ((color.alpha === undefined) ? 1 : color.alpha) * context.globalAlpha;
			gradient.addColorStop(stop.offset, 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, this.outlineCoeff) + ')');
		}
		context.strokeStyle = gradient;
	}

	context.stroke();
	context.restore();
};

CanvasRenderer.prototype.fillShape = function (context, shape, transform, isMask) {
	if (shape.length === 0) {
		return;
	}

	var fill = shape[0].fillStyle;
	if (!fill) {
		return;
	}

	this.createPath(context, shape, transform, false);

	var s, color, alpha, matrix;

	context.save();
	if (fill.type === undefined) {
		alpha = isMask ? 1 : ((fill.alpha === undefined) ? 1 : fill.alpha);
		context.fillStyle = 'rgba(' + fill.red + ',' + fill.green + ',' + fill.blue + ',' + alpha + ')';
		context.fill();
	} else if (fill.type === 'pattern') {
		matrix = fill.matrix;
		// TODO: place images on shape to get rid of "this"
		var image = this.images[fill.image.id];

		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);

		// Image size are in pixels, being displayed in a space where the measurement unit is a twip
		// all its transformation matrix attributes are 20 times what they should be in pixels
		context.transform(matrix.scaleX / 20, matrix.skewX / 20, matrix.skewY / 20, matrix.scaleY / 20, matrix.moveX / 20, matrix.moveY / 20);

		context.drawImage(image, 0, 0, image.width, image.height);
	} else {
		matrix = fill.matrix;
		var stops = fill.stops;

		// var inverse = transformInverse(transform);
		// context.transform(inverse[0], inverse[1], inverse[3], inverse[4], inverse[6], inverse[7]);
		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);
		context.transform(matrix.scaleX, matrix.skewX, matrix.skewY, matrix.scaleY, matrix.moveX / 20, matrix.moveY / 20);

		var gradient;
		switch (fill.type) {
		case 'focal-radial':
			// focal radial not supported yet -> to verify but seems not feasible in canvas
			// replaced by regular radial
		case 'radial':
			gradient = context.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_LENGTH);
			break;
		case 'linear':
			gradient = context.createLinearGradient(- GRADIENT_LENGTH, 0, GRADIENT_LENGTH, 0);
			break;
		}

		for (s = 0; s < stops.length; s += 1) {
			var stop  = stops[s];
			color = stop.color;

			// TODO: remove multiplication with globalAlpha when node canvas has fixed the issue
			alpha = ((color.alpha === undefined) ? 1 : color.alpha) * context.globalAlpha;
			gradient.addColorStop(stop.offset, 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + alpha + ')');
		}

		context.fillStyle = gradient;
		context.fill();
	}

	context.restore();
};

function applyTint(context, tint, dim, bounds) {
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

	var rm = tint[0];
	var gm = tint[1];
	var bm = tint[2];

	var ra = tint[4] * 255;
	var ga = tint[5] * 255;
	var ba = tint[6] * 255;

	// console.log('applying tint', multR, multG, multB, addR, addG, addB);

	for (var i = 0; i < nBytes; i += 4) {
		pixelData[i]     = ~~ Math.max(0, Math.min(pixelData[i]     * rm + ra, 255)); // red
		pixelData[i + 1] = ~~ Math.max(0, Math.min(pixelData[i + 1] * gm + ga, 255)); // green
		pixelData[i + 2] = ~~ Math.max(0, Math.min(pixelData[i + 2] * bm + ba, 255)); // blue

		// Alpha is managed using globalAlpha for performance purpose
		// n.b tints are applied only if a component red, green or blue differs from default
		// pixelData[i + 3] = ~~ Math.max(0, Math.min(pixelData[i + 3] * multA + addA, 255)); // alpha
	}

	context.putImageData(pixelBuffer, left, top);
}

CanvasRenderer.prototype.renderSymbol = function (globalCanvas, globalContext, parentTransform, parentColor, animData, frame, isMask) {
	/* jshint maxcomplexity: 50 */
	/* jshint maxstatements: 150 */
	var symbol = this.symbols[animData.id];
	if (!symbol) {
		// symbol not found in symbols!
		return;
	}

	// Rendering the first frame, thus getting data of index 0
	var transform = animData.matrices[frame];
	var tint      = animData.colors[frame];
	var filters   = animData.filters   ? animData.filters[frame]   : undefined;
	var blendMode = animData.blendings ? animData.blendings[frame] : undefined;
	
	var n = 1; // TODO: consider number of iterations
	var duration = symbol.duration || 1;
	if (frame < n * duration) {
		frame = frame % duration;
	} else {
		frame = duration - 1;
	}

	var matrix = multiplyTransforms(parentTransform, transform);
	var color  = multiplyColors(parentColor, tint);

	// Checking for pixel operations
	var hasTint   = (tint[0] !== 1) || (tint[1] !== 1) || (tint[2] !== 1) || (tint[4] !== 0) || (tint[5] !== 0) || (tint[6] !== 0);
	var hasFilter = filters ? (filters.length > 0) : false;
	var hasBlend  = (blendMode && (3 <= blendMode && blendMode <= 14)) ? true : false;

	var hasPixelManipulation = hasTint || hasFilter || hasBlend;

	var localCanvas, localContext;
	if (hasPixelManipulation) {
		localCanvas  = new Canvas();
		localContext = localCanvas.getContext('2d');

		localCanvas.width  = globalCanvas.width;
		localCanvas.height = globalCanvas.height;
	} else {
		localCanvas  = globalCanvas;
		localContext = globalContext;
	}

	if (symbol.isAnim) {
		var children = symbol.children;
		for (var c = children.length - 1; c >= 0; c -= 1) {
			var child = children[c];

			if (frame < child.frames[0] || child.frames[1] < frame || child.maskEnd) {
				// child is not visible at given frame
				continue;
			}

			if (child.maskStart) {
				// Managing masking layer

				// Creating an intermediary canvas to apply the mask
				var maskCanvas  = new Canvas();
				var maskContext = maskCanvas.getContext('2d');

				maskCanvas.width  = localCanvas.width;
				maskCanvas.height = localCanvas.height;

				this.renderSymbol(maskCanvas, maskContext, matrix, color, child, frame - child.frames[0], true);

				var clipCanvas  = new Canvas();
				var clipContext = clipCanvas.getContext('2d');

				clipCanvas.width  = localCanvas.width;
				clipCanvas.height = localCanvas.height;

				// Rendering all the children that are meant to be clipped
				var clipDepth = child.clipDepth;
				while (!children[--c].maskEnd) {
					var clippedChild = children[c];
					if (clippedChild.frames[0] <= frame && frame <= clippedChild.frames[1]) {
						this.renderSymbol(clipCanvas, clipContext, matrix, color, clippedChild, frame - clippedChild.frames[0], isMask);
					}
				}

				// Setting the global composite operation that is equivalent to applying a mask
				clipContext.globalCompositeOperation = 'destination-in';

				// Applying mask
				clipContext.globalAlpha = 1;
				clipContext.setTransform(1, 0, 0, 1, 0, 0);
				clipContext.drawImage(maskCanvas, 0, 0);

				// Rendering clipped elements onto final canvas
				localContext.globalAlpha = 1;
				localContext.setTransform(1, 0, 0, 1, 0, 0);
				localContext.drawImage(clipCanvas, 0, 0);
			} else {
				this.renderSymbol(localCanvas, localContext, matrix, color, child, frame - child.frames[0], isMask);
			}
		}
	}

	if (symbol.isShape) {
		localContext.globalAlpha = Math.max(0, Math.min(color[3] + color[7], 1));
		// localContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

		// Transformation is applied within the drawshape function
		this.drawShapes(symbol.shapes, localContext, matrix, isMask);
	}

	if (symbol.isImage) {
		localContext.globalAlpha = Math.max(0, Math.min(color[3] + color[7], 1));
		localContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

		var image = this.images[symbol.id];
		if (isMask) {
			// If it is a mask, the rendered image should be a completely opaque rectangle
			localContext.globalAlpha = 1;
			localContext.fillStyle = '#ffffff';
			localContext.fillRect(0, 0, image.width, image.height);
		} else {
			localContext.drawImage(image, 0, 0, image.width, image.height);
		}
	}

	if (hasPixelManipulation) {
		// var bbox = symbol.bounds || symbol.boundsPerFrame[frame];
		var bbox = symbol.bounds[frame];
		if (!bbox) {
			// console.warn(symbol.id, 'has no bounds!');
			return;
		}

		var l = bbox.left;
		var r = bbox.right;
		var t = bbox.top;
		var b = bbox.bottom;

		var ax = l * matrix[0] + t * matrix[2] + matrix[4];
		var ay = l * matrix[1] + t * matrix[3] + matrix[5];

		var bx = r * matrix[0] + t * matrix[2] + matrix[4];
		var by = r * matrix[1] + t * matrix[3] + matrix[5];

		var cx = l * matrix[0] + b * matrix[2] + matrix[4];
		var cy = l * matrix[1] + b * matrix[3] + matrix[5];

		var dx = r * matrix[0] + b * matrix[2] + matrix[4];
		var dy = r * matrix[1] + b * matrix[3] + matrix[5];

		// Bounding box is defined by left, top, right, bottom
		var left   = Math.min(Math.min(ax, bx), Math.min(cx, dx));
		var right  = Math.max(Math.max(ax, bx), Math.max(cx, dx));
		var top    = Math.min(Math.min(ay, by), Math.min(cy, dy));
		var bottom = Math.max(Math.max(ay, by), Math.max(cy, dy));

		// Minimum area on which to apply pixel manipulation
		var dim = {
			left:   Math.floor(left),
			top:    Math.floor(top),
			right:  Math.ceil(right),
			bottom: Math.ceil(bottom),
			width:  Math.ceil(right - left),
			height: Math.ceil(bottom - top)
		};

		// Boundaries of the canvas on which to apply pixel manipulations
		var bounds = {
			left:   0,
			top:    0,
			right:  localCanvas.width,
			bottom: localCanvas.height,
			width:  localCanvas.width,
			height: localCanvas.height
		};

		// if (false) {
		if (hasFilter) {
			// Applying filters in reverse order
			for (var f = filters.length - 1; f >= 0; f -= 1) {
				var filter = filters[f];
				switch (filter.type) {
				case 'color matrix':
					FILTERS.colorMatrix(localContext, filter, dim, bounds);
					break;
				case 'drop shadow':
					FILTERS.dropShadow(localContext, filter, dim, bounds);
					break;
				case 'glow':
					FILTERS.glow(localContext, filter, dim, bounds);
					break;
				case 'blur':
					FILTERS.blur(localContext, filter, dim, bounds);
					break;
				default:
					console.warn('CanvasRenderer.renderSymbol: filter', filter.type, 'not supported');
				}
			}
		}

		// if (false) {
		if (hasTint) {
			applyTint(localContext, tint, dim, bounds);
		}

		// if (false) {
		if (hasBlend) {
			// Blends local canvas with parent canvas
			switch (blendMode) {
			case 3: // 3 = multiply
				BLENDINGS.multiply(localContext, globalContext, dim, bounds);
				break;
			case 5: // 5 = lighten
				BLENDINGS.lighten(localContext, globalContext, dim, bounds);
				break;
			case 6:  // 6 = darken
				BLENDINGS.darken(localContext, globalContext, dim, bounds);
				break;
			case 7: // 7 = difference
				BLENDINGS.difference(localContext, globalContext, dim, bounds);
				break;
			case 8: // 8 = add
				BLENDINGS.add(localContext, globalContext, dim, bounds);
				break;
			case 9: // 9 = subtract
				BLENDINGS.substract(localContext, globalContext, dim, bounds);
				break;
			case 10: // 10 = invert
				BLENDINGS.invert(localContext, globalContext, dim, bounds);
				break;
			case 13: // 13 = overlay
				BLENDINGS.overlay(localContext, globalContext, dim, bounds);
				break;
			case 14: // 14 = hardlight
				BLENDINGS.hardlight(localContext, globalContext, dim, bounds);
				break;
			case 2: // 2 = layer
				// Draw local canvas into parent canvas
				globalContext.globalAlpha = 1;
				globalContext.setTransform(1, 0, 0, 1, 0, 0);
				globalContext.drawImage(localCanvas, 0, 0);
				break;
			default:
			// case 4:  // 4 = screen
			// case 11: // 11 = alpha
			// case 12: // 12 = erase
			// case 1:  // 0 or 1 = normal
				console.log('CanvasRenderer.renderSymbol: blend mode', blendMode, 'not supported');

				// Draw local canvas into parent canvas
				globalContext.globalAlpha = 1;
				globalContext.setTransform(1, 0, 0, 1, 0, 0);
				globalContext.drawImage(localCanvas, 0, 0);
				break;
			}
		} else {
			// Draw local canvas into parent canvas
			globalContext.globalAlpha = 1;
			globalContext.setTransform(1, 0, 0, 1, 0, 0);
			globalContext.drawImage(localCanvas, 0, 0);
		}
	}

};

function nextHighestPowerOfTwo(x) {
	--x;
	for (var i = 1; i < 32; i <<= 1) {
		x = x | x >> i;
	}
	return x + 1;
}

var MAX_ATLAS_DIM = 2048;
CanvasRenderer.prototype.computeAtlasLayout = function (graphicDims) {

	/* jshint maxstatements: 50 */
	var id, graphicDim;

	// Computing total area taken by the graphics
	var totalArea = 0;
	var nGraphics = 0;
	for (id in graphicDims) {
		graphicDim = graphicDims[id];
		totalArea += (graphicDim.sw + 2 * graphicDim.margin) * (graphicDim.sh + 2 * graphicDim.margin);
		nGraphics += 1;
	}
	var sqrSide = Math.sqrt(totalArea);

	// Populating list of elements 
	var elements = [];
	for (id in graphicDims) {
		elements.push(graphicDims[id]);
	}

	var alpha, beta;
	function cmpFunc(a, b) {
		return alpha * (b.w * b.h) + beta * Math.max(b.w / b.h, b.h / b.w) - (alpha * (a.w * a.h) + beta * Math.max(a.w / a.h, a.h / a.w));
	}

	var bestPartitioning = null;
	var bestOccupiedArea = Infinity;
	var alphaValues = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
	var priorityZones = [
		{ left: 0, right: 0,               top: 0, bottom: 0 },
		{ left: 0, right: sqrSide / 4,     top: 0, bottom: sqrSide / 4 },
		{ left: 0, right: sqrSide / 3,     top: 0, bottom: sqrSide / 3 },
		{ left: 0, right: sqrSide / 2,     top: 0, bottom: sqrSide / 2 },
		{ left: 0, right: 2 * sqrSide / 3, top: 0, bottom: 2 * sqrSide / 3 },
		{ left: 0, right: sqrSide,         top: 0, bottom: sqrSide }
	];

	var bestLowerBound = 0;
	var bestAlpha = 0;
	for (var l = 0; l < priorityZones.length; l += 1) {
		var priorityZone = priorityZones[l];
		for (var a = 0; a < alphaValues.length; a += 1) {
			alpha = alphaValues[a];
			beta = 1 - alpha;

			elements.sort(cmpFunc);
			var boxPartioning = new BoxPartitioning({ left: 0, right: MAX_ATLAS_DIM, top: 0, bottom: MAX_ATLAS_DIM }, priorityZone);

			for (var e = 0; e < elements.length; e += 1) {
				var element = elements[e];
				// Adding margin on 4 sides of the element
				boxPartioning.add(element, element.sw + 2 * graphicDim.margin, element.sh + 2 * graphicDim.margin);
			}

			var occupiedArea = boxPartioning.occupiedBounds.a;
			if (this.powerOf2Images) {
				occupiedArea = nextHighestPowerOfTwo(boxPartioning.occupiedBounds.w) * nextHighestPowerOfTwo(boxPartioning.occupiedBounds.h);
			}

			if ((boxPartioning.nRejections === 0) && ((bestPartitioning === null) || (occupiedArea < bestOccupiedArea))) {
				bestPartitioning = boxPartioning;
				bestOccupiedArea = occupiedArea;
				bestLowerBound = l;
				bestAlpha = a;
			}
		}
	}

	if (bestPartitioning === null) {
		return;
	}

	var graphicBoxes = bestPartitioning.occupiedSpace;

	for (var g = 0; g < graphicBoxes.length; g += 1) {
		var graphicBox = graphicBoxes[g];
		graphicDim = graphicBox.e;

		// Computing position of element on the atlas with respect to its margin
		graphicDim.sx = graphicBox.l + graphicDim.margin;
		graphicDim.sy = graphicBox.t + graphicDim.margin;
	}

	return { width: bestPartitioning.occupiedBounds.w, height: bestPartitioning.occupiedBounds.h };
}

CanvasRenderer.prototype.renderAtlas = function (graphicCanvasses, graphicDims) {
	var atlasDim = this.computeAtlasLayout(graphicDims);
	if (!atlasDim) {
		return;
	}

	if (atlasDim.width === 0 || atlasDim.height === 0) {
		var emptyCanvas = new Canvas();
		emptyCanvas.width  = 0;
		emptyCanvas.height = 0;
		return emptyCanvas;
	}

	// Drawing each graphical element into atlas
	var atlas   = new Canvas();
	var context = atlas.getContext('2d');

	atlas.width  = this.powerOf2Images? nextHighestPowerOfTwo(atlasDim.width)  : atlasDim.width;
	atlas.height = this.powerOf2Images? nextHighestPowerOfTwo(atlasDim.height) : atlasDim.height;

	var showEmptySpace = false;
	var showBounds     = false;
	if (showEmptySpace) {
		context.fillStyle = '#cc3333';
		context.fillRect(0, 0, atlas.width, atlas.height);
	}

	for (var id in graphicCanvasses) {
		var graphicCanvas = graphicCanvasses[id];
		var dimensions    = graphicDims[id];

		// Clearing empty space
		if (showEmptySpace) {
			context.clearRect(dimensions.sx - 1, dimensions.sy - 1, dimensions.sw + 2, dimensions.sh + 2);
		}

		context.drawImage(graphicCanvas, dimensions.sx, dimensions.sy);

		if (showBounds) {
			context.fillStyle = '#000000';
			context.lineWidth = 1;
			context.fillText(id, dimensions.sx + 2, dimensions.sy + 0.6 * dimensions.sh);

			context.strokeStyle = '#cc3333';
			context.strokeRect(dimensions.sx, dimensions.sy, dimensions.sw, dimensions.sh);

			context.strokeStyle = '#33cc33';
			context.strokeRect(dimensions.sx + 1, dimensions.sy + 1, dimensions.sw - 2, dimensions.sh - 2);
		}
	}

	return atlas;
};

CanvasRenderer.prototype.getMaxDimensions = function (graphics) {
	var graphicsMaxDims = {};
	var classRatios     = this.classRatios || {};
	var hasFixedSize    = this.fixedSize !== undefined;

	// Updating class ratios with respect to the fixed size dimension
	if (hasFixedSize) {
		
		var classRatiosTmp = {};
		var fixedWidth     = this.fixedSize.width;
		var fixedHeight    = this.fixedSize.height;

		var width, height;
		for (var className in this.classGroupList) {
			var classId = this.classGroupList[className];
			var symbol  = this.symbols[classId];

			// TODO: get max bounds from all frames
			var bounds = symbol.bounds[0];
			if (bounds) {
				width  = bounds.right  - bounds.left;
				height = bounds.bottom - bounds.top;
			} else {
				width  = fixedWidth;
				height = fixedHeight;
			}

			classRatiosTmp[className] = (classRatios[className] ? classRatios[className] : 1) * Math.min(fixedWidth / width, fixedHeight / height);
		}
		classRatios = classRatiosTmp;
	}

	var maxDimForClass, classRatio;
	for (var id in graphics) {
		var graphic   = graphics[id];
		var maxWidth  = 0;
		var maxHeight = 0;
		var maxDims   = graphic.maxDims;
		for (var className in this.classGroupList) {

			maxDimForClass = maxDims[className];
			classRatio = classRatios[className] || 1;

			if (maxDimForClass) {
				maxWidth  = Math.max(maxWidth,  classRatio * maxDimForClass.width);
				maxHeight = Math.max(maxHeight, classRatio * maxDimForClass.height);
			}
		}

		graphicsMaxDims[id] = { width: maxWidth, height: maxHeight };
	}

	return graphicsMaxDims;
};

var MARGIN = 1;
CanvasRenderer.prototype.setGraphicDimensions = function (graphics, graphicMaxDims) {

	var graphicDims = {};
	for (var id in graphics) {
		var graphic = graphics[id];

		// Computing element dimension before scaling to ratio
		var bounds = graphic.bounds[0];

		var x, y, w, h;
		if (graphic.isImage) {
			var image = this.images[id];
			x = 0;
			y = 0;
			w = image.width;
			h = image.height;
		} else {
			x = bounds.left;
			y = bounds.top;
			w = bounds.right  - bounds.left;
			h = bounds.bottom - bounds.top;
		}

		// Computing graphic ratio for rendering
		var graphicRatio = this.ratio;

		// Reducing the size of the element if it is bigger than the maximum allowed dimension
		var graphicMaxDim = graphicMaxDims[id];
		var maxWidth  = graphicMaxDim.width;
		var maxHeight = graphicMaxDim.height;

		var graphicWidth;
		var graphicHeight;
		if (maxWidth === 0 || maxHeight === 0) {
			graphicRatio  = 0;
			graphicWidth  = 1;
			graphicHeight = 1;
		} else {
			var widthRatio   = w / maxWidth;
			var heightRatio  = h / maxHeight;

			if (widthRatio > heightRatio) {
				graphicRatio /= widthRatio;
			} else {
				graphicRatio /= heightRatio;
			}

			graphicWidth  = Math.ceil(w * graphicRatio);
			graphicHeight = Math.ceil(h * graphicRatio);

			var ratioToMaxDim = Math.sqrt((this.maxImageDim * this.maxImageDim) / (graphicWidth * graphicHeight));
			if (ratioToMaxDim < 1) {
				graphicWidth  *= ratioToMaxDim;
				graphicHeight *= ratioToMaxDim;
				graphicRatio  *= ratioToMaxDim;
			}
		}

		// Saving element position and dimension in the atlas
		graphicDims[id] = {
			x: x,
			y: y,
			w: w,
			h: h,
			sx: 0,
			sy: 0,
			sw: graphicWidth,
			sh: graphicHeight,
			dx: x * graphicRatio,
			dy: y * graphicRatio,
			ratio: graphicRatio,
			margin: MARGIN
		};
	}

	return graphicDims;
};

function getGraphicsToRender(symbols, symbolList, images) {
	var graphics = {};
	for (var idString in symbolList) {
		var symbolId = symbolList[idString];
		var symbol   = symbols[symbolId];
		if (symbol.isGraphic) {
			if (symbol.isImage) {
				var image = images[idString];
				if (!image) {
					console.warn('[CanvasRenderer.getGraphicsToRender] Graphic image not rendered', idString);
					continue;
				}
			}
			graphics[symbolId] = symbol;
		}
	}
	return graphics;
}

CanvasRenderer.prototype.renderGraphics = function (graphics, graphicDims, canvasses) {
	for (var id in graphics) {
		var canvas  = new Canvas();
		var context = canvas.getContext('2d');

		var graphic    = graphics[id];
		var dimensions = graphicDims[id];

		canvas.width  = dimensions.sw;
		canvas.height = dimensions.sh;

		if (graphic.isShape) {
			var transform = [dimensions.ratio, 0, 0, dimensions.ratio, - dimensions.dx, - dimensions.dy];
			this.drawShapes(graphic.shapes, context, transform);
		}

		if (graphic.isImage) {
			var image = this.images[id];
			if (!image) {
				continue;
			}

			context.drawImage(image, - dimensions.dx, - dimensions.dy, dimensions.sw, dimensions.sh);
		}

		canvasses[id] = canvas;
	}
};

CanvasRenderer.prototype.renderFrames = function (canvasses, graphicProperties) {
	var identityMatrix = [1, 0, 0, 1, 0, 0];
	var identityColor  = [1, 1, 1, 1, 0, 0, 0, 0];

	for (var className in this.classGroupList) {
		var classId   = this.classGroupList[className];
		var symbol    = this.symbols[classId];
		var ratio     = this.ratio;
		var fixedSize = this.fixedSize;

		if (symbol.isAnim) {
			var duration     = this.firstFrameOnly ? 1 : symbol.duration;
			var animColors   = [];
			var animMatrices = [];
			var classAnim    = { id: classId, colors: animColors, matrices: animMatrices };

			var bounds = symbol.containerBounds || symbol.bounds;
			if (!bounds) {
				continue;
			}

			for (var f = 0; f < duration; f += 1) {
				var canvas  = new Canvas();
				var context = canvas.getContext('2d');

				var frameBounds = bounds[f];
				if (!frameBounds) {
					continue;
				}

				var x = frameBounds.left;
				var y = frameBounds.top;
				var w = frameBounds.right  - frameBounds.left;
				var h = frameBounds.bottom - frameBounds.top;

				var ratioW = ratio;
				var ratioH = ratio;
				if (fixedSize) {
					ratioW *= fixedSize.width  / w;
					ratioH *= fixedSize.height / h;
				}

				canvas.width  = Math.ceil(ratioW * w);
				canvas.height = Math.ceil(ratioH * h);

				if (canvas.width === 0 || canvas.height === 0) {
					continue;
				}

				animColors[f]   = identityColor;
				animMatrices[f] = [ratioW, 0, 0, ratioH, - ratioW * frameBounds.left, - ratioH * frameBounds.top, 1];
				this.renderSymbol(canvas, context, identityMatrix, identityColor, classAnim, f, false);

				var canvasName = this.firstFrameOnly ? symbol.className : symbol.frameNames[f];
				canvasses[canvasName] = canvas;
				graphicProperties[symbol.frameNames[f]] = {
					x: x,
					y: y,
					w: w,
					h: h,
					sx: 0,
					sy: 0,
					sw: canvas.width,
					sh: canvas.height,
					margin: 0
				};
			}
		}
	}
};

CanvasRenderer.prototype.renderImages = function (retry) {
	var imageList = [];
	var canvasses = {};
	var graphicProperties = {};

	if (this.frameByFrame) {
		this.renderFrames(canvasses, graphicProperties);
	} else {
		// 1 - Generating list of graphics to render
		var graphics = getGraphicsToRender(this.symbols, this.symbolList, this.images);

		// 2 - Computing minimum rendering size that will guarantee lossless quality for each graphic
		var graphicMaxDims = this.getMaxDimensions(graphics);

		// 3 - Computing graphic dimensions for rendering into atlas
		graphicProperties = this.setGraphicDimensions(graphics, graphicMaxDims);

		// 4 - Rendering graphics in canvasses
		this.renderGraphics(graphics, graphicProperties, canvasses);
	}

	if (this.createAtlas) {
		var atlas = this.renderAtlas(canvasses, graphicProperties);
		if (atlas) {
			imageList = [{ img: atlas, name: 'atlas' }];
		} else {
			// Atlas could not be extracted at current ratio
			// Reducing extraction ratio and attempting rendering once more
			this.ratio *= 0.9;
			return this.renderImages(true);
		}

		if (retry) {
			console.warn(
				'[CanvasRenderer.renderImages] Atlas created with ratio ' + this.ratio
				+ ' because it did not fit in a ' + MAX_ATLAS_DIM + ' px x ' + MAX_ATLAS_DIM + ' px image.'
				+ '(Group ' + this.exporter.groupName + '. Class ' + this.exporter.className + ')'
			);
		}
			
	} else {
		// TODO: manage case when images should be exported with power of 2 dimensions
		// if (this.powerOf2Images) {
		// 	augmentToNextPowerOf2(canvasses);
		// }
		for (var imageName in canvasses) {
			imageList.push({ name: imageName, img: canvasses[imageName] });
		}
	}

	this.rendering = false;
	if (this.callback) {
		this.callback(imageList, graphicProperties);
	}

};

CanvasRenderer.prototype.notifyElementAsReady = function () {
	this.nElemsReady += 1;
	if (this.nElemsReady === this.nElemsToPrepare) {
		this.renderImages();
	}
};

CanvasRenderer.prototype.renderSymbols = function (exporter, cb) {
	this.init(exporter, cb);
	this.nElemsToPrepare = 1;

	var self = this;
	var notifyImageAsReady = function () {
		self.notifyElementAsReady();
	};

	// Prerendering images into canvasses
	this.prepareImages(notifyImageAsReady);
	this.notifyElementAsReady();
};

