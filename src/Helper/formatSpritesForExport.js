var getCanvas       = require('../CanvasRenderer/GetCanvas');
var BoxPartitioning = require('./BoxPartitioning');

// margin between assets in atlasmaps
var MARGIN = 1;

function nextHighestPowerOfTwo(x) {
	x -= 1;
	for (var i = 1; i < 32; i <<= 1) {
		x = x | x >> i;
	}
	return x + 1;
}

function computeAtlasLayout(spriteDims, powerOf2Images, maxAtlasDim, exportRatio) {
	/* jshint maxstatements: 50 */
	var id, spriteDim;

	// Computing total area taken by the sprites
	var totalArea = 0;
	for (id in spriteDims) {
		spriteDim = spriteDims[id];
		totalArea += (spriteDim.sw + 2 * MARGIN) * (spriteDim.sh + 2 * MARGIN);
	}
	var sqrSide = Math.sqrt(totalArea * exportRatio);

	// Populating list of sprites
	var sprites = [];
	for (id in spriteDims) {
		sprites.push(spriteDims[id]);
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

			sprites.sort(cmpFunc);
			var boxPartioning = new BoxPartitioning({ left: 0, right: maxAtlasDim, top: 0, bottom: maxAtlasDim }, priorityZone);

			for (var s = 0; s < sprites.length; s += 1) {
				var sprite = sprites[s];
				// Adding margin on 4 sides of the sprite
				var width = exportRatio * (sprite.sw + 2 * MARGIN);
				var height = exportRatio * (sprite.sh + 2 * MARGIN);
				boxPartioning.add(sprite, width, height);
			}

			var occupiedArea = boxPartioning.occupiedBounds.a;
			if (powerOf2Images) {
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

	// Computing the positions of every sprite on the atlas
	var spriteBoxes = bestPartitioning.occupiedSpace;
	for (var b = 0; b < spriteBoxes.length; b += 1) {
		var spriteBox = spriteBoxes[b];
		spriteDim = spriteBox.e;

		// Computing position of sprite on the atlas with respect to its margin
		spriteDim.sx = spriteBox.l + MARGIN;
		spriteDim.sy = spriteBox.t + MARGIN;
	}

	return { width: bestPartitioning.occupiedBounds.w, height: bestPartitioning.occupiedBounds.h };
}

function renderAtlas(spriteImages, spriteDims, powerOf2Images, maxImageDim, exportRatio) {
	var atlasDim = computeAtlasLayout(spriteDims, powerOf2Images, maxImageDim, exportRatio);
	if (!atlasDim) {
		return;
	}

	if (atlasDim.width === 0 || atlasDim.height === 0) {
		var emptyCanvas = getCanvas();
		emptyCanvas.width  = 0;
		emptyCanvas.height = 0;
		return emptyCanvas;
	}

	// Drawing each sprite into atlas
	var atlas   = getCanvas();
	var context = atlas.getContext('2d');

	atlas.width  = powerOf2Images? nextHighestPowerOfTwo(atlasDim.width)  : atlasDim.width;
	atlas.height = powerOf2Images? nextHighestPowerOfTwo(atlasDim.height) : atlasDim.height;

	var showEmptySpace = false;
	var showBounds     = false;
	if (showEmptySpace) {
		context.fillStyle = '#cc3333';
		context.fillRect(0, 0, atlas.width, atlas.height);
	}

	for (var id in spriteImages) {
		var spriteImage = spriteImages[id];
		var dimensions  = spriteDims[id];

		dimensions.sw *= exportRatio;
		dimensions.sh *= exportRatio;

		// Clearing empty space
		if (showEmptySpace) {
			context.clearRect(dimensions.sx - 1, dimensions.sy - 1, dimensions.sw + 2, dimensions.sh + 2);
		}

		context.drawImage(spriteImage, dimensions.sx, dimensions.sy, dimensions.sw, dimensions.sh);

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
}

function augmentToNextPowerOf2(spriteImages) {
	for (var spriteId in spriteImages) {
		var canvas = spriteImages[spriteId];
		var width  = nextHighestPowerOfTwo(canvas.width);
		var height = nextHighestPowerOfTwo(canvas.height);

		// Creating a canvas with power of 2 dimensions
		var po2Canvas  = getCanvas();
		var po2Context = po2Canvas.getContext('2d');
		po2Canvas.width  = width;
		po2Canvas.height = height;
		po2Context.drawImage(canvas, 0, 0);

		// Replacing non-power of 2 canvas by power of 2 canvas
		spriteImages[spriteId] = po2Canvas;
	}
}

function ImageData(name, image, sprites) {
	this.name = name;
	this.image = image;
	this.sprites = sprites;
}

function findImageData(image, newSpriteImages) {
	for (var i = 0; i < newSpriteImages.length; i += 1) {
		var imageData = newSpriteImages[i];
		if (imageData.image === image) {
			return imageData;
		}
	}
	return null
}

module.exports = function formatSpritesForExport(spriteImages, spriteProperties, createAtlas, powerOf2Images, maxImageDim, classGroupName) {
	var newSpriteImages = [];
	if (createAtlas) {
		var exportRatio = 1;
		while (true) {
			var atlas = renderAtlas(spriteImages, spriteProperties, powerOf2Images, maxImageDim, exportRatio);
			if (atlas) {
				// succesfully created the atlas!

				// TODO: generate several atlases if one atlas cannot fit everything
				newSpriteImages.push(new ImageData('atlas', atlas, Object.keys(spriteImages)));
				break;
			}

			// failed to create the atlas, trying at a smaller scale
			exportRatio *= 0.9;
		}

		if (exportRatio !== 1) {
			console.warn(
				'[helper.formatSpritesForExport] Atlas created with ratio ' + exportRatio +
				' because it did not fit into the required dimensions.' +
				'(File Group ' + exportRatio + ', Class ' + classGroupName + ')'
			);
		}
	} else {
		if (powerOf2Images) {
			augmentToNextPowerOf2(spriteImages);
		}
		for (var spriteId in spriteImages) {
			var image = spriteImages[spriteId];
			var imageData = findImageData(image, newSpriteImages);
			if (imageData) {
				imageData.sprites.push(spriteId);
			} else {
				newSpriteImages.push(new ImageData(spriteId, spriteImages[spriteId], [spriteId]));
			}
		}
	}

	return newSpriteImages;
};

