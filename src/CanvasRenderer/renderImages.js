var getCanvas      = require('./GetCanvas');
var CanvasRenderer = require('./main');
var elements       = require('../elements/');
var comparators    = require('../Helper/comparators.js');

var areObjectsDifferent    = comparators.areObjectsDifferent;
var areTransformsDifferent = comparators.areTransformsDifferent;
var areColorsDifferent     = comparators.areColorsDifferent;

var Sprite = elements.Sprite;
var Bounds = elements.Bounds;

CanvasRenderer.prototype._getMaxDimensions = function (sprites) {
	var spritesMaxDims = {};
	var classRatios    = this._options.classRatios || {};
	var hasFixedSize   = this._options.fixedSize !== undefined;

	var className;
	var classGroupList = this._extractor._classGroupList;

	// Updating class ratios with respect to the fixed size dimension
	if (hasFixedSize) {

		var classRatiosTmp = {};
		var fixedWidth     = this._options.fixedSize.width;
		var fixedHeight    = this._options.fixedSize.height;
		var symbols        = this._extractor._symbols;

		for (className in classGroupList) {
			var classId = classGroupList[className];
			var symbol  = symbols[classId];

			// TODO: use whole animation bounds, not just first frame
			var bounds = symbol.bounds;
			if (bounds) {
				var widthRatio  = fixedWidth  / (bounds.right  - bounds.left);
				var heightRatio = fixedHeight / (bounds.bottom - bounds.top);
				classRatiosTmp[className] = (classRatios[className] ? classRatios[className] : 1) * Math.min(widthRatio, heightRatio);
			} else {
				classRatiosTmp[className] = (classRatios[className] ? classRatios[className] : 1);
			}

		}
		classRatios = classRatiosTmp;
	}

	var maxDimForClass, classRatio;
	for (var id in sprites) {
		var sprite = sprites[id];
		var maxWidth  = 0;
		var maxHeight = 0;
		var maxDims = sprite.maxDims;
		for (className in classGroupList) {

			maxDimForClass = maxDims[className];
			if (maxDimForClass) {
				classRatio = classRatios[className] || 1;
				maxWidth  = Math.max(maxWidth,  classRatio * maxDimForClass.width);
				maxHeight = Math.max(maxHeight, classRatio * maxDimForClass.height);
			}
		}

		spritesMaxDims[id] = { width: maxWidth, height: maxHeight };
	}

	return spritesMaxDims;
};

CanvasRenderer.prototype._setSpriteDimensions = function (sprites, spriteMaxDims) {

	var spriteDims = {};
	for (var id in sprites) {
		var sprite = sprites[id];

		// Computing element dimension before scaling to ratio
		var bounds = sprite.bounds;

		var x, y, w, h;
		var rendersImage = true;
		if (sprite.isImage) {
			var image = this._images[id];
			x = 0;
			y = 0;
			w = image.width;
			h = image.height;
		} else {
			x = bounds.left;
			y = bounds.top;
			w = bounds.right  - bounds.left;
			h = bounds.bottom - bounds.top;

			// Determining if the sprite consists exclusively in images
			if (sprite.isShape) {
				var shapes = sprite.shapes;
				var s = 0;
				while (rendersImage && s < shapes.length) {
					var fills = shapes[s].fills;
					var f = 1;
					while (rendersImage && f < fills.length) {
						if (fills[f].length >= 1) {
							var fillStyle = fills[f][0].fillStyle;
							rendersImage = fillStyle && (fillStyle.type === 'pattern');
						}
						f += 1;
					}
					s += 1;
				}
			} else {
				// TODO: if an element is not renderable it should not be in the list of symbols to export
				if (this._options.verbosity >= 3) {
					console.warn('[CanvasRenderer._setSpriteDimensions] sprite ' + sprite.id + ' is empty');
				}
			}
		}

		// Computing sprite ratio for rendering
		var spriteRatio = this._extractor._fileGroupRatio;

		// Reducing the size of the element if it is bigger than the maximum allowed dimension
		var spriteMaxDim = spriteMaxDims[id];
		var maxWidth  = rendersImage ? w : spriteMaxDim.width;
		var maxHeight = rendersImage ? h : spriteMaxDim.height;

		var spriteWidth;
		var spriteHeight;
		if (maxWidth === 0 || maxHeight === 0) {
			spriteRatio  = 0;
			spriteWidth  = 1;
			spriteHeight = 1;
		} else {
			var widthRatio   = w / maxWidth;
			var heightRatio  = h / maxHeight;

			if (widthRatio > heightRatio) {
				spriteRatio /= widthRatio;
			} else {
				spriteRatio /= heightRatio;
			}

			spriteWidth  = Math.ceil(w * spriteRatio);
			spriteHeight = Math.ceil(h * spriteRatio);

			var ratioToMaxDim = Math.sqrt((this._options.maxImageDim * this._options.maxImageDim) / (spriteWidth * spriteHeight));
			if (ratioToMaxDim < 1) {
				spriteWidth  *= ratioToMaxDim;
				spriteHeight *= ratioToMaxDim;
				spriteRatio  *= ratioToMaxDim;
			}
		}

		// Saving element position and dimension in the atlas
		spriteDims[id] = {
			x:  x,
			y:  y,
			w:  w,
			h:  h,
			sx: 0,
			sy: 0,
			sw: spriteWidth,
			sh: spriteHeight,
			dx: x * spriteRatio,
			dy: y * spriteRatio,
			ratio:  spriteRatio
		};
	}

	return spriteDims;
};

CanvasRenderer.prototype._getSpritesToRender = function () {
	var sprites = this._extractor._sprites;
	var images = this._images;
	var spritesToRender = {};
	for (var spriteId in sprites) {
		var sprite = sprites[spriteId];
		if (sprite.isImage) {
			var image = images[spriteId];
			if (!image) {
				console.warn('[CanvasRenderer.getSpritesToRender] sprite image not rendered', spriteId);
				continue;
			}
		}
		spritesToRender[spriteId] = sprite;
	}
	return spritesToRender;
};

CanvasRenderer.prototype._renderSprites = function (sprites, spriteDims, imageMap) {
	for (var id in sprites) {
		var canvas  = getCanvas();
		var context = canvas.getContext('2d');

		var sprite    = sprites[id];
		var dimensions = spriteDims[id];

		canvas.width  = dimensions.sw;
		canvas.height = dimensions.sh;
		if (sprite.isShape) {
			var transform = [dimensions.ratio, 0, 0, dimensions.ratio, - dimensions.dx, - dimensions.dy];
			this._drawShapes(sprite.shapes, canvas, context, transform);
		}

		if (sprite.isImage) {
			var image = this._images[id];
			if (!image) {
				continue;
			}

			context.drawImage(image, - dimensions.dx, - dimensions.dy, dimensions.sw, dimensions.sh);
		}

		imageMap[id] = canvas;
	}
};

function SymbolInstance(id, bounds, filters, blendModes) {
	this.id = id;
	this.bounds = bounds;
	this.transforms = [];
	this.colors     = [];

	this.filters    = filters;
	this.blendModes = blendModes;
}

SymbolInstance.prototype.constructFrame = function (frame, ratio, fixedSize) {
	var frameBounds = this.bounds[frame];
	if (!frameBounds) {
		return null;
	}

	var x = frameBounds.left;
	var y = frameBounds.top;
	var w = frameBounds.right  - frameBounds.left;
	var h = frameBounds.bottom - frameBounds.top;

	var filters = this.filters && this.filters[frame];
	if (filters) {
		var maxBlurX = 0;
		var maxBlurY = 0;
		for (var f = 0; f < filters.length; f += 1) {
			var filter = filters[f];
			maxBlurX = Math.max(filter.blurX, maxBlurX);
			maxBlurY = Math.max(filter.blurY, maxBlurY);
		}
		x -= maxBlurX / 2;
		y -= maxBlurY / 2;
		w += maxBlurX;
		h += maxBlurY;
	}

	var scaleX = ratio;
	var scaleY = ratio;
	if (fixedSize) {
		scaleX *= fixedSize.width  / w;
		scaleY *= fixedSize.height / h;
	}

	var canvas = getCanvas();
	canvas.width  = Math.ceil(scaleX * w);
	canvas.height = Math.ceil(scaleY * h);

	if (canvas.width === 0 || canvas.height === 0) {
		return null;
	}

	this.transforms[frame] = [scaleX, 0, 0, scaleY, - scaleX * x, - scaleY * y];
	this.colors[frame]     = IDENTITY_COLOR;

	return {
		x: x, y: y,
		w: w, h: h,
		bounds: frameBounds,
		transform: this.transforms[frame],
		canvas: canvas,
		context: canvas.getContext('2d'),
	};
};

IDENTITY_TRANSFORM = [1, 0, 0, 1, 0, 0];
IDENTITY_COLOR     = [1, 1, 1, 1, 0, 0, 0, 0];

CanvasRenderer.prototype._renderFrames = function (imageMap, spriteProperties) {

	var fixedSize = this._options.fixedSize;
	var ratio     = this._extractor._fileGroupRatio;

	for (var className in this._extractor._classGroupList) {

		var classId = this._extractor._classGroupList[className];
		var symbol  = this._extractor._symbols[classId];

		var bounds = symbol.containerBounds || symbol.bounds;
		if (!bounds) {
			continue;
		}

		var frameCount = symbol.frameCount;
		var instance = new SymbolInstance(classId, bounds);

		var f, frames = [];
		if (this._options.renderFrames instanceof Array) {
			var framesToRender  = this._options.renderFrames;
			var nFramesToRender = framesToRender.length;
			for (f = 0; f < nFramesToRender; f += 1) {
				frames.push(framesToRender[f] - 1);
			}
		} else {
			for (f = 0; f < frameCount; f += 1) {
				frames.push(f);
			}
		}

		var nFrames = frames.length;
		for (f = 0; f < nFrames; f += 1) {
			var frame = frames[f];

			var frameCanvas = instance.constructFrame(frame, ratio, fixedSize);
			if (!frameCanvas) {
				continue;
			}

			var canvas = frameCanvas.canvas;
			var context = frameCanvas.context;
			this._renderSymbol(canvas, context, IDENTITY_TRANSFORM, IDENTITY_COLOR, instance, frame, false);

			var frameId = this._options.onlyOneFrame ? symbol.className : symbol.frameNames[frame];
			imageMap[frameId] = canvas;
			spriteProperties[frameId] = {
				x: frameCanvas.x,
				y: frameCanvas.y,
				w: frameCanvas.w,
				h: frameCanvas.h,
				sx: 0, sy: 0,
				sw: canvas.width,
				sh: canvas.height,
				frameId: frameId
			};
		}
	}
};

CanvasRenderer.prototype._renderImages = function () {
	var imageMap = {};
	var spriteProperties = {};
	if (this._options.renderFrames) {
		this._renderFrames(imageMap, spriteProperties);
	} else {
		// 1 - Generating list of sprites to render
		var sprites = this._getSpritesToRender();

		// 2 - Computing minimum rendering size that will guarantee lossless quality for each sprite
		var spriteMaxDims = this._getMaxDimensions(sprites);

		// 3 - Computing sprite dimensions with respect to their maximum dimensions and required ratios
		spriteProperties = this._setSpriteDimensions(sprites, spriteMaxDims);

		// 4 - Rendering sprites and storing in imageMap
		this._renderSprites(sprites, spriteProperties, imageMap);
	}

	// End of the rendering
	// All swf objects should have been correctly rendered at this point
	this._rendering = false;
	if (this._callback) {
		this._callback(imageMap, spriteProperties);
	}
};


CanvasRenderer.prototype.prerenderSymbols = function (symbols, sprites, imageMap, spriteProperties) {
	// Prerendering symbols when possible for optimized runtime performance
	var frame = 0;
	var ratio = this._extractor._fileGroupRatio;
	var prerenderBlendings = this._extractor._options.prerenderBlendings;
	var collapseAnimations = this._extractor._options.collapse;

	var s, symbol, symbolId;
	var c, child, children, childId, childSprite;

	// Going through symbols in order
	var symbolIds = [];
	for (symbolId in symbols) {
		symbolIds.push(parseInt(symbolId));
	}

	symbolIds.sort(function (a, b) { return a - b; });

	// "main" symbol placed at the end if exist
	if (symbolIds[0] === 0) {
		symbolIds.shift();
		symbolIds.push(0);
	}

	// Counting number of occurences of each element
	// i.e how many different symbols each element belongs to
	var elementOccurences = {};
	var elementSymbols    = {};
	for (s = 0; s < symbolIds.length; s += 1) {
		symbolId = symbolIds[s];
		symbol = symbols[symbolId];
		children = symbol.children;

		var symbolElements = {};
		for (c = 0; c < children.length; c += 1) {
			child = children[c];
			if (child.maskStart || child.maskEnd) {
				continue;
			}

			childId = child.id;
			if (symbolElements[childId]) {
				continue
			}
			symbolElements[childId] = true;

			if (!elementSymbols[childId]) {
				elementSymbols[childId] = [symbolId];
			} else {
				elementSymbols[childId].push(symbolId);
			}

			if (!elementOccurences[childId]) {
				elementOccurences[childId] = 1;
			} else {
				elementOccurences[childId] += 1;
			}
		}
	}

	// Trimming symbol frames in opposite order of appearance
	for (s = symbolIds.length - 1; s >= 0; s -= 1) {
		symbolId = symbolIds[s];
		symbol = symbols[symbolId];
		if (symbol.className || symbol.frameCount === 1) {
			// cannot be trimmed
			continue;
		}

		// getting maximum playable duration
		var maxFrameCount = 1;
		var appearances = elementSymbols[symbolId];
		for (a = 0; a < appearances.length; a += 1) {
			var appearance = appearances[a];
			if (maxFrameCount < appearance.frameCount) {
				maxFrameCount = appearance.frameCount;
			}
		}

		if (maxFrameCount >= symbol.frameCount) {
			// cannot be trimmed
			continue;
		}

		children = symbol.children;
		for (c = 0; c < children.length; c += 1) {
			child = children[c];
			if (child.frames[0] >= maxFrameCount) {
				children.splice(c, 1);
				c -= 1;
			} else if (child.frames[1] >= maxFrameCount) {
				var sliceSize = maxFrameCount - child.frames[0];
				child.transforms = child.transforms.slice(0, sliceSize);
				child.color      = child.colors.slice(0, sliceSize);
				if (child.filters)    child.filters    = child.filters.slice(0, sliceSize);
				if (child.blendModes) child.blendModes = child.blendModes.slice(0, sliceSize);
			}
		}

		symbol.frameCount = maxFrameCount;
	}

	var instance, frameCanvas;
	var collapseableSprites = {};

	// List of symbols that can be merged
	for (s = 0; s < symbolIds.length; s += 1) {
		symbolId = symbolIds[s];
		symbol = symbols[symbolId];

		var bounds = symbol.containerBounds || symbol.bounds;
		if (!bounds) {
			continue;
		}

		instance = new SymbolInstance(symbolId, bounds);
		frameCanvas = instance.constructFrame(frame, ratio);
		if (!frameCanvas) {
			continue;
		}

		// prerendering only if all children are sprites with no class identification
		var frameCount = symbol.frameCount;
		var isPrerenderable = true;
		var isSymbolStatic  = true;
		var mergeableElements = [];

		// reasons for not being able to prerender the symbol
		var frameDiscrepancy      = false;
		var containsSymbol        = false;
		var tooManyFramcs         = false;
		var spriteInOtherSymbol   = false;
		var hasIdentifiedInstance = false;
		var hasBlendedSprite      = false;
		var hasIdentifiedSprite   = false;

		children = symbol.children;
		for (c = 0; c < children.length; c += 1) {
			child = children[c];
			childId = child.id;

			var frames = child.frames;
			if (frames[1] - frames[0] + 1 !== frameCount) {
				isSymbolStatic  = false;
				isPrerenderable = false;
				frameDiscrepancy = true;
				break;
			}

			childElement = sprites[childId];
			if (!childElement) {
				containsSymbol = true;
				isSymbolStatic  = false;
				isPrerenderable = false;
				break;
			}

			if (frameCount > 1 && isSymbolStatic) {
				var isChildStatic = true;

				var transforms = child.transforms;
				var colors     = child.colors;
				var blendModes = child.blendModes;
				var filters    = child.filters;

				var modelTransform = transforms[0];
				var modelColor     = colors[0];
				var modelBlendMode = blendModes && blendModes[0];
				var modelFilter    = filters    && filters[0];
				for (var f = 1; f < transforms.length; f += 1) {
					if (areTransformsDifferent(transforms[f], modelTransform) ||
						areColorsDifferent(colors[f], modelColor) ||
						modelBlendMode && (modelBlendMode !== blendModes[f]) ||
						modelFilter && areObjectsDifferent(modelFilter, filters[f])
					) {
						isChildStatic = false;
						break;
					}
				}

				if (!isChildStatic) {
					isSymbolStatic  = false;
					isPrerenderable = false;
					tooManyFramcs = true;
					break;
				}
			}

			// if (elementOccurences[childId] > 1 && !child.filters) {
			// 	// if child has a filter, it can be considered unique
			// 	isPrerenderable = false;
			// 	spriteInOtherSymbol = true;
			// }

			if (child.name) {
				isPrerenderable = false;
				hasIdentifiedInstance = true;
			}

			if (child.blendModes && !prerenderBlendings) {
				isPrerenderable = false;
				hasBlendedSprite = true;
			}

			if (childElement.className) {
				isPrerenderable = false;
				hasIdentifiedSprite = true;
			}

			if (isPrerenderable) {
				mergeableElements.push(childId);
			}
		}

		// For debug purpose:
		// if (!isPrerenderable) {
		// 	console.error('	frameDiscrepancy', frameDiscrepancy);
		// 	console.error('	containsSymbol', containsSymbol);
		// 	console.error('	tooManyFramcs', tooManyFramcs);
		// 	console.error('	spriteInOtherSymbol', spriteInOtherSymbol);
		// 	console.error('	hasIdentifiedInstance', hasIdentifiedInstance);
		// 	console.error('	hasBlendedSprite', hasBlendedSprite);
		// 	console.error('	hasIdentifiedSprite', hasIdentifiedSprite);
		// }


		if (collapseAnimations && isSymbolStatic && frameCount > 1) {
			// Can collapse the frames!
			collapseFrames(symbol);
			frameCount = 1;
		}

		var firstChild = children[0];
		var canCollapseAsSprite = false;
		if (collapseAnimations &&
			isPrerenderable &&
			children.length === 1 &&
			frameCount === 1 &&
			!firstChild.filters &&
			!firstChild.blendModes &&
			sprites[firstChild.id]
		) {

			var transform = firstChild.transforms[0];
			var color     = firstChild.colors[0];
			canCollapseAsSprite =
				transform[0] === 1 &&
				transform[1] === 0 &&
				transform[2] === 0 &&
				transform[3] === 1 &&
				color[0] === 1 &&
				color[1] === 1 &&
				color[2] === 1 &&
				color[3] === 1 &&
				color[4] === 0 &&
				color[5] === 0 &&
				color[6] === 0 &&
				color[7] === 0;
		}

		if (isPrerenderable && !canCollapseAsSprite) {
			var canvas  = frameCanvas.canvas;
			var context = frameCanvas.context;
			this._renderSymbol(canvas, context, IDENTITY_TRANSFORM, IDENTITY_COLOR, instance, frame, false);

			// Creating sprite replacing symbol
			var sprite = new Sprite();
			sprite.id = symbolId;
			sprite.isImage = true;

			sprite.duration  = symbol.duration;
			sprite.className = symbol.className;
			sprite.bounds    = symbol.bounds[0];

			var x = frameCanvas.x;
			var y = frameCanvas.y;
			var w = frameCanvas.w;
			var h = frameCanvas.h;

			// Referencing image associated with sprite
			this._images[symbolId] = canvas;

			// Adding sprite to list of sprites
			sprites[symbolId] = sprite;
			imageMap[symbolId] = canvas;

			spriteProperties[symbolId] = {
				x: frameCanvas.x,
				y: frameCanvas.y,
				w: frameCanvas.w,
				h: frameCanvas.h,
				sx: 0, sy: 0,
				sw: canvas.width,
				sh: canvas.height
			};

			delete symbols[symbolId];
		} else {
			if (collapseAnimations) {

				if (canCollapseAsSprite) {
					var firstChildId = firstChild.id;
					var newSprite = JSON.parse(JSON.stringify(sprites[firstChildId]));
					var newSpriteProperties = JSON.parse(JSON.stringify(spriteProperties[firstChildId]));

					newSprite.id = symbolId;
					newSprite.duration = symbol.duration;
					newSprite.className = symbol.className;

					newSpriteProperties.x += firstChild.transforms[0][4];
					newSpriteProperties.y += firstChild.transforms[0][5];

					// Referencing image associated with sprite
					this._images[symbolId] = this._images[firstChildId];

					// Adding sprite to list of sprites
					sprites[symbolId] = newSprite;
					imageMap[symbolId] = imageMap[firstChildId];
					spriteProperties[symbolId] = newSpriteProperties;

					collapseSprite(firstChild, symbolId, symbols, elementSymbols[symbolId]);

					delete symbols[symbolId];

					elementOccurences[symbolId] += elementOccurences[firstChildId] - 1;
				} else {
					// Collapsing the animation hierarchy
					collapseSymbol(symbol, symbols, sprites, prerenderBlendings);
				}
			}
		}

	}


	// Making list of unused elements to remove from list of symbols and sprites
	// And prerendering sprites that have a filters applied
	// for improved runtime performance
	var usedElements = {};
	var newSpriteId = symbolIds[symbolIds.length - 1] + 1;

	// list of prerendered filtered elements per 
	var prerenderedFilteredElements = {};

	for (var symbolId in symbols) {
		var symbol = symbols[symbolId];
		var frameCount = symbol.frameCount;
		var children = symbol.children;
		for (var c = 0; c < children.length; c += 1) {
			var child = children[c];
			var childId = child.id;

			var sprite = sprites[childId];
			if (sprite && frameCount === 1 && child.filters) {

				var instance = new SymbolInstance(childId, [sprite.bounds], child.filters, child.blendModes);
				var frameCanvas = instance.constructFrame(frame, ratio);

				if (prerenderedFilteredElements[childId]) {
					var prerenders = prerenderedFilteredElements[childId];
					var prerenderId = null;
					for (var p = 0; p < prerenders.length; p += 1) {
						var prerender = prerenders[p];
						if (prerender.dimensions.x === frameCanvas.x &&
							prerender.dimensions.y === frameCanvas.y &&
							prerender.dimensions.w === frameCanvas.w &&
							prerender.blendMode === (child.blendModes && child.blendModes[0]) && 
							!areObjectsDifferent(prerender.filters, child.filters[0])
						) {
							prerenderId = prerender.spriteId;
							break;
						}
					}

					if (prerenderId) {
						child.id = prerenderId;
						continue;
					}
				}

				child.id = newSpriteId;
				newSpriteId += 1;

				this._renderSymbol(
					frameCanvas.canvas,
					frameCanvas.context,
					IDENTITY_TRANSFORM,
					IDENTITY_COLOR,
					instance,
					frame,
					false,
					true
				);

				newSprite = JSON.parse(JSON.stringify(sprite));
				newSprite.id = newSpriteId;
				newSprite.className = symbol.className;

				// Referencing image associated with sprite
				this._images[newSpriteId] = frameCanvas.canvas;

				// Adding sprite to list of
				sprites[newSpriteId]  = newSprite;
				imageMap[newSpriteId] = frameCanvas.canvas;

				var spriteDimensions = JSON.parse(JSON.stringify(spriteProperties[childId]));
				spriteDimensions.x = frameCanvas.x;
				spriteDimensions.y = frameCanvas.y;
				spriteDimensions.w = frameCanvas.w;
				spriteDimensions.h = frameCanvas.h;

				spriteProperties[newSpriteId] = spriteDimensions;

				if (!prerenderedFilteredElements[childId]) {
					prerenderedFilteredElements[childId] = [];
				}

				prerenderedFilteredElements[childId].push({
					filters: child.filters[0],
					blendMode: child.blendModes && child.blendModes[0],
					dimensions: spriteDimensions,
					spriteId: newSpriteId
				});

				child.id = newSpriteId;
				childId = newSpriteId;
			}
			usedElements[childId] = true;
		}
	}

	for (symbolId in symbols) {
		if (!usedElements[symbolId] && !symbols[symbolId].className) {
			delete symbols[symbolId];
		}
	}

	for (var spriteId in sprites) {
		if (!usedElements[spriteId] && !sprites[spriteId].className) {
			delete sprites[spriteId];
			delete imageMap[spriteId];
			delete spriteProperties[spriteId];
		}
	}
};

function transformMultiplication(transformA, transformB) {
	var a0 = transformA[0];
	var b0 = transformA[1];
	var c0 = transformA[2];
	var d0 = transformA[3];
	var e0 = transformA[4];
	var f0 = transformA[5];

	var a1 = transformB[0];
	var b1 = transformB[1];
	var c1 = transformB[2];
	var d1 = transformB[3];
	var e1 = transformB[4];
	var f1 = transformB[5];

	return [
		a0 * a1 + c0 * b1,
		b0 * a1 + d0 * b1,
		a0 * c1 + c0 * d1,
		b0 * c1 + d0 * d1,
		a0 * e1 + c0 * f1 + e0,
		b0 * e1 + d0 * f1 + f0
	];
};

function colorMultiplication(colorA, colorB) {
	var rm0 = colorA[0];
	var gm0 = colorA[1];
	var bm0 = colorA[2];
	var am0 = colorA[3];
	var ra0 = colorA[4];
	var ga0 = colorA[5];
	var ba0 = colorA[6];
	var aa0 = colorA[7];

	var rm1 = colorB[0];
	var gm1 = colorB[1];
	var bm1 = colorB[2];
	var am1 = colorB[3];
	var ra1 = colorB[4];
	var ga1 = colorB[5];
	var ba1 = colorB[6];
	var aa1 = colorB[7];

	return [
		rm1 * rm0,
		gm1 * gm0,
		bm1 * bm0,
		am1 * am0,
		ra1 * rm0 + ra0,
		ga1 * gm0 + ga0,
		ba1 * bm0 + ba0,
		aa1 * am0 + aa0
	];
}

function collapseSprite(collapseableSprite, spriteId, symbols, symbolIds) {
	if (!symbolIds) {
		return;
	}

	// Propagating transformations of collapseble sprites
	var spriteTransform = collapseableSprite.transforms[0];
	var spriteColor     = collapseableSprite.colors[0];
	// var spriteFilter    = collapseableSprite.filters && collapseableSprite.filters[0];
	// var spriteBlendMode = collapseableSprite.blendModes && collapseableSprite.blendModes[0];

	for (var s = 0; s < symbolIds.length; s += 1) {
		var symbolId = symbolIds[s];
		var symbol = symbols[symbolId];
		var children = symbol.children;
		for (var c = 0; c < children.length; c += 1) {
			var child = children[c];
			var childId = child.id;
			if (childId === spriteId) {

				var transforms = child.transforms;
				var colors     = child.colors;

				// var filters    = [];
				// var blendModes = [];
				// if (spriteFilter)    { child.filters    = filters; }
				// if (spriteBlendMode) { child.blendModes = blendModes; }

				for (var f = 0; f < transforms.length; f += 1) {
					transforms[f] = transformMultiplication(transforms[f], spriteTransform);
					colors[f]     = colorMultiplication(colors[f], spriteColor);
					// if (spriteFilter)    { filters[f]    = spriteFilter; }
					// if (spriteBlendMode) { blendModes[f] = spriteBlendMode; }
				}
			}
		}
	}
}

function collapseFrames(symbol) {
	var children = symbol.children;
	for (var c = 0; c < children.length; c += 1) {
		var child = children[c];
		child.transforms = [child.transforms[0]];
		child.colors     = [child.colors[0]];
		child.frames     = [0, 0];
		if (child.blendModes) { child.blendModes = [child.blendModes[0]]; }
		if (child.filters)    { child.filters    = [child.filters[0]]; }
		if (child.name)       { child.name       = child.name; }
	}
	symbol.frameCount = 1;
}

function collapseSymbol(symbol, symbols, sprites, prerenderBlendings) {
	// Moving any element that is not referenced by a className up the heirarchy
	// by precomputing its transformation in each animation it appears in

	var newChildren = [];
	var children = symbol.children;
	for (var c = 0; c < children.length; c += 1) {
		var child = children[c];
		var childId = child.id;

		if (sprites[childId]) {
			newChildren.push(child);
			continue;
		}

		var childSymbol = symbols[childId];
		if (childSymbol.className || child.name) {
			newChildren.push(child);
			continue;
		}

		var hasRenderingConstraints = child.blendModes || child.filters;
		if (hasRenderingConstraints && childSymbol.children.length > 1 ||
			child.blendModes && !prerenderBlendings) {
			newChildren.push(child);
			continue;
		}

		// instance can be collapsed!
		Array.prototype.push.apply(newChildren, collapseInstance(childSymbol, child));
	}

	symbol.children = newChildren;
}

function collapseInstance(symbol, instance) {
	var firstFrameParent = instance.frames[0];
	var transforms       = instance.transforms;
	var colors           = instance.colors;

	// Applying transformation propagation on each child
	var a0, b0, c0, d0, e0, f0;
	var a1, b1, c1, d1, e1, f1;

	var rm0, gm0, bm0, am0, ra0, ga0, ba0, aa0;
	var rm1, gm1, bm1, am1, ra1, ga1, ba1, aa1;

	var instanceFrameCount = instance.frames[1] - instance.frames[0] + 1;
	var frameCount = symbol.frameCount;
	var collapsedChildren  = [];
	var children = symbol.children;
	for (var c = 0; c < children.length; c += 1) {
		var childInstance = children[c];

		var childTransforms = childInstance.transforms;
		var childColors     = childInstance.colors;
		var childFrameCount = childInstance.frames[1] - childInstance.frames[0] + 1;

		var newTransforms   = [];
		var newColors       = [];
		var firstFrameChild = 0;

		var collapsedChild;
		for (var f = 0; f < instanceFrameCount; f += 1) {

			// child transformation
			var childFrame = f % frameCount - childInstance.frames[0];
			if (childFrame < 0 || childFrameCount <= childFrame) {
				if (newTransforms.length > 0) {
					collapsedChild = JSON.parse(JSON.stringify(childInstance));
					collapsedChild.transforms = newTransforms;
					collapsedChild.colors     = newColors;
					collapsedChild.frames     = [firstFrameParent + firstFrameChild, firstFrameParent + f - 1];

					if (instance.blendModes) { collapsedChild.blendModes = instance.blendModes; }
					if (instance.filters)    { collapsedChild.filters = instance.filters; }

					collapsedChildren.push(collapsedChild);

					newTransforms = [];
					newColors     = [];
				}
				firstFrameChild = f + 1;
				continue;
			}

			newTransforms.push(transformMultiplication(transforms[f], childTransforms[childFrame]));
			newColors.push(colorMultiplication(colors[f], childColors[childFrame]));
		}

		// Replacing child transforms
		if (newTransforms.length > 0) {
			collapsedChild = JSON.parse(JSON.stringify(childInstance));
			collapsedChild.transforms = newTransforms;
			collapsedChild.colors     = newColors;
			collapsedChild.frames     = [firstFrameParent + firstFrameChild, firstFrameParent + f - 1];

			if (instance.blendModes) { collapsedChild.blendModes = instance.blendModes; }
			if (instance.filters)    { collapsedChild.filters = instance.filters; }

			collapsedChildren.push(collapsedChild);
		}
	}

	return collapsedChildren;
}