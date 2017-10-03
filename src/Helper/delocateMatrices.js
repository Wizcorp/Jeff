var comparators = require('./comparators.js');
var areObjectsDifferent    = comparators.areObjectsDifferent;
var areTransformsDifferent = comparators.areTransformsDifferent;
var areColorsDifferent     = comparators.areColorsDifferent;

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

function findFilterIdx(filters, filter) {
	// Filters are NOT supposed sorted
	for (var f = 0; f < filters.length; f += 1) {
		if (areObjectsDifferent(filter, filters[f])) {
			continue;
		}

		return f;
	}

	return -1;
}

function delocateMatrices(exportData) {
	/* jshint maxstatements: 100 */
	var delocatedTransformsTmp = [];
	var delocatedColorsTmp     = [];

	// TODO: delocate filters
	var delocatedFilters = [];

	var symbols = exportData.symbols;

	var t, c;
	var id, symbol, children;
	var c1, child, transforms, colors;
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;

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

			var filters = child.filters;
			if (filters) {
				for (var f = 0; f < filters.length; f += 1) {
					// searching for current filter in list of existing filters
					// N.B not using binary search as for transformation and color matrices
					// (we supposed that few filters are used, therefore no need to optimized)
					var filter = filters[f];
					var filterIndex = findFilterIdx(delocatedFilters, filter);
					if (filterIndex === -1) {
						filterIndex = delocatedFilters.length;
						delocatedFilters.push(filter);
					}
					filters[f] = filterIndex;
				}
			}
		}
	}

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
		exportData.transforms = delocatedTransforms;
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

		exportData.colors = delocatedColors;
	}

	if (delocatedFilters.length > 0) {
		exportData.filters = delocatedFilters;
	}

	// Final step: replacing transforms and colors in the animations
	// by their indexes in the delocated matrix and color arrays
	for (id in symbols) {
		symbol = symbols[id];
		children = symbol.children;
		for (c1 = 0; c1 < children.length; c1 += 1) {
			child = children[c1];
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
module.exports = delocateMatrices;