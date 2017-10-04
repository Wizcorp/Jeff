
var computeBoundsAtFrame = require('./computeBoundsAtFrame');

function computeBounds(symbols, sprites) {
	for (var id in symbols) {
		var symbol = symbols[id];
		var frameCount = symbol.frameCount;
		for (var f = 0; f < frameCount; f += 1) {
			computeBoundsAtFrame(id, symbols, sprites, f);
		}
	}
}

module.exports = computeBounds;