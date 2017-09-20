
function convertWidthToPixels(key, val) {
	if (key === 'width') {
		return val / 20;
	}
	return val;
}

function convertMoveToPixels(key, val) {
	if (key === 'moveX' || key === 'moveY') {
		return val / 20;
	}
	return val;
}

function copyRecords(records, isLeftFill) {
	// Copy of the records with conversion from twips to pixels
	var recordsCopy = [];

	var nRecords = records.length;
	var r, record;
	if (isLeftFill) {
		for (r = nRecords - 1; r >= 0; r -= 1) {
			record = records[r];
			if (record.c) {
				recordsCopy.push({
					x1: record.x2 / 20, y1: record.y2 / 20,
					cx: record.cx / 20, cy: record.cy / 20,
					x2: record.x1 / 20, y2: record.y1 / 20,
					c:  true,
					i:  record.i,
					l:  true // left fill
				});
			} else {
				recordsCopy.push({
					x1: record.x2 / 20, y1: record.y2 / 20,
					x2: record.x1 / 20, y2: record.y1 / 20,
					c:  false,
					i:  record.i,
					l:  true // left fill
				});
			}
		}
	} else {
		for (r = 0; r < nRecords; r += 1) {
			record = records[r];
			if (record.c) {
				recordsCopy.push({
					x1: record.x1 / 20, y1: record.y1 / 20,
					cx: record.cx / 20, cy: record.cy / 20,
					x2: record.x2 / 20, y2: record.y2 / 20,
					c:  true,
					i:  record.i,
					l:  false // right fill
				});
			} else {
				recordsCopy.push({
					x1: record.x1 / 20, y1: record.y1 / 20,
					x2: record.x2 / 20, y2: record.y2 / 20,
					c:  false,
					i:  record.i,
					l:  false // right fill
				});
			}
		}
	}

	return recordsCopy;
}

function copyFillStyle(fill) {
	var fillStyleCopy = JSON.parse(JSON.stringify(fill, convertMoveToPixels));
	if (fillStyleCopy.type === 'pattern') {
		// Fill style concerns an image
		// Image size is in pixels, being displayed in a space where the measurement unit is a twip
		// all its transformation matrix attributes are 20 times what they should be in pixels
		var matrix = fillStyleCopy.matrix;
		matrix.scaleX /= 20;
		matrix.scaleY /= 20;
		matrix.skewX  /= 20;
		matrix.skewY  /= 20;
		// move attributes have already been converted to pixels during the JSON deep copy
		// matrix.moveX  /= 20;
		// matrix.moveY  /= 20;
	}

	return fillStyleCopy;
}

function processShape(edges) {
	/* jshint maxstatements: 110 */
	/* jshint maxcomplexity: 50 */

	// Separating lines and fills
	var lineShapes = [];
	var fillShapes = [];

	// Creating elements based on their shape type, either fill or line
	for (var e = 0; e < edges.length; e += 1) {
		var edgeSet = edges[e];
		var records = edgeSet.records;

		if (records.length === 0) {
			continue;
		}

		// Generating list of line shapes
		if (edgeSet.lineStyle) {
			lineShapes.push({
				records:   copyRecords(records, false),
				// Deep copy of line style with conversion of line width from twips to pixels
				lineStyle: JSON.parse(JSON.stringify(edgeSet.lineStyle, convertWidthToPixels)),
				styleIdx:  edgeSet.styleIdx,
				lineIdx:   edgeSet.lineIdx
			});
		}

		// Generating list of fill shapes
		if (edgeSet.leftFillIdx) {
			// Shape records with left fills are in reversed order
			fillShapes.push({
				records:   copyRecords(records, true),
				fillStyle: copyFillStyle(edgeSet.leftFill),
				styleIdx:  edgeSet.styleIdx,
				fillIdx:   edgeSet.leftFillIdx
			});
		}

		if (edgeSet.rightFillIdx) {
			fillShapes.push({
				records:   copyRecords(records, false),
				fillStyle: copyFillStyle(edgeSet.rightFill),
				styleIdx:  edgeSet.styleIdx,
				fillIdx:   edgeSet.rightFillIdx
			});
		}
	}

	var idx, f, l, i;
	var styleIdx, lineIdx, fillIdx;

	// Fetching max style idx
	var maxStyleIdx = 0;
	for (f = 0; f < fillShapes.length; f += 1) {
		idx = fillShapes[f].styleIdx;
		if (idx > maxStyleIdx) maxStyleIdx = idx;
	}

	for (l = 0; l < lineShapes.length; l += 1) {
		idx = lineShapes[l].styleIdx;
		if (idx > maxStyleIdx) maxStyleIdx = idx;
	}

	// Initialising style sets
	var nFillStylesPerSet = [];
	var nLineStylesPerSet = [];
	for (idx = 0; idx <= maxStyleIdx; idx += 1) {
		nFillStylesPerSet[idx] = 0;
		nLineStylesPerSet[idx] = 0;
	}

	// Fetching max number of styles per Style set
	for (f = 0; f < fillShapes.length; f += 1) {
		styleIdx = fillShapes[f].styleIdx;
		fillIdx  = fillShapes[f].fillIdx;
		if (fillIdx > nFillStylesPerSet[styleIdx]) nFillStylesPerSet[styleIdx] = fillIdx;
	}

	for (l = 0; l < lineShapes.length; l += 1) {
		styleIdx = lineShapes[l].styleIdx;
		lineIdx  = lineShapes[l].lineIdx;
		if (lineIdx > nLineStylesPerSet[styleIdx]) nLineStylesPerSet[styleIdx] = lineIdx;
	}

	// Generating structure of fills and lines
	// with respect to fill and line indexes
	var shapeStyleSets = [];
	for (idx = 0; idx <= maxStyleIdx; idx += 1) {
		var nFillStyles = nFillStylesPerSet[idx];
		var nLineStyles = nLineStylesPerSet[idx];

		var fills = [];
		for (f = 0; f <= nFillStyles; f += 1) {
			fills[f] = [];
		}

		var lines = [];
		for (l = 0; l <= nLineStyles; l += 1) {
			lines[l] = [];
		}

		shapeStyleSets[idx] = { fills: fills, lines: lines };
	}

	// TODO: document the structure

	// Inserting fills and lines into the structure
	// with respect to their fill and line styles
	for (f = 0; f < fillShapes.length; f += 1) {
		var fillShape = fillShapes[f];
		styleIdx = fillShape.styleIdx;
		fillIdx  = fillShape.fillIdx;
		shapeStyleSets[styleIdx].fills[fillIdx].push(fillShape);
	}

	for (l = 0; l < lineShapes.length; l += 1) {
		var lineShape = lineShapes[l];
		styleIdx = lineShape.styleIdx;
		lineIdx  = lineShape.lineIdx;
		shapeStyleSets[styleIdx].lines[lineIdx].push(lineShape);
	}

	// TODO: speed up this function

	// Reconstructing the fill records for each fill styles
	for (idx = 0; idx <= maxStyleIdx; idx += 1) {
		var idxFills = shapeStyleSets[idx].fills;

		// Creating list of all records for each fill styles
		var recordsPerStyle = [[]]; // first element is a list of empty records
		for (i = 1; i < idxFills.length; i += 1) {
			var fillRecords = [];
			var styleFills = idxFills[i];
			for (f = 0; f < styleFills.length; f += 1) {
				Array.prototype.push.apply(fillRecords, styleFills[f].records);
			}
			recordsPerStyle[i] = fillRecords;
		}

		// TODO: document the reconstruction process

		// Reconstructing the fill records from the list of all records
		for (i = 1; i < idxFills.length; i += 1) {
			if (idxFills[i].length === 0) {
				continue;
			}

			var fillStyle  = idxFills[i][0].fillStyle;
			var allRecords = recordsPerStyle[i];

			var startingEdge = allRecords[0];
			var endingEdge   = startingEdge;

			var newRecords = [startingEdge];
			var fixedFills = [];

			var r1 = 1;
			while (r1 < allRecords.length) {
				if (startingEdge.x1 === endingEdge.x2 && startingEdge.y1 === endingEdge.y2) {
					fixedFills.push({
						records: newRecords,
						fillStyle: fillStyle
					});

					startingEdge = allRecords[r1];
					endingEdge   = allRecords[r1];
					newRecords   = [startingEdge];
					r1 += 1;
				} else {
					var r2 = r1;
					var nextEdge = allRecords[r2];
					while (nextEdge && (nextEdge.x1 !== endingEdge.x2 || nextEdge.y1 !== endingEdge.y2)) {
						r2 += 1;
						nextEdge = allRecords[r2];
					}

					if (nextEdge) {
						// Matching edge was found
						endingEdge = nextEdge;
						newRecords.push(endingEdge);
						allRecords.splice(r2, 1);
					}

					if (!nextEdge || (startingEdge.x1 === endingEdge.x2 && startingEdge.y1 === endingEdge.y2)) {
						// If no record can match endingEdge a new record is started
						fixedFills.push({
							records: newRecords,
							fillStyle: fillStyle
						});

						startingEdge = allRecords[r1];
						endingEdge   = allRecords[r1];
						newRecords   = [startingEdge];
						r1 += 1;
					}
				}
			}

			// Replacing fills
			idxFills[i] = fixedFills;
		}
	}

	return shapeStyleSets;
}

module.exports = processShape;
