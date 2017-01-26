'use strict';
var getCanvas      = require('./GetCanvas');
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

// function getPixelsOnLine(x0, y0, x1, y1, w, h) {
// 	var pixelCoordinates = [];

// 	var dx = x1 - x0;
// 	var dy = y1 - y0;

// 	var s; // step
// 	if (dx === 0) {
// 		// return line on x abscissa from y0 to y1
// 		s = dy > 0 ? 1 : -1;
// 		while (y0 <= y1 + 1) {
// 			pixelCoordinates.push({ x: x0, y: y0 });
// 			y0 += s;
// 		}
// 	}

// 	var r = dy / dx;


// 	while (x0 !== x1 && y0 !== y1) {

// 		if (0 <= x0 && x0 < w && 0 <= y0 && y0 < h) {
// 			pixelCoordinates.push({ x: x0, y: y0 });
// 		}
// 	}

// 	return pixelCoordinates;
// }

// TODO: wonder if we should finish implementing double edge fix.
// If the answer is positive then finish implementing double edge fix.
// Issue: border between fills of a unique drawing is transparent (not fully opaque)
// it needs to be solved but changing the node canvas renderer to something
// more efficient and reliable like a vectorial webgl renderer is being considered.
// The problem is that this transparency issue will still occur.
// Probably the getDoubleEdges function will stay but the fixDoubleEdges and getPixelsOnLine
// functions will require a new implementation depending on the new renderer.

// function getDoubleEdges(canvas, context, transform, fills) {
// 	var w = canvas.width;
// 	var h = canvas.height
// 	var imgData = context.getImageData(0, 0, w, h);
// 	var colors  = imgData.data;

// 	var edgesData   = {};
// 	var doubleEdges = [];
// 	for (var f = 1; f < fills.length; f += 1) {
// 		var shapes = fills[f];
// 		var fill   = shapes[0].fillStyle;
// 		if (!fill) {
// 			return;
// 		}

// 		for (var s = 0; s < shapes.length; s += 1) {
// 			var path = shapes[s].records;
// 			for (var e = 0; e < path.length; e += 1) {
// 				var edge     = path[e];
// 				var edgeIdx  = edge.i;
// 				var edgeData = edgesData[edgeIdx];

// 				if (edgeData !== undefined) {
// 					if (edge.l) {
// 						edgeData.leftFill  = fill;
// 						// if (!edgeData.rightFill) {
// 						// 	console.log('Error!! no right fill on double edge with left fill', edgeIdx, edgeData, edge, fill);
// 						// }
// 					} else {
// 						edgeData.rightFill = fill;
// 						// if (!edgeData.leftFill) {
// 						// 	console.log('Error!! no left fill on double edge with rigtht fill', edgeIdx, edgeData, edge, fill);
// 						// }
// 					}
// 					edgeData.edge = edge;

// 					doubleEdges.push(edgeData);
// 				} else {
// 					if (edge.l) {
// 						edgesData[edgeIdx] = { leftFill:  fill };
// 					} else {
// 						edgesData[edgeIdx] = { rightFill: fill };
// 					}
// 				}
// 			}
// 		}
// 	}

// 	// Computing positions of pixel forming the edge
// 	// && Getting current canvas color for each of those pixels
// 	for (var e = 1; e < doubleEdges.length; e += 1) {
// 		var doubleEdge = doubleEdges[e];
// 		var edge       = doubleEdge.edge;
// 		var pixelCoord = [];

// 		var p1 = transformPoint(transform, edge.x1, edge.y1);
// 		var p2 = transformPoint(transform, edge.x2, edge.y2);

// 		doubleEdge.pixelCoord = getPixelsOnLine(Math.floor(p1.x), Math.floor(p1.y), Math.floor(p2.x), Math.floor(p2.y), w, h);
// 	}

// 	return doubleEdges;
// }

// function fixDoubleEdge(canvas, context, transform, doubleEdges) {

// }

CanvasRenderer.prototype._drawShapes = function (shapes, canvas, context, transform, isMask) {
	for (var idx = 0; idx < shapes.length; idx += 1) {
		var fills = shapes[idx].fills;
		var lines = shapes[idx].lines;

		// var doubleEdges = getDoubleEdges(canvas, context, transform, fills);
		for (var f = 1; f < fills.length; f += 1) {
			this._fillShapes(context, canvas, fills[f], transform, isMask);
		}
		// fixDoubleEdge(canvas, context, transform, doubleEdges);

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
		var path = shapes[s].records;
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

	var s, color, alpha, scale;
	context.save();

	if (line.capStart) {
		context.lineCap = line.capStart.toLowerCase();
	}

	if (line.join) {
		context.lineJoin = line.join.toLowerCase();
	}

	if (line.fill === undefined) {
		// In Flash, lines cannot look thinner than width of 1
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
		context.strokeStyle = 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',' + Math.pow(alpha, 1 / this._options.outlineEmphasis) + ')';
	} else {
		var fill   = line.fill;
		var matrix = fill.matrix;
		var stops  = fill.stops;

		transform = multiplyTransforms(transform, [matrix.scaleX, matrix.skewX, matrix.skewY, matrix.scaleY, matrix.moveX, matrix.moveY]);

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
		context.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);
		context.transform(matrix.scaleX, matrix.skewX, matrix.skewY, matrix.scaleY, matrix.moveX, matrix.moveY);

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
