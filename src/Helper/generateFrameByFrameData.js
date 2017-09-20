
function populatePositions(symbol, positionData, imageId, imageIndexes, useAtlas) {
	symbol.x = positionData.x;
	symbol.y = positionData.y;
	symbol.w = positionData.w;
	symbol.h = positionData.h;

	if (useAtlas) {
		symbol.sx = positionData.sx;
		symbol.sy = positionData.sy;
		symbol.sw = positionData.sw;
		symbol.sh = positionData.sh;
	}

	if (imageIndexes) {
		symbol.image = useAtlas ? 0 : imageIndexes[imageId];
	}
}

function generateFrameByFrameData(symbols, symbolList, imageIndexes, spritesProperties, onlyOneFrame, useAtlas, nbItems) {
	var newItemId = nbItems;

	var spritesData = {};
	var symbolsData = {};
	for (var id in symbols) {
		var symbol = symbols[id];

		var className = symbol.className;
		if (!className) {
			continue;
		}

		var item = {
			className: className
		};

		if (symbol.containerBounds) {
			item.containerBounds = symbol.containerBounds;
		}

		if (onlyOneFrame) {
			populatePositions(item, spritesProperties[className], id, imageIndexes, useAtlas);
			spritesData[id] = item;
		} else {
			item.frameCount = symbol.frameCount;

			var frames  = [];
			var frameNames = symbol.frameNames;
			for (var f = 0; f < frameNames.length; f += 1) {
				var frameName  = frameNames[f];
				var properties = spritesProperties[frameName];
				if (properties) {
					frames.push(newItemId);

					var childItem = {};
					populatePositions(childItem, properties, frameName, imageIndexes, useAtlas);
					spritesData[newItemId] = childItem;

					newItemId += 1;
				}
			}

			item.frames = frames;
			symbolsData[id] = item;
		}
	}

	return {
		sprites: spritesData,
		symbols: symbolsData
	};
}
module.exports = generateFrameByFrameData;