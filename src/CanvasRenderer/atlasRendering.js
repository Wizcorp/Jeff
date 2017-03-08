'use strict';
var getCanvas       = require('./GetCanvas');
var CanvasRenderer  = require('./main');
var BoxPartitioning = require('./BoxPartitioning');

function nextHighestPowerOfTwo(x) {
	x -= 1;
	for (var i = 1; i < 32; i <<= 1) {
		x = x | x >> i;
	}
	return x + 1;
}

CanvasRenderer.prototype._computeAtlasLayout = function (graphicDims) {
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

	// Populating list of graphics
	var graphics = [];
	for (id in graphicDims) {
		graphics.push(graphicDims[id]);
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

	var maxAtlasDim = this._options.maxImageDim;
	var bestLowerBound = 0;
	var bestAlpha = 0;
	for (var l = 0; l < priorityZones.length; l += 1) {
		var priorityZone = priorityZones[l];
		for (var a = 0; a < alphaValues.length; a += 1) {
			alpha = alphaValues[a];
			beta = 1 - alpha;

			graphics.sort(cmpFunc);
			var boxPartioning = new BoxPartitioning({ left: 0, right: maxAtlasDim, top: 0, bottom: maxAtlasDim }, priorityZone);

			for (var g = 0; g < graphics.length; g += 1) {
				var graphic = graphics[g];
				// Adding margin on 4 sides of the graphic
				boxPartioning.add(graphic, graphic.sw + 2 * graphicDim.margin, graphic.sh + 2 * graphicDim.margin);
			}

			var occupiedArea = boxPartioning.occupiedBounds.a;
			if (this._options.powerOf2Images) {
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

	// Computing the positions of every graphic on the atlas
	var graphicBoxes = bestPartitioning.occupiedSpace;
	for (var g = 0; g < graphicBoxes.length; g += 1) {
		var graphicBox = graphicBoxes[g];
		graphicDim = graphicBox.e;

		// Computing position of graphic on the atlas with respect to its margin
		graphicDim.sx = graphicBox.l + graphicDim.margin;
		graphicDim.sy = graphicBox.t + graphicDim.margin;
	}

	return { width: bestPartitioning.occupiedBounds.w, height: bestPartitioning.occupiedBounds.h };
}

CanvasRenderer.prototype._renderAtlas = function (graphicCanvasses, graphicDims) {
	var atlasDim = this._computeAtlasLayout(graphicDims);
	if (!atlasDim) {
		return;
	}

	if (atlasDim.width === 0 || atlasDim.height === 0) {
		var emptyCanvas = getCanvas();
		emptyCanvas.width  = 0;
		emptyCanvas.height = 0;
		return emptyCanvas;
	}

	// Drawing each graphical element into atlas
	var atlas   = getCanvas();
	var context = atlas.getContext('2d');

	atlas.width  = this._options.powerOf2Images? nextHighestPowerOfTwo(atlasDim.width)  : atlasDim.width;
	atlas.height = this._options.powerOf2Images? nextHighestPowerOfTwo(atlasDim.height) : atlasDim.height;

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
