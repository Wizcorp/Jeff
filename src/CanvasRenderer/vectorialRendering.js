var getCanvas      = require('./GetCanvas');
var CanvasRenderer = require('./main');

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

CanvasRenderer.prototype._drawShapes = function (shapes, canvas, context, transform, isMask) {
	for (var idx = 0; idx < shapes.length; idx += 1) {
		var fills = shapes[idx].fills;
		var lines = shapes[idx].lines;

		for (var f = 1; f < fills.length; f += 1) {
			this._fillShapes(context, canvas, fills[f], transform, isMask);
		}

		for (var l = 1; l < lines.length; l += 1) {
			this._outlineShapes(context, lines[l], transform, isMask);
		}
	}
};

// Due to a bug in cairo, path point positions have to be rounded
CanvasRenderer.prototype._createPath = function (context, shapes, transform, pixelHinting) {
	context.beginPath();
	var p, seg;
	var point1, point2;
	for (var s = 0; s < shapes.length; s += 1) {
		var shape = shapes[s];
		var path = shape.records;
		if (pixelHinting) {
			// Pixel hinting, all the coordinates have to be rounded
			point1 = transformPoint(transform, path[0].x1, path[0].y1);
			context.moveTo(Math.round(point1.x), Math.round(point1.y));
			for (p = 0; p < path.length; p += 1) {
				seg = path[p];
				point2 = transformPoint(transform, seg.x2, seg.y2);
				if (seg.c) {
					point1 = transformPoint(transform, seg.cx, seg.cy);
					context.quadraticCurveTo(Math.round(point1.x), Math.round(point1.y), Math.round(point2.x), Math.round(point2.y));
				} else {
					context.lineTo(Math.round(point2.x), Math.round(point2.y));
				}
			}
		} else {
			point1 = transformPoint(transform, path[0].x1, path[0].y1);
			context.moveTo(point1.x, point1.y);
			for (p = 0; p < path.length; p += 1) {
				seg = path[p];
				point2 = transformPoint(transform, seg.x2, seg.y2);
				if (seg.c) {
					point1 = transformPoint(transform, seg.cx, seg.cy);
					context.quadraticCurveTo(point1.x, point1.y, point2.x, point2.y);
				} else {
					context.lineTo(point2.x, point2.y);
				}
			}
		}

		if (shape.noClose !== undefined && shape.noClose !== 0) {
			context.closePath();
		}
	}
};

var GRADIENT_LENGTH = 820 / 20;
CanvasRenderer.prototype._outlineShapes = function (context, shapes, transform, isMask) {
	if (shapes.length === 0) {
		return;
	}

	var line = shapes[0].lineStyle;
	if (!line) {
		return;
	}

	var pixelHinting = (line === undefined) ? false : ((line.pixelHinting === undefined) ? false : line.pixelHinting);
	this._createPath(context, shapes, transform, pixelHinting);

	context.save();

	if (line.capStart) {
		context.lineCap = line.capStart.toLowerCase();
	} else {
		// default
		context.lineCap = 'round';
	}

	if (line.join) {
		context.lineJoin = line.join.toLowerCase();
	} else {
		// default
		context.lineJoin = 'round';
	}

	var s, color, alpha, scale, scaleX, scaleY;
	if (line.fill === undefined) {
		// In Flash, lines cannot look thinner than width of 1
		// Line width has to adjust to the transformation matrix
		scale = 1;
		if (!line.noHScale) {
			scaleX = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
			scaleY = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
			scale = 0.5 * (scaleX + scaleY);
		}
		context.lineWidth = Math.max(line.width * scale, 1);

		color = line.color;
		alpha = isMask ? 1 : ((color.alpha === undefined) ? 1 : color.alpha);
		context.strokeStyle = 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, 1 / this._options.outlineEmphasis) + ')';
	} else {
		var fill   = line.fill;
		var matrix = fill.matrix;
		var stops  = fill.stops;

		var scaleX = matrix.scaleX === 0 ? 1 : matrix.scaleX;
		var scaleY = matrix.scaleY === 0 ? 1 : matrix.scaleY;
		transform = multiplyTransforms(transform, [scaleX, matrix.skewX, matrix.skewY, scaleY, matrix.moveX, matrix.moveY]);

		scale = 1;
		if (!line.noHScale) {
			scaleX = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
			scaleY = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);
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
			gradient.addColorStop(stop.offset, 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, 1 / this._options.outlineEmphasis) + ')');
		}
		context.strokeStyle = gradient;
	}

	context.stroke();
	context.restore();
};

CanvasRenderer.prototype._fillShapes = function (context, canvas, shapes, transform, isMask) {
	if (shapes.length === 0) {
		return;
	}

	var fill = shapes[0].fillStyle;
	if (!fill) {
		return;
	}

	var s, color, alpha, matrix;
	context.save();
	if (fill.type === undefined) {
		this._createPath(context, shapes, transform, false);
		alpha = isMask ? 1 : ((fill.alpha === undefined) ? 1 : fill.alpha);
		context.fillStyle = 'rgba(' + fill.red + ',' + fill.green + ',' + fill.blue + ',' + alpha + ')';
		context.fill();
	} else if (fill.type === 'pattern') {
		matrix = fill.matrix;

		var imgCanvas  = getCanvas();
		var imgContext = imgCanvas.getContext('2d');
		imgCanvas.width  = canvas.width;
		imgCanvas.height = canvas.height;

		imgContext.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);
		imgContext.transform(matrix.scaleX, matrix.skewX, matrix.skewY, matrix.scaleY, matrix.moveX, matrix.moveY);
		imgContext.drawImage(this._images[fill.image.id], 0, 0);

		// Filling shape, it serves as a mask for the rendered image
		imgContext.globalCompositeOperation = 'destination-in';
		imgContext.setTransform(1, 0, 0, 1, 0, 0);
		this._createPath(imgContext, shapes, transform, false);
		imgContext.fillStyle = '#00ff00';
		imgContext.fill();

		context.drawImage(imgCanvas, 0, 0);
	} else {
		this._createPath(context, shapes, transform, false);

		matrix = fill.matrix;
		var scaleX = matrix.scaleX === 0 ? 1 : matrix.scaleX;
		var scaleY = matrix.scaleY === 0 ? 1 : matrix.scaleY;
		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);
		context.transform(scaleX, matrix.skewX, matrix.skewY, scaleY, matrix.moveX, matrix.moveY);

		var gradient;
		switch (fill.type) {
		case 'focal-radial':
			// TODO: implement custom focal radial
			// focal radial not supported by canvas API
			// replaced by regular radial
		case 'radial':
			gradient = context.createRadialGradient(0, 0, 0, 0, 0, GRADIENT_LENGTH);
			break;
		case 'linear':
			gradient = context.createLinearGradient(- GRADIENT_LENGTH, 0, GRADIENT_LENGTH, 0);
			break;
		}

		var stops = fill.stops;
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
