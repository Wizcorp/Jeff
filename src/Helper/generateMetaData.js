'use strict';

function generateMetaData(sprites, spriteList, imageIndexes, symbols, symbolList, spriteProperties, useAtlas, frameRate) {
	var spritesData = {};
	for (var s = 0; s < spriteList.length; s += 1) {
		var spriteId = spriteList[s];
		var sprite   = sprites[spriteId];

		var properties = spriteProperties[spriteId];
		if (properties) {
			var spriteData = {
				x: -properties.x,
				y: -properties.y,
				w: properties.w,
				h: properties.h,
			};

			if (useAtlas) {
				spriteData.sx = properties.sx;
				spriteData.sy = properties.sy;
				spriteData.sw = properties.sw;
				spriteData.sh = properties.sh;
			}

			if (imageIndexes) {
				spriteData.image = useAtlas ? 0 : imageIndexes[spriteId];
			}

			if (properties.margin) {
				spriteData.margin = properties.margin;
			}

			spritesData[spriteId] = spriteData;
		}
	}


	var symbolsData = {};
	for (var s = 0; s < symbolList.length; s += 1) {
		var symbolId = symbolList[s];
		var symbol   = symbols[symbolId];
		var symbolData = {
			children: JSON.parse(JSON.stringify(symbol.children)),
			frameCount: symbol.frameCount
		};

		if (symbol.className) {
			symbolData.className = symbol.className;
			if (symbol.containerBounds) symbolData.containerBounds = symbol.containerBounds;
		}

		if (symbol.scalingGrid) {
			symbolData.scalingGrid = symbol.scalingGrid;
		}

		if (symbol.frameRate !== frameRate) {
			symbolData.frameRate = symbol.frameRate;
		}

		if (symbol.frameSize) {
			symbolData.frameSize = symbol.frameSize;
		}

		symbolsData[symbolId] = symbolData;
	}

	return {
		sprites: spritesData,
		symbols: symbolsData
	};
}
module.exports = generateMetaData;