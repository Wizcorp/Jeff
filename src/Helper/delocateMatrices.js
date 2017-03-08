'use strict';

function cmpTransforms(a, b) {
	if (a[0] !== b[0]) return a[0] - b[0];
	if (a[1] !== b[1]) return a[1] - b[1];
	if (a[2] !== b[2]) return a[2] - b[2];
	if (a[3] !== b[3]) return a[3] - b[3];
	if (a[4] !== b[4]) return a[4] - b[4];
	return a[5] - b[5];
}

function cmpColors(a, b) {
	if (a[0] !== b[0]) return a[0] - b[0];
	if (a[1] !== b[1]) return a[1] - b[1];
	if (a[2] !== b[2]) return a[2] - b[2];
	if (a[3] !== b[3]) return a[3] - b[3];
	if (a[4] !== b[4]) return a[4] - b[4];
	if (a[5] !== b[5]) return a[5] - b[5];
	if (a[6] !== b[6]) return a[6] - b[6];
	return a[7] - b[7];
}

function areTransformsDifferent(a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5];
}

function areColorsDifferent(a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5] || a[6] !== b[6] || a[7] !== b[7];
}

function findMatrixIdx(transforms, transform) {
	// The transforms are supposed sorted
	// binary search
	var min = 0;
	var max = transforms.length - 1;
	while (min <= max) {
		var mid = Math.floor((max + min) / 2);
		var cmp = cmpTransforms(transforms[mid], transform);
		if (cmp === 0) {
			return mid;
		}

		if (cmp < 0) {
			min = mid + 1;
		} else {
			max = mid - 1;
		}
	}
	throw new Error('[findMatrixIdx] Matrix index not found : ' + JSON.stringify(transform) + ' : ' + JSON.stringify(transforms));
}

function findColorIdx(colors, color) {
	// The colors are supposed sorted
	// binary search
	var min = 0;
	var max = colors.length - 1;
	while (min <= max) {
		var mid = Math.floor((max + min) / 2);
		var cmp = cmpColors(colors[mid], color);
		if (cmp === 0) {
			return mid;
		}

		if (cmp < 0) {
			min = mid + 1;
		} else {
			max = mid - 1;
		}
	}
	throw new Error('[findColorIdx] Color index not found');
}

function delocateTransforms(symbols) {
	/* jshint maxstatements: 100 */
	var delocatedTransformsTmp = [];
	var delocatedColorsTmp   = [];

	var t, c;
	var id, symbol, children;
	var c1, child, transforms, colors;
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;

		if (children) {
			for (c1 = 0; c1 < children.length; c1 += 1) {
				child = children[c1];
				transforms = child.transforms;
				colors   = child.colors;

				for (t = 0; t < transforms.length; t += 1) {
					delocatedTransformsTmp.push(transforms[t]);
				}

				for (c = 0; c < colors.length; c += 1) {
					delocatedColorsTmp.push(colors[c]);
				}
			}
		}
	}

	var compressedMatrices = {};
	var current, previous;

	var delocatedTransforms;
	if (delocatedTransformsTmp.length > 0) {
		delocatedTransformsTmp.sort(cmpTransforms);

		// Removing duplicates
		delocatedTransforms = [delocatedTransformsTmp[0]];
		previous = delocatedTransformsTmp[0];
		for (t = 1; t < delocatedTransformsTmp.length; t += 1) {
			current = delocatedTransformsTmp[t];
			if (areTransformsDifferent(previous, current)) {
				delocatedTransforms.push(current);
				previous = current;
			}
		}
		compressedMatrices.transforms = delocatedTransforms;
	}

	var delocatedColors;
	if (delocatedColorsTmp.length > 0) {
		delocatedColorsTmp.sort(cmpColors);

		// Removing duplicates
		delocatedColors = [delocatedColorsTmp[0]];
		previous = delocatedColorsTmp[0];
		for (c = 1; c < delocatedColorsTmp.length; c += 1) {
			current = delocatedColorsTmp[c];
			if (areColorsDifferent(previous, current)) {
				delocatedColors.push(current);
				previous = current;
			}
		}

		compressedMatrices.colors = delocatedColors;
	}

	// Final step: replacing transforms and colors in the animations
	// by their indexes in the delocated matrix and color arrays
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;

		if (children) {
			for (c1 = 0; c1 < children.length; c1 += 1) {
				child = children[c1];
				// child.symbolId = id;
				// child.childId = c1;
				transforms = child.transforms;
				colors   = child.colors;

				for (t = 0; t < transforms.length; t += 1) {
					transforms[t] = findMatrixIdx(delocatedTransforms, transforms[t]);
				}

				for (c = 0; c < colors.length; c += 1) {
					colors[c] = findColorIdx(delocatedColors, colors[c]);
				}

			}
		}
	}

	return compressedMatrices;
}
module.exports = delocateTransforms;