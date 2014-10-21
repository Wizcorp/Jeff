'use strict';

function generateFrameByFrameData(symbols, symbolList, graphicProperties, firstFrameOnly) {
	var exportData = {};
	for (var idString in symbolList) {

		var symbolId = symbolList[idString];
		var symbol   = symbols[symbolId];
		var toExport = false;

		var symbolData = {};
		symbolData.id = symbolId;

		if (symbol.isAnim) {
			if (!symbol.className) {
				continue;
			}

			symbolData.className = symbol.className;
			if (symbol.containerBounds) symbolData.containerBounds = symbol.containerBounds;

			var frames = [];
			var frameNames = symbol.frameNames;
			if (firstFrameOnly) {
				var properties = graphicProperties[frameNames[0]];
				if (properties) {
					symbolData.isGraphic = true;
					symbolData.x = properties.x;
					symbolData.y = properties.y;
					symbolData.w = properties.w;
					symbolData.h = properties.h;

					symbolData.sx = properties.sx;
					symbolData.sy = properties.sy;
					symbolData.sw = properties.sw;
					symbolData.sh = properties.sh;

					toExport = true;
				}
			} else {
				symbolData.isAnim   = true;
				symbolData.duration = symbol.duration;
				for (var f = 0; f < frameNames.length; f += 1) {
					var frameName  = frameNames[f];
					var properties = graphicProperties[frameName];
					if (properties) {
						var position = {
							x: properties.x,
							y: properties.y,
							w: properties.w,
							h: properties.h,

							sx: properties.sx,
							sy: properties.sy,
							sw: properties.sw,
							sh: properties.sh
						};
						frames[f] = { name: frameName, position: position };
					}
				}

				symbolData.frames = frames;
				toExport = true;
			}
		}

		if (toExport) exportData[symbolId] = symbolData;
	}

	return exportData;
}
module.exports = generateFrameByFrameData;