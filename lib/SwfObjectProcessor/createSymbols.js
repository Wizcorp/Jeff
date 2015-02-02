'use strict';

var processShape = require('./processShape');

function createSymbol(swfObject) {
	var symbol = { id: swfObject.id, swfObject: swfObject, parents: {} };
	
	switch(swfObject.type) {

	case 'main':
		symbol.isAnim = true;
		symbol.duration = swfObject.frameCount;
		break;

	case 'image':
		symbol.isGraphic = true;
		symbol.isImage   = true;
		symbol.maxDims   = {};

		// Converting bounds from twips to pixels
		symbol.bounds = [{
			left:   0,
			right:  swfObject.width,
			top:    0,
			bottom: swfObject.height
		}];
		break;

	case 'shape':
		var shapes = swfObject.edges;
		var imagesArray  = [];
		for (var s = 0; s < shapes.length; s += 1) {
			var shape = shapes[s];

			var fill = shape.leftFill;
			var containsImage = fill ? (fill.type ? (fill.type === 'pattern') : false) : false;
			if (!containsImage) {
				fill = shape.rightFill;
				containsImage = fill ? (fill.type ? (fill.type === 'pattern') : false) : false;
			}

			if (containsImage) {
				var m = fill.matrix;

				// In case of an image all the components of the matrix have to be divided by 20
				var matrix    = [m.scaleX / 20, m.skewX / 20, m.skewY / 20, m.scaleY / 20, m.moveX / 20, m.moveY / 20];
				var imageData = { id: fill.image.id, matrix: matrix, image: fill.image };
				imagesArray.push(imageData);
			}
		}

		if (shapes.length > 0) {
			symbol.maxDims   = {};
			symbol.isGraphic = true;
			symbol.isShape   = true;
			symbol.shapes    = processShape(shapes);
		}

		if (imagesArray.length > 0) {
			symbol.images = imagesArray;
		}

		// Converting bounds from twips to pixels
		var bounds  = swfObject.bounds;
		symbol.bounds = [{
			left:   bounds.left   / 20,
			right:  bounds.right  / 20,
			top:    bounds.top    / 20,
			bottom: bounds.bottom / 20
		}];
		break;

	case 'morph':
		symbol.isGraphic  = true;
		symbol.isMorphing = true;
		symbol.maxDims    = {};

		var startBounds = swfObject.startBounds;
		var endBounds   = swfObject.endBounds;

		symbol.bounds = [{
			left:   Math.min(startBounds.left,   endBounds.left)   / 20,
			right:  Math.max(startBounds.right,  endBounds.right)  / 20,
			top:    Math.min(startBounds.top,    endBounds.top)    / 20,
			bottom: Math.max(startBounds.bottom, endBounds.bottom) / 20
		}];
		break;

	case 'sprite':
		symbol.isAnim = true;
		symbol.duration = swfObject.frameCount;

		var scalingGrid = swfObject.scalingGrid;
		if (scalingGrid) {
			symbol.scalingGrid = {
				left:   scalingGrid.left   / 20,
				right:  scalingGrid.right  / 20,
				top:    scalingGrid.top    / 20,
				bottom: scalingGrid.bottom / 20
			}
		}
		break;

	// Not handled yet
	case 'font':
	case 'text':
		break;
	default:
		break;
	}

	return symbol;
}

function createSymbols(swfObjects) {
	var symbols = [];
	var nbSymbols = swfObjects.length;
	for (var s = 0; s < nbSymbols; s += 1) {
		var swfObject = swfObjects[s];
		symbols[swfObject.id] = createSymbol(swfObject);
	}
	return symbols;
}

module.exports = createSymbols;
