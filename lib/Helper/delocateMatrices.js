'use strict';

function cmpMatrices(a, b) {
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

function areMatricesDifferent(a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5];
}

function areColorsDifferent(a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5] || a[6] !== b[6] || a[7] !== b[7];
}

function findMatrixIdx(matrices, matrice) {
	// The matrices are supposed sorted
	// binary search
	var min = 0;
	var max = matrices.length - 1;
	while (min <= max) {
		var mid = Math.floor((max + min) / 2);
		var cmp = cmpMatrices(matrices[mid], matrice);
		if (cmp === 0) {
			return mid;
		}

		if (cmp < 0) {
			min = mid + 1;
		} else {
			max = mid - 1;
		}
	}
	throw new Error('[findMatrixIdx] Matrix index not found : ' + JSON.stringify(matrice) + ' : ' + JSON.stringify(matrices));
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

function delocateMatrices(symbols) {
	/* jshint maxstatements: 100 */
	var delocatedMatricesTmp = [];
	var delocatedColorsTmp   = [];


	var m, c;
	var id, symbol, children;
	var c1, child, matrices, colors;
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;

		if (children) {
			for (c1 = 0; c1 < children.length; c1 += 1) {
				child = children[c1];
				matrices = child.matrices;
				colors   = child.colors;

				for (m = 0; m < matrices.length; m += 1) {
					delocatedMatricesTmp.push(matrices[m]);
				}

				for (c = 0; c < colors.length; c += 1) {
					delocatedColorsTmp.push(colors[c]);
				}
			}
		}
	}

	var compressedSymbols = { symbols: symbols };
	var current, previous;

	var delocatedMatrices;
	if (delocatedMatricesTmp.length > 0) {
		delocatedMatricesTmp.sort(cmpMatrices);

		// Removing duplicates
		delocatedMatrices = [delocatedMatricesTmp[0]];
		previous = delocatedMatricesTmp[0];
		for (m = 1; m < delocatedMatricesTmp.length; m += 1) {
			current = delocatedMatricesTmp[m];
			if (areMatricesDifferent(previous, current)) {
				delocatedMatrices.push(current);
				previous = current;
			}
		}
		compressedSymbols.matrices = delocatedMatrices;
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

		compressedSymbols.colors = delocatedColors;
	}

	// Final step: replacing matrices and colors in the animation
	// by their indexes in the delocated matrix and color arrays
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;

		if (children) {
			for (c1 = 0; c1 < children.length; c1 += 1) {
				child = children[c1];

				matrices = child.matrices;
				colors   = child.colors;

				for (m = 0; m < matrices.length; m += 1) {
					matrices[m] = findMatrixIdx(delocatedMatrices, matrices[m]);
				}

				for (c = 0; c < colors.length; c += 1) {
					colors[c] = findColorIdx(delocatedColors, colors[c]);
				}

			}
		}
	}

	return compressedSymbols;
}
module.exports = delocateMatrices;