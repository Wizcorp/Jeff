function addAccessibleSprites(symbol, symbols, sprites, ignoredImages, accessibleSprites) {
	if (symbol.className) {
		if (symbol.className.match(ignoredImages)) {
			return;
		}
	}

	var children = symbol.children;
	for (var c = 0; c < children.length; c += 1) {
		var child = children[c];
		var childId = child.id;

		if (sprites[childId]) {
			var sprite = sprites[childId];
			if (!sprite.className || !sprite.className.match(ignoredImages)) {
				accessibleSprites[childId] = true;
			}
		} else if (symbols[childId]) {
			addAccessibleSprites(symbols[childId], symbols, sprites, ignoredImages, accessibleSprites);
		}
	}
}


function removeIgnoredImages(symbols, sprites, spriteImages, ignoredImages) {
	// Computing a list of images that can only be accessed
	// through element in ignoredImages list

	// Achieved by computing a list of sprites that can be accessed
	// through elements that are not in the ignoreImages list

	var accessibleSprites = {};
	for (var symbolId in symbols) {
		var symbol = symbols[symbolId];
		if (symbol.className) {
			addAccessibleSprites(symbol, symbols, sprites, ignoredImages, accessibleSprites);
		}
	}

	for (var spriteId in spriteImages) {
		if (!accessibleSprites[spriteId]) {
			delete spriteImages[spriteId];
		}
	}
}
module.exports = removeIgnoredImages;
