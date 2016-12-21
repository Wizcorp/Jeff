'use strict';

function multiplyTransforms(t0, t1) {
	var a0 = t0[0];
	var b0 = t0[1];
	var c0 = t0[2];
	var d0 = t0[3];
	var e0 = t0[4];
	var f0 = t0[5];

	return [
		a0 * t1[0] + c0 * t1[1],
		b0 * t1[0] + d0 * t1[1],
		a0 * t1[2] + c0 * t1[3],
		b0 * t1[2] + d0 * t1[3],
		a0 * t1[4] + c0 * t1[5] + e0,
		b0 * t1[4] + d0 * t1[5] + f0,
	];
}

function computeSymbolDimension(symbols, symbol, transform, frame, originClassName) {

	if (symbol.isGraphic) {
		var bounds = symbol.bounds[0];
		var width  = bounds.right  - bounds.left;
		var height = bounds.bottom - bounds.top;
		var a = transform[0] * width;
		var b = transform[2] * height;
		var c = transform[1] * width;
		var d = transform[3] * height;
		var w = Math.sqrt(a * a + b * b);
		var h = Math.sqrt(c * c + d * d);
		var maxDimForClass = symbol.maxDims[originClassName];
		if (maxDimForClass) {
			maxDimForClass.width  = Math.max(maxDimForClass.width,  w);
			maxDimForClass.height = Math.max(maxDimForClass.height, h);
		} else {
			symbol.maxDims[originClassName] = {
				width:  w,
				height: h
			};
		}
	}


	if (!symbol.isAnimation) {
		return;
	}

	var duration = symbol.duration;
	frame = frame % duration;

	var children = symbol.children;
	for (var c1 = 0; c1 < children.length; c1 += 1) {
		var childData  = children[c1];
		var startFrame = childData.frames[0];
		var endFrame   = childData.frames[1];
		var childId    = childData.id;
		var transforms = childData.transforms;

		if (startFrame <= frame && frame <= endFrame) {
			var childFrame     = frame - startFrame;
			var childTransform = multiplyTransforms(transform, transforms[childFrame]);
			computeSymbolDimension(symbols, symbols[childId], childTransform, childFrame, originClassName);
		}
	}
}

function computeDimensions(symbols, allClasses) {
	for (var className in allClasses) {
		var classIds  = allClasses[className];
		var nbClasses = classIds.length;
		for (var c = 0; c < nbClasses; c += 1) {
			var classSymbol = symbols[classIds[c]];
			var duration    = classSymbol.duration;
			for (var f = 0; f < duration; f += 1) {
				computeSymbolDimension(symbols, classSymbol, [1, 0, 0, 1, 0, 0], f, className);
			}
		}
	}
}

module.exports = computeDimensions;