'use strict';
var CanvasRenderer = require('./main');

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

CanvasRenderer.prototype._drawShapes = function (shapes, context, transform, isMask) {
	for (var idx = 0; idx < shapes.length; idx += 1) {
		var fills = shapes[idx].fills;
		var lines = shapes[idx].lines;

		for (var f = 1; f < fills.length; f += 1) {
			this._fillShape(context, fills[f], transform, isMask);
		}

		for (var l = 1; l < lines.length; l += 1) {
			this._outlineShape(context, lines[l], transform, isMask);
		}
	}
};

CanvasRenderer.prototype._createPath = function (context, shape, transform, pixelHinting) {
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
CanvasRenderer.prototype._outlineShape = function (context, shape, transform, isMask) {
	if (shape.length === 0) {
		return;
	}

	var line = shape[0].lineStyle;
	if (!line) {
		return;
	}

	var pixelHinting = (line === undefined) ? false : ((line.pixelHinting === undefined) ? false : line.pixelHinting);
	this._createPath(context, shape, transform, pixelHinting);

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
		// Line width has to adjust to the transformation matrix
		scale = 1;
		if (!line.noHScale) {
			var scaleX = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
			var scaleY = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
			scale = 0.5 * (scaleX + scaleY);
		}
		context.lineWidth = Math.max(line.width * scale, 1);

		color = line.color;
		alpha = isMask ? 1 : ((color.alpha === undefined) ? 1 : color.alpha);
		context.strokeStyle = 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, this._outlineCoeff) + ')';
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
			gradient.addColorStop(stop.offset, 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, this._outlineCoeff) + ')');
		}
		context.strokeStyle = gradient;
	}

	context.stroke();
	context.restore();
};

CanvasRenderer.prototype._fillShape = function (context, shape, transform, isMask) {
	if (shape.length === 0) {
		return;
	}

	var fill = shape[0].fillStyle;
	if (!fill) {
		return;
	}

	this._createPath(context, shape, transform, false);

	var s, color, alpha, matrix;

	context.save();
	if (fill.type === undefined) {
		alpha = isMask ? 1 : ((fill.alpha === undefined) ? 1 : fill.alpha);
		context.fillStyle = 'rgba(' + fill.red + ',' + fill.green + ',' + fill.blue + ',' + alpha + ')';
		context.fill();
	} else if (fill.type === 'pattern') {
		matrix = fill.matrix;

		var image = this._images[fill.image.id];
		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);

		// Image size is in pixels, being displayed in a space where the measurement unit is a twip
		// all its transformation matrix attributes are 20 times what they should be in pixels
		context.transform(matrix.scaleX / 20, matrix.skewX / 20, matrix.skewY / 20, matrix.scaleY / 20, matrix.moveX / 20, matrix.moveY / 20);

		context.drawImage(image, 0, 0, image.width, image.height);
	} else {
		matrix = fill.matrix;
		var stops = fill.stops;

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