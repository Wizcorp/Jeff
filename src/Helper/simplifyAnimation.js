'use strict';
function isChildUsedElsewhere (childId, consideredSymbol, symbols) {
	for (var id in symbols) {
		var symbol = symbols[id];
		if (consideredSymbol === symbol) {
			continue;
		}

		var children = symbol.children;
		for (var c = 0; c < children.length; c += 1) {
			var child = children[c];
			if (child.id === childId) {
				return true;
			}
		}
	}

	return false;
}


function simplifyAnimation(itemsData, nbItems) {
	var symbols = itemsData.symbols;
	var sprites = itemsData.sprites;
	
	// Getting rid of unnecessary animations
	// i.e if an animation includes only one graphic
	// and all its transformations are the identity
	// then the animation can be replaced by the graphic
	
	// This has a positive impact on speed performance (when running the animation)
	// And a positive impact on memory (reduced quantity of data)

	var newItemId = nbItems;

	var childReplacements = {};
	var replacements = {};
	var symbol, id;
	for (id in symbols) {
		symbol = symbols[id];
		if (symbol.children.length === 1) {
			var child = symbol.children[0];

			var discardable = true;
			var transforms = child.transforms;

			var tx = transforms[0][4];
			var ty = transforms[0][5];
			for (var t = 0; t < transforms.length && discardable; t += 1) {
				var transform = transforms[t];
				discardable = transform[0] === 1 && transform[1] === 0 && transform[2] === 0 && transform[3] === 1 && transform[4] === tx && transform[5] === ty;
			}

			var colors = child.colors;
			for (var c = 0; c < colors.length && discardable; c += 1) {
				var color = colors[c];
				discardable = color[0] === 1 && color[1] === 1 && color[2] === 1 && color[3] === 1 && color[4] === 0 && color[5] === 0 && color[6] === 0 && color[7] === 0;
			}

			if (discardable) {
				var childId = child.id;
				var childItem = sprites[childId];

				if (!childItem) {
					continue;
				}

				// determining if child needs to be duplicated
				var toDuplicate = false;
				var childReplacement = childReplacements[childId];
				if (childReplacement) {
					if (childItem.className) {
						// child needs to be duplicated
						toDuplicate = true;
					} else if (symbol.className) {
						// symbol with a class name can be substituted by a child
						// only if the child is not used anywhere else
						if (isChildUsedElsewhere(childId, symbol, symbols)) {
							// otherwise substituting with a copy of the child
							// console.error('USED ELSEWHERE!!', childId, id)
							toDuplicate = true;
						}
					}
				} else {
					childReplacements[childId] = childItem;
				}

				if (toDuplicate) {
					// console.error('DUPLICATION!!', childId, newItemId, id)
					childItem = JSON.parse(JSON.stringify(childReplacement));
					childItem.x -= tx;
					childItem.y -= ty;

					itemsData[newItemId] = childItem;
					sprites[newItemId] = childItem;
					childId = newItemId;
					newItemId += 1;
				} else if (tx !== 0 || ty !== 0) {
					childItem = JSON.parse(JSON.stringify(childReplacement || childItem));
					childItem.x -= tx;
					childItem.y -= ty;

					itemsData[childId] = childItem;
					sprites[childId] = childItem;
				}

			// console.error('replacement!', childId, id, symbol.className)
				replacements[id] = childId;
				childItem.className = symbol.className;
			}
		}
	}

	// Deleting animations that have been proven useless
	for (id in replacements) {
		delete symbols[id];
	}

	// Replacing symbol ids by sprite ids where necessary
	for (id in symbols) {
		symbol = symbols[id];
		var children = symbol.children;
		for (var c1 = 0; c1 < children.length; c1 += 1) {
			var childId = children[c1].id;

			var replacement = replacements[childId];
			while (replacement !== undefined) { // could be 0
				childId = replacement;
				replacement = replacements[childId];
			}

			children[c1].id = childId;
		}
	}

}
module.exports = simplifyAnimation;
