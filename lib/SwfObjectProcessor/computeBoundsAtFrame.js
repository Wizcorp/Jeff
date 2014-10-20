'use strict';

var transformBound = function (matrix, bounds) {
	var a = matrix[0];
	var b = matrix[1];
	var c = matrix[2];
	var d = matrix[3];
	var e = matrix[4];
	var f = matrix[5];

	var x, y;

	// Top Left
	x = a * bounds.left + c * bounds.top + e;
	y = b * bounds.left + d * bounds.top + f;

	var left    = x;
	var top     = y;
	var right   = x;
	var bottom  = y;

	// Top Right
	x = a * bounds.right + c * bounds.top + e;
	y = b * bounds.right + d * bounds.top + f;

	left    = Math.min(x, left);
	top     = Math.min(y, top);
	right   = Math.max(x, right);
	bottom  = Math.max(y, bottom);

	// Bottom Right
	x = a * bounds.right + c * bounds.bottom + e;
	y = b * bounds.right + d * bounds.bottom + f;

	left    = Math.min(x, left);
	top     = Math.min(y, top);
	right   = Math.max(x, right);
	bottom  = Math.max(y, bottom);

	// Bottom Right
	x = a * bounds.left + c * bounds.bottom + e;
	y = b * bounds.left + d * bounds.bottom + f;

	left    = Math.min(x, left);
	top     = Math.min(y, top);
	right   = Math.max(x, right);
	bottom  = Math.max(y, bottom);

	return { left: left, top: top, right: right, bottom: bottom };
};

function computeBoundsAtFrame(symbol, symbols, frame) {
	/* jshint maxstatements: 100 */

	var duration = symbol.duration || 1;
	frame = frame % duration;

	if (symbol.bounds && symbol.bounds[frame]) {
		return symbol.bounds[frame];
	}

	var children = symbol.children;
	if (!children || children.length === 0) {
		if (!symbol.bounds) {
			symbol.bounds = [];
		}
		symbol.bounds[frame] = null;
		return null;
	}

	// frame bounds
	var fLeft   = Infinity;
	var fTop    = Infinity;
	var fRight  = - Infinity;
	var fBottom = - Infinity;

	for (var c = children.length - 1; c >= 0; c -= 1) {
		var child = children[c];
		var childData = symbols[child.id];

		if (!childData) {
			// symbol not found in symbols!
			continue;
		}

		// Verifying that the child exists for given frame
		if (frame < child.frames[0] || child.frames[1] < frame || child.maskEnd) {
			continue;
		}

		var bbox = computeBoundsAtFrame(childData, symbols, frame - child.frames[0]);
		if (bbox === null) {
			continue;
		}

		var matrix = child.matrices[frame - child.frames[0]];
		var bounds = transformBound(matrix, bbox);

		// child bounds
		var cLeft   = bounds.left;
		var cTop    = bounds.top;
		var cRight  = bounds.right;
		var cBottom = bounds.bottom;


		if (child.maskStart) {
			// Computing bounding box of masked elements

			// masked bounds
			var mLeft   = Infinity;
			var mTop    = Infinity;
			var mRight  = - Infinity;
			var mBottom = - Infinity;

			while (!children[--c].maskEnd) {
				var clippedChild = children[c];
				var clippedChildData = symbols[clippedChild.id];

				if (!clippedChildData) {
					// symbol not found in symbols!
					continue;
				}

				// Verifying that the child exists for given frame
				if (frame < clippedChild.frames[0] || clippedChild.frames[1] < frame) {
					continue;
				}

				var clippedBbox = computeBoundsAtFrame(clippedChildData, symbols, frame - clippedChild.frames[0]);
				if (clippedBbox === null) {
					continue;
				}

				var clippedMatrix = clippedChild.matrices[frame - clippedChild.frames[0]];
				var clippedBounds = transformBound(clippedMatrix, clippedBbox);

				var ccLeft   = clippedBounds.left;
				var ccTop    = clippedBounds.top;
				var ccRight  = clippedBounds.right;
				var ccBottom = clippedBounds.bottom;

				var clipWithinOnX = (cLeft <= ccLeft && ccLeft <= cRight)  || (cLeft  <= ccRight  && ccRight  <= cRight);
				var clipWithinOnY = (cTop  <= ccTop  && ccTop  <= cBottom) || (cTop   <= ccBottom && ccBottom <= cBottom);

				var maskWithinOnX = (ccLeft <= cLeft && cLeft <= ccRight)  || (ccLeft <= cRight  && cRight  <= ccRight);
				var maskWithinOnY = (ccTop  <= cTop  && cTop  <= ccBottom) || (ccTop  <= cBottom && cBottom <= ccBottom);

				if ((clipWithinOnX || maskWithinOnX) && (maskWithinOnY || clipWithinOnY)) {
					mLeft   = Math.min(ccLeft,   mLeft);
					mTop    = Math.min(ccTop,    mTop);
					mRight  = Math.max(ccRight,  mRight);
					mBottom = Math.max(ccBottom, mBottom);
				}
			}

			cLeft   = Math.max(cLeft,   mLeft);
			cTop    = Math.max(cTop,    mTop);
			cRight  = Math.min(cRight,  mRight);
			cBottom = Math.min(cBottom, mBottom);
		}

		fLeft   = Math.min(cLeft,   fLeft);
		fTop    = Math.min(cTop,    fTop);
		fRight  = Math.max(cRight,  fRight);
		fBottom = Math.max(cBottom, fBottom);
	}

	var frameBounds;
	if (fLeft <= fRight && fTop <= fBottom) {
		frameBounds = {
			left:   fLeft,
			right:  fRight,
			top:    fTop,
			bottom: fBottom
		};
	} else {
		frameBounds = null;
	}

	if (!symbol.bounds) {
		symbol.bounds = [];
	}

	symbol.bounds[frame] = frameBounds;

	return symbol.bounds[frame];
}

module.exports = computeBoundsAtFrame;