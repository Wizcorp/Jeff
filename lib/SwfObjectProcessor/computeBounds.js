'use strict';

var computeBoundsAtFrame = require('./computeBoundsAtFrame');

function computeBounds(symbols) {
	var nbSymbols = symbols.length;
	for (var s = 0; s < nbSymbols; s += 1) {
		var symbol = symbols[s];
		if (!symbol.isAnim) {
			continue;
		}

		var duration = symbol.duration;
		for (var f = 0; f < duration; f += 1) {
			computeBoundsAtFrame(symbol, symbols, f);
		}
	}
}

module.exports = computeBounds;