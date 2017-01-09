'use strict';

function simplifyAnimation(symbols) {
	// TODO: improve it by simplifying every animation symbol containing a single child
	
	// Getting rid of unnecessary animations
	// i.e if an animation includes only one graphic
	// and all its transformations are the identity
	// then the animation can be replaced by the graphic
	
	// This has a positive impact on speed performance (when running the animation)
	// And a positive impact on memory (reduced quantity of data)

	var replacements = {};
	var symbol, id;
	for (id in symbols) {
		symbol = symbols[id];
		if (symbol.isAnimation && symbol.children.length === 1) {
			var child = symbol.children[0];

			var discardable = true;
			var transforms = child.transforms;

			for (var t = 0; t < transforms.length && discardable; t += 1) {
				var transform = transforms[t];
				discardable = transform[0] === 1 && transform[1] === 0 && transform[2] === 0 && transform[3] === 1 && transform[4] === 0 && transform[5] === 0;
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
		if (symbol.isAnimation) {
			var children = symbol.children;
			for (var c1 = 0; c1 < children.length; c1 += 1) {
				var replacement = children[c1].id;

				while (replacements[replacement] !== undefined) { // could be 0
					replacement = replacements[replacement];
				}

				children[c1].id = replacement;
			}
		}
	}

	return symbols;
}
module.exports = simplifyAnimation;
