'use strict';
var getCanvas      = require('./GetCanvas');
var CanvasRenderer = require('./main');
var filters        = require('./filters');
var blendModes     = require('./blendModes');

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
		b0 * t1[4] + d0 * t1[5] + f0
	];
}

function multiplyColors(parentColor, childColor) {
	// Mutliplying 2 colors:
	// mult = childColor.mult * parentColor.mult
	// add  = childColor.add  * parentColor.mult + parentColor.add
	return [
		childColor[0] * parentColor[0],
		childColor[1] * parentColor[1],
		childColor[2] * parentColor[2],
		childColor[3] * parentColor[3],
		childColor[4] * parentColor[0] + parentColor[4],
		childColor[5] * parentColor[1] + parentColor[5],
		childColor[6] * parentColor[2] + parentColor[6],
		// Clamping alpha addition between [-1, 1]
		Math.max(-1, Math.min(1, childColor[7] * parentColor[3] + parentColor[7]))
	];
}

function applyTint(context, tint, dim, bounds) {
	var left   = Math.max(dim.left, bounds.left);
	var top    = Math.max(dim.top,  bounds.top);
	var right  = Math.min(left + dim.width,  bounds.right);
	var bottom = Math.min(top  + dim.height, bounds.bottom);
	var width  = right  - left;
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

	for (var i = 0; i < nBytes; i += 4) {
		pixelData[i]     = Math.max(0, Math.min(pixelData[i]     * rm + ra, 255)); // red
		pixelData[i + 1] = Math.max(0, Math.min(pixelData[i + 1] * gm + ga, 255)); // green
		pixelData[i + 2] = Math.max(0, Math.min(pixelData[i + 2] * bm + ba, 255)); // blue

		// Alpha is managed using globalAlpha for performance purpose
		// n.b tints are applied only if a component red, green or blue differs from default
		// pixelData[i + 3] = Math.max(0, Math.min(pixelData[i + 3] * multA + addA, 255)); // alpha
	}

	context.putImageData(pixelBuffer, left, top);
}

CanvasRenderer.prototype._renderSymbol = function (globalCanvas, globalContext, parentTransform, parentColor, animData, frame, isMask) {
	/* jshint maxcomplexity: 50 */
	/* jshint maxstatements: 150 */
	var symbol = this._extractor._symbols[animData.id];
	if (!symbol) {
		// symbol not found in symbols!
		return;
	}

	// Rendering the first frame, thus getting data of index 0
	var transform      = animData.transforms[frame];
	var tint           = animData.colors[frame];
	var appliedFilters = animData.filters    ? animData.filters[frame]    : undefined;
	var blendMode      = animData.blendModes ? animData.blendModes[frame] : undefined;

	var duration = symbol.duration || 1;
	frame = frame % duration;

	var matrix = multiplyTransforms(parentTransform, transform);
	var color  = multiplyColors(parentColor, tint);

	// Checking for pixel operations
	var hasTint   = (tint[0] !== 1) || (tint[1] !== 1) || (tint[2] !== 1) || (tint[4] !== 0) || (tint[5] !== 0) || (tint[6] !== 0);
	var hasFilter = appliedFilters ? (appliedFilters.length > 0) : false;
	var hasBlend  = (blendMode && (2 <= blendMode && blendMode <= 14)) ? true : false;

	var hasPixelManipulation = hasTint || hasFilter || hasBlend;

	var localCanvas, localContext;
	if (hasPixelManipulation) {
		localCanvas  = getCanvas();
		localContext = localCanvas.getContext('2d');

		localCanvas.width  = globalCanvas.width;
		localCanvas.height = globalCanvas.height;
	} else {
		localCanvas  = globalCanvas;
		localContext = globalContext;
	}

	if (symbol.isAnimation) {
		var children = symbol.children;
		for (var c = children.length - 1; c >= 0; c -= 1) {
			var child = children[c];

			if (frame < child.frames[0] || child.frames[1] < frame || child.maskEnd) {
				// Child is not visible at given frame
				continue;
			}

			if (child.maskStart) {
				// Masking

				// Creating an intermediary canvas to apply the mask
				var maskCanvas  = getCanvas();
				var maskContext = maskCanvas.getContext('2d');

				maskCanvas.width  = localCanvas.width;
				maskCanvas.height = localCanvas.height;

				this._renderSymbol(maskCanvas, maskContext, matrix, color, child, frame - child.frames[0], true);

				var clipCanvas  = getCanvas();
				var clipContext = clipCanvas.getContext('2d');

				clipCanvas.width  = localCanvas.width;
				clipCanvas.height = localCanvas.height;

				// To support masked layers with blend mode
				clipContext.drawImage(localCanvas, 0, 0);

				// Rendering all the children that are meant to be clipped
				var clipDepth = child.clipDepth;
				while (!children[--c].maskEnd) {
					var clippedChild = children[c];
					if (clippedChild.frames[0] <= frame && frame <= clippedChild.frames[1]) {
						this._renderSymbol(clipCanvas, clipContext, matrix, color, clippedChild, frame - clippedChild.frames[0], isMask);
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
				this._renderSymbol(localCanvas, localContext, matrix, color, child, frame - child.frames[0], isMask);
			}
		}
	}

	if (symbol.isShape) {
		localContext.globalAlpha = Math.max(0, Math.min(color[3] + color[7], 1));

		// Transformation is applied within the drawshape function
		this._drawShapes(symbol.shapes, localCanvas, localContext, matrix, isMask);
	}

	if (symbol.isImage) {
		localContext.globalAlpha = Math.max(0, Math.min(color[3] + color[7], 1));
		localContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

		var image = this._images[symbol.id];
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
			width:  Math.ceil(right  - Math.floor(left)),
			height: Math.ceil(bottom - Math.floor(top))
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
			for (var f = 0; f < appliedFilters.length; f += 1) {
				var filter = appliedFilters[f];
				switch (filter.type) {
				case 'color matrix':
					filters.colorMatrix(localContext, filter, dim, bounds);
					break;
				case 'drop shadow':
					filters.dropShadow(localContext, filter, dim, bounds);
					break;
				case 'glow':
					filters.glow(localContext, filter, dim, bounds);
					break;
				case 'blur':
					filters.blur(localContext, filter, dim, bounds);
					break;
				case 'bevel':
					filters.bevel(localContext, filter, dim, bounds);
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

		if (hasBlend) {
			// Blends local canvas with parent canvas
			switch (blendMode) {
			case 2: // 2 = layer
				// Simple draw of local canvas into parent canvas
				globalContext.globalAlpha = 1;
				globalContext.setTransform(1, 0, 0, 1, 0, 0);
				globalContext.drawImage(localCanvas, 0, 0);
				break;
			case 3: // 3 = multiply
				blendModes.multiply(localContext, globalContext, dim, bounds);
				break;
			case 4: // 4 = screen
				blendModes.screen(localContext, globalContext, dim, bounds);
				break;
			case 5: // 5 = lighten
				blendModes.lighten(localContext, globalContext, dim, bounds);
				break;
			case 6:  // 6 = darken
				blendModes.darken(localContext, globalContext, dim, bounds);
				break;
			case 7: // 7 = difference
				blendModes.difference(localContext, globalContext, dim, bounds);
				break;
			case 8: // 8 = add
				blendModes.add(localContext, globalContext, dim, bounds);
				break;
			case 9: // 9 = subtract
				blendModes.substract(localContext, globalContext, dim, bounds);
				break;
			case 10: // 10 = invert
				blendModes.invert(localContext, globalContext, dim, bounds);
				break;
			case 11: // 11 = alpha
				blendModes.alpha(localContext, globalContext, dim, bounds);
				break;
			case 12: // 12 = erase
				blendModes.erase(localContext, globalContext, dim, bounds);
				break;
			case 13: // 13 = overlay
				blendModes.overlay(localContext, globalContext, dim, bounds);
				break;
			case 14: // 14 = hardlight
				blendModes.hardlight(localContext, globalContext, dim, bounds);
				break;
			default:
				// Should not happen
				console.log('[CanvasRenderer.renderSymbol] Applying invalid blend mode', blendMode);

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
