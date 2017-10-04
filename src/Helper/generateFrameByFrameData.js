
function populatePositions(symbol, positionData, imageId) {
	symbol.x = positionData.x;
	symbol.y = positionData.y;
	symbol.w = positionData.w;
	symbol.h = positionData.h;

	symbol.image = imageId;
}

function generateFrameByFrameData(symbols, spritesProperties, onlyOneFrame) {
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
			populatePositions(item, spritesProperties[className], id);
			spritesData[id] = item;
		} else {
			item.frameCount = symbol.frameCount;

			var frames  = [];
			var frameNames = symbol.frameNames;
			for (var f = 0; f < frameNames.length; f += 1) {
				var frameName  = frameNames[f];
				var properties = spritesProperties[frameName];
				if (properties) {
					var frameId = properties.frameId;
					frames.push(frameId);

					var childItem = {};
					populatePositions(childItem, properties, frameName);
					spritesData[frameId] = childItem;
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