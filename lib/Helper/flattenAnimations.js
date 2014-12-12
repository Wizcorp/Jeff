'use strict';

function flattenInstance(symbols, instance, unflattenedSymbols) {
	/* jshint maxstatements: 100 */
	var id     = instance.id;
	var symbol = symbols[id];

	if (!symbol) {
		return [];
	}

	var c, children;
	if (!symbol.isAnim || symbol.className || Object.keys(instance).length > 4) {
		// Anything that is different from an animation or that is more than an animation cannot be flattened
		var flattenedInstance = JSON.parse(JSON.stringify(instance));
		if (symbol.isAnim) {
			children = symbol.children;
			var newChildren = [];
			for (c = 0; c < children.length; c += 1) {
				Array.prototype.push.apply(newChildren, flattenInstance(symbols, children[c], unflattenedSymbols));
			}
			symbol.children = newChildren;
			unflattenedSymbols.push(symbol);
		}
		return [flattenedInstance];
	}

	var firstFrameParent = instance.frames[0];
	var matrices         = instance.matrices;
	var colors           = instance.colors;

	var tmpChildren = [];
	children = symbol.children;
	for (c = 0; c < children.length; c += 1) {
		Array.prototype.push.apply(tmpChildren, flattenInstance(symbols, children[c], unflattenedSymbols));
	}

	if (tmpChildren.length === 0) {
		return [JSON.parse(JSON.stringify(instance))];
	}

	// Applying transformation propagation on each child
	var a0, b0, c0, d0, e0, f0;
	var a1, b1, c1, d1, e1, f1;

	var rm0, gm0, bm0, am0, ra0, ga0, ba0, aa0;
	var rm1, gm1, bm1, am1, ra1, ga1, ba1, aa1;

	var instanceDuration  = instance.frames[1] - instance.frames[0] + 1;
	var symbolDuration    = symbol.duration;
	var flattenedChildren = [];
	for (c = 0; c < tmpChildren.length; c += 1) {
		var childInstance = tmpChildren[c];

		var childMatrices = childInstance.matrices;
		var childColors   = childInstance.colors;
		var childDuration = childInstance.frames[1] - childInstance.frames[0] + 1;

		var newMatrices     = [];
		var newColors       = [];
		var firstFrameChild = 0;

		for (var f = 0; f < instanceDuration; f += 1) {

			// parent transformation
			var matrice = matrices[f];
			var color   = colors[f];

			a0 = matrice[0];
			b0 = matrice[1];
			c0 = matrice[2];
			d0 = matrice[3];
			e0 = matrice[4];
			f0 = matrice[5];

			rm0 = color[0];
			gm0 = color[1];
			bm0 = color[2];
			am0 = color[3];
			ra0 = color[4];
			ga0 = color[5];
			ba0 = color[6];
			aa0 = color[7];

			// child transformation
			var childFrame = f % symbolDuration - childInstance.frames[0];
			if (childFrame < 0 || childDuration <= childFrame) {
				if (newMatrices.length > 0) {
					var flattenedChild = JSON.parse(JSON.stringify(childInstance));
					flattenedChild.matrices = newMatrices;
					flattenedChild.colors   = newColors;
					flattenedChild.frames   = [firstFrameParent + firstFrameChild, firstFrameParent + f - 1];

					flattenedChildren.push(flattenedChild);

					newMatrices = [];
					newColors   = [];
				}
				firstFrameChild = f + 1;
				continue;
			}

			var childMatrice = childMatrices[childFrame];
			var childColor   = childColors[childFrame];

			a1 = childMatrice[0];
			b1 = childMatrice[1];
			c1 = childMatrice[2];
			d1 = childMatrice[3];
			e1 = childMatrice[4];
			f1 = childMatrice[5];

			rm1 = childColor[0];
			gm1 = childColor[1];
			bm1 = childColor[2];
			am1 = childColor[3];
			ra1 = childColor[4];
			ga1 = childColor[5];
			ba1 = childColor[6];
			aa1 = childColor[7];

			// transformation multiplication
			newMatrices.push([
				a0 * a1 + c0 * b1,
				b0 * a1 + d0 * b1,
				a0 * c1 + c0 * d1,
				b0 * c1 + d0 * d1,
				a0 * e1 + c0 * f1 + e0,
				b0 * e1 + d0 * f1 + f0
			]);

			newColors.push([
				rm1 * rm0,
				gm1 * gm0,
				bm1 * bm0,
				am1 * am0,
				ra1 * rm0 + ra0,
				ga1 * gm0 + ga0,
				ba1 * bm0 + ba0,
				aa1 * am0 + aa0
			]);
		}

		// Replacing child matrices
		if (newMatrices.length > 0) {
			var flattenedChild = JSON.parse(JSON.stringify(childInstance));
			flattenedChild.matrices = newMatrices;
			flattenedChild.colors   = newColors;
			flattenedChild.frames   = [firstFrameParent + firstFrameChild, firstFrameParent + f - 1];

			flattenedChildren.push(flattenedChild);
		}
	}

	return flattenedChildren;
}

function flattenAnimations(symbols) {
	var symbolListFlat = {};
	var id, symbol;

	// Making list of classes
	var classes = {};
	for (id in symbols) {
		symbol = symbols[id];
		if (symbol.className) {
			classes[id] = symbol;
		}

		if (!symbol.isAnim) {
			symbolListFlat[id] = symbol;
		}
	}

	var unflattenedSymbols = [];
	for (id in classes) {
		symbol = symbols[id];
		var children    = symbol.children;
		var newChildren = [];
		for (var c = 0; c < children.length; c += 1) {
			Array.prototype.push.apply(newChildren, flattenInstance(symbols, children[c], unflattenedSymbols));
		}
		symbol.children = newChildren;
		symbolListFlat[id] = symbol;
	}

	var nUnflattenedSymbols = unflattenedSymbols.length;
	for (var s = 0; s < nUnflattenedSymbols; s += 1) {
		symbol = unflattenedSymbols[s];
		symbolListFlat[symbol.id] = symbol;
	}

	return symbolListFlat;
}
module.exports = flattenAnimations;