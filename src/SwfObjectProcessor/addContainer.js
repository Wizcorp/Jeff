
var computeBoundsAtFrame = require('./computeBoundsAtFrame');

function getContainerBounds(containerInstance, containerSymbol, symbols, frame) {
	var bounds = computeBoundsAtFrame(containerSymbol, symbols, frame);
	if (!bounds) {
		return null;
	}

	var transform = containerInstance.transforms[frame];

	var a = transform[0];
	var b = transform[1];
	var c = transform[2];
	var d = transform[3];
	var e = transform[4];
	var f = transform[5];

	var l0 = bounds.left;
	var r0 = bounds.right;
	var t0 = bounds.top;
	var b0 = bounds.bottom;

	var x0 = a * l0 + c * t0 + e;
	var y0 = b * l0 + d * t0 + f;
	var x1 = a * r0 + c * t0 + e;
	var y1 = b * r0 + d * t0 + f;
	var x2 = a * l0 + c * b0 + e;
	var y2 = b * l0 + d * b0 + f;
	var x3 = a * r0 + c * b0 + e;
	var y3 = b * r0 + d * b0 + f;

	return {
		left:   Math.min(Math.min(x0, x1), Math.min(x2, x3)),
		right:  Math.max(Math.max(x0, x1), Math.max(x2, x3)),
		top:    Math.min(Math.min(y0, y1), Math.min(y2, y3)),
		bottom: Math.max(Math.max(y0, y1), Math.max(y2, y3))
	};
}

function addContainer(symbols, classSymbols, container) {
	var nbClassSymbols = classSymbols.length;
	for (var s = 0; s < nbClassSymbols; s += 1) {
		var classSymbol = classSymbols[s];
		if (classSymbol && classSymbol.children) {
			// looking for the symbol to change into a container
			var hasContainer      = false;
			var containerInstance = null;
			var containerSymbol   = null;

			var children = classSymbol.children;
			var nbChildren = children.length;
			for (var c = 0; c < nbChildren; c += 1) {
				var child  = children[c];
				var symbol = symbols[child.id];
				if (symbol.className && symbol.className === container) {
					var maskStartChild = JSON.parse(JSON.stringify(child));
					child.maskEnd = true;
					maskStartChild.maskStart = true;
					children.push(maskStartChild);

					hasContainer      = true;
					containerInstance = child;
					containerSymbol   = symbol;
					break;
				}
			}

			if (hasContainer) {
				var containerBounds = [];
				var frameCount = classSymbol.frameCount;
				for (var f = 0; f < frameCount; f += 1) {
					containerBounds[f] = getContainerBounds(containerInstance, containerSymbol, symbols, f);
				}
				classSymbol.containerBounds = containerBounds;
			}
		}
	}
}

module.exports = addContainer;