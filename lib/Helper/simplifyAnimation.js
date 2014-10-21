'use strict';

function simplifyAnimation(symbols) {
	// Getting rid of unnecessary animations
	// i.e if an animation includes only one graphic
	// and all its transformations are the identity
	// then the animation can be replaced by the graphic
	var replacements = {};
	var symbol, id;
	for (id in symbols) {
		symbol = symbols[id];
		if (symbol.isAnim && symbol.children.length === 1) {
			var child = symbol.children[0];

			var discardable = true;
			var matrices = child.matrices;

			for (var m = 0; m < matrices.length && discardable; m += 1) {
				var matrix = matrices[m];
				discardable = matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0;
			}

			var colors = child.colors;
			for (var c = 0; c < colors.length && discardable; c += 1) {
				var color = colors[c];
				discardable = color[0] === 1 && color[1] === 1 && color[2] === 1 && color[3] === 1 && color[4] === 0 && color[5] === 0 && color[6] === 0 && color[7] === 0;
			}

			if (discardable) {
				var childSymbol = symbols[child.id];

				if (!childSymbol) {
					continue;
				}

				replacements[id] = child.id;
				childSymbol.className = symbol.className;
			}
		}
	}

	// Deleting animations that have been proven useless
	for (id in replacements) {
		delete symbols[id];
	}

	// Replacing animation ids by graphic ids where necessary
	for (id in symbols) {
		symbol = symbols[id];
		if (symbol.isAnim) {
			var children = symbol.children;
			for (var c1 = 0; c1 < children.length; c1 += 1) {
				var replacement = replacements[children[c1].id];
				if (replacement) {
					children[c1].id = replacement;
				}
			}
		}
	}

	return symbols;
}
module.exports = simplifyAnimation;
