
function generateMetaData(sprites, symbols, spriteProperties, frameRate) {
	var s;

	var spritesData = {};
	for (var spriteId in sprites) {
		var properties = spriteProperties[spriteId];
		if (properties) {
			var spriteData = {
				x: -properties.x,
				y: -properties.y,
				w: properties.w,
				h: properties.h
			};

			if (properties.margin) {
				spriteData.margin = properties.margin;
			}

			spritesData[spriteId] = spriteData;
		}
	}


	var symbolsData = {};
	for (var symbolId in symbols) {
		var symbol = symbols[symbolId];
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