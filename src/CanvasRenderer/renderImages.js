var getCanvas      = require('./GetCanvas');
var CanvasRenderer = require('./main');
var elements       = require('../elements/');

var Sprite = elements.Sprite;

// margin between assets in atlasmaps
var MARGIN = 1;

CanvasRenderer.prototype._getMaxDimensions = function (sprites) {
	var spritesMaxDims = {};
	var classRatios     = this._options.classRatios || {};
	var hasFixedSize    = this._options.fixedSize !== undefined;

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
		var sprite   = sprites[id];
		var maxWidth  = 0;
		var maxHeight = 0;
		var maxDims   = sprite.maxDims;
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
			ratio:  spriteRatio,
			margin: MARGIN
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

function SymbolInstance(id, bounds) {
	this.id = id;
	this.bounds = bounds;
	this.transforms = [];
	this.colors     = [];
}

SymbolInstance.prototype.identityTransform = [1, 0, 0, 1, 0, 0];
SymbolInstance.prototype.identityColor     = [1, 1, 1, 1, 0, 0, 0, 0];

SymbolInstance.prototype.constructFrame = function (frame, ratio, fixedSize) {
	var frameBounds = this.bounds[frame];
	if (!frameBounds) {
		return null;
	}

	var x = frameBounds.left;
	var y = frameBounds.top;
	var w = frameBounds.right  - frameBounds.left;
	var h = frameBounds.bottom - frameBounds.top;

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

	this.transforms[frame] = [scaleX, 0, 0, scaleY, - scaleX * frameBounds.left, - scaleY * frameBounds.top];
	this.colors[frame]     = this.identityColor;

	return {
		x: x, y: y,
		w: w, h: h,
		canvas: canvas,
		context: canvas.getContext('2d')
	};
};

CanvasRenderer.prototype._getSymbolInstance = function (id, bounds) {
	return new SymbolInstance(id, bounds);
};

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
			this._renderSymbol(canvas, context, instance.identityTransform, instance.identityColor, instance, frame, false);

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
				margin: MARGIN,
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
	var ratio = this._extractor._fileGroupRatio;
	var prerenderBlendings = this._extractor._options.prerenderBlendings;
	var prerendered = false;

	var symbol, symbolId;
	var c, child, children, childId, childSprite;
	for (symbolId in symbols) {
		symbol = symbols[symbolId];

		var bounds = symbol.containerBounds || symbol.bounds;
		if (!bounds) {
			continue;
		}

		var frame = 0;
		var instance = this._getSymbolInstance(symbolId, bounds);
		var frameCanvas = instance.constructFrame(frame, ratio);
		if (!frameCanvas) {
			continue;
		}

		// prerendering only if all children are sprites with no class identification
		var frameCount = symbol.frameCount;
		var isUncompatible = false;
		children = symbol.children;
		for (c = 0; c < children.length; c += 1) {
			child = children[c];
			if (child.blendModes && !prerenderBlendings) {
				isUncompatible = true;
				break;
			}

			var frames = child.frames;
			if (frames[1] - frames[0] + 1 !== frameCount) {
				isUncompatible = true;
				break;
			}

			childId = child.id;
			childSprite = sprites[child.id];
			if (!childSprite) {
				isUncompatible = true;
				break;
			}

			if (childSprite.className) {
				isUncompatible = true;
				break;
			}

			var isChanged = false;
			var transforms = child.transforms;
			var modelTransform = transforms[0];
			for (var t = 1; t < transforms.length && !isChanged; t += 1) {
				var transform = transforms[t];
				if (
					transform[0] !== modelTransform[0] ||
					transform[1] !== modelTransform[1] ||
					transform[2] !== modelTransform[2] ||
					transform[3] !== modelTransform[3] ||
					transform[4] !== modelTransform[4] ||
					transform[5] !== modelTransform[5]
				) {
					isChanged = true;
				}
			}

			var colors = child.colors;
			var modelColor = colors[0];
			for (var co = 1; co < colors.length && !isChanged; co += 1) {
				var color = colors[co];
				if (
					color[0] !== modelColor[0] ||
					color[1] !== modelColor[1] ||
					color[2] !== modelColor[2] ||
					color[3] !== modelColor[3] ||
					color[4] !== modelColor[4] ||
					color[5] !== modelColor[5] ||
					color[6] !== modelColor[6] ||
					color[7] !== modelColor[7]
				) {
					isChanged = true;
				}
			}

			if (isChanged) {
				isUncompatible = true;
				break;
			}

		}

		if (isUncompatible) {
			continue;
		}

		var canvas = frameCanvas.canvas;
		var context = frameCanvas.context;
		this._renderSymbol(canvas, context, instance.identityTransform, instance.identityColor, instance, frame, false);

		imageMap[symbolId] = canvas;
		spriteProperties[symbolId] = {
			x: frameCanvas.x,
			y: frameCanvas.y,
			w: frameCanvas.w,
			h: frameCanvas.h,
			sx: 0, sy: 0,
			sw: canvas.width,
			sh: canvas.height,
			margin: MARGIN
		};

		// Creating sprite replacing symbol
		var sprite = new Sprite();
		sprite.id = symbolId;
		sprite.isImage = true;
		sprite.className = symbol.className;
		var right = frameCanvas.x + frameCanvas.w;
		var bottom = frameCanvas.y + frameCanvas.h;
		sprite.bounds = symbol.bounds;
		sprites[symbolId] = sprite;
		this._images[symbolId] = canvas;

		delete symbols[symbolId];

		prerendered = true;
	}

	// removing unused sprites
	var subsistingSprites = {};
	for (symbolId in symbols) {
		symbol = symbols[symbolId];
		children = symbol.children;
		for (c = 0; c < children.length; c += 1) {
			child = children[c];
			childId = child.id;
			childSprite = sprites[childId];
			if (childSprite) {
				subsistingSprites[childId] = true;
			}
		}
	}

	for (var spriteId in sprites) {
		sprite = sprites[spriteId];
		if (!sprite.className && !subsistingSprites[spriteId]) {
			delete sprites[spriteId];
			delete imageMap[spriteId];
			delete spriteProperties[spriteId];
		}
	}

	return prerendered;
};
