'use strict';

function generateMetaData(symbols, symbolList, graphicProperties) {
	var exportData = {};
	for (var idString in symbolList) {

		var symbolId = symbolList[idString];
		var symbol   = symbols[symbolId];
		var toExport = false;

		var symbolData = {};
		symbolData.id = symbolId;

		if (symbol.isAnim) {
			symbolData.isAnim   = true;
			symbolData.children = symbol.children;
			symbolData.duration = symbol.duration;
			if (symbol.className) {
				symbolData.className = symbol.className;
				if (symbol.containerBounds) symbolData.containerBounds = symbol.containerBounds;
			}
			toExport = true;
		}

		if (symbol.isGraphic) {
			symbolData.isGraphic = true;
			var properties = graphicProperties[symbolId];
			if (properties) {
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
		}

		if (toExport) exportData[symbolId] = symbolData;
	}

	return exportData;
}
module.exports = generateMetaData;