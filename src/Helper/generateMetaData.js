'use strict';

function generateMetaData(sprites, spriteList, symbols, symbolList, spriteProperties, usesAtlas) {
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
				h: properties.h
			};

			if (usesAtlas) {
				spriteData.sx = properties.sx;
				spriteData.sy = properties.sy;
				spriteData.sw = properties.sw;
				spriteData.sh = properties.sh;
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
			frameCount: symbol.duration
		};

		if (symbol.className) {
			symbolData.className = symbol.className;
			if (symbol.containerBounds) symbolData.containerBounds = symbol.containerBounds;
		}

		if (symbol.scalingGrid) {
			symbolData.scalingGrid = symbol.scalingGrid;
		}

		symbolsData[symbolId] = symbolData;
	}

	return {
		sprites: spritesData,
		symbols: symbolsData
	};
}
module.exports = generateMetaData;