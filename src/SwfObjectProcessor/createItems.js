
var processShape = require('./processShape');
var elements = require('../elements/');

var Bounds = elements.Bounds;
var Sprite = elements.Sprite;
var Symbol = elements.Symbol;
var UnhandledItem = elements.UnhandledItem;

function createItem(id, swfObject) {
	var item;
	switch(swfObject.type) {
		case 'main':
			item = new Symbol(swfObject.frameCount, swfObject.frameRate, swfObject.frameSize);
			break;

		case 'sprite':
			item = new Symbol(swfObject.frameCount, swfObject.frameRate, swfObject.frameSize);

			var scalingGrid = swfObject.scalingGrid;
			if (scalingGrid) {
				// Converting bounds from twips to pixels
				symbol.scalingGrid = new Bounds(
					scalingGrid.left   / 20,
					scalingGrid.right  / 20,
					scalingGrid.top    / 20,
					scalingGrid.bottom / 20
				);
			}
			break;

		case 'image':
			item = new Sprite();
			item.isImage = true;
			item.bounds = new Bounds(0, swfObject.width, 0, swfObject.height);
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

			item = new Sprite();

			if (shapes.length > 0) {
				item.isShape = true;
				item.shapes  = processShape(shapes);
			}

			if (imagesArray.length > 0) {
				item.images = imagesArray;
			}

			// Converting bounds from twips to pixels
			var bounds = swfObject.bounds;
			item.bounds = new Bounds(
				bounds.left   / 20,
				bounds.right  / 20,
				bounds.top    / 20,
				bounds.bottom / 20
			);
			break;

		case 'morph':
			item = new Sprite();
			item.isMorphing = true;

			var startBounds = swfObject.startBounds;
			var endBounds   = swfObject.endBounds;

			item.bounds = new Bounds(
				Math.min(startBounds.left,   endBounds.left)   / 20,
				Math.max(startBounds.right,  endBounds.right)  / 20,
				Math.min(startBounds.top,    endBounds.top)    / 20,
				Math.max(startBounds.bottom, endBounds.bottom) / 20
			);
			break;

		// Not handled yet
		case 'font':
		case 'text':
			item = new UnhandledItem();
			break;
		default:
			item = new UnhandledItem();
			break;
	}

	item.id = id;
	item.swfObject = swfObject;

	return item;
}

function createItems(swfObjects) {
	var sprites = {};
	var symbols = {};
	var itemsById = [];

	var items = {
		sprites: sprites,
		symbols: symbols,
		itemsById: itemsById
	};

	for (var s = 0; s < swfObjects.length; s += 1) {
		var swfObject = swfObjects[s];
		var id = parseInt(swfObject.id, 10);
		var item = createItem(id, swfObject);
		if (!item) {
			continue;
		}

		if (item.isSymbol) {
			symbols[id] = item;
		} else if (item.isSprite) {
			sprites[id] = item;
		}
		itemsById[id] = item;
	}
	return items;
}

module.exports = createItems;
