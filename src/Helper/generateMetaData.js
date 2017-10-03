
function generateMetaData(sprites, symbols, spriteProperties, frameRate) {
	var s;

	var spritesData = {};
	for (var spriteId in sprites) {
		var sprite = sprites[spriteId];
		var properties = spriteProperties[spriteId];
		if (properties) {
			var spriteData = {
				x: -properties.x,
				y: -properties.y,
				w: properties.w,
				h: properties.h
			};

			spritesData[spriteId] = spriteData;

			if (sprite.className) {
				spriteData.className = sprite.className;
			}

			if (sprite.duration !== 1) {
				spriteData.duration = sprite.duration;
			}
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

		if (symbol.duration !== symbol.frameCount) {
			symbolData.duration = symbol.duration;
		}

		symbolsData[symbolId] = symbolData;
	}

	return {
		sprites: spritesData,
		symbols: symbolsData
	};
}
module.exports = generateMetaData;