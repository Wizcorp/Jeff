var getCanvas      = require('./GetCanvas');
var CanvasRenderer = require('./main');

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
	var spriteList = this._extractor._spriteList;
	var images = this._images;
	var spritesToRender = {};
	for (var s = 0; s < spriteList.length; s += 1) {
		var spriteId = spriteList[s];
		var sprite   = sprites[spriteId];
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

CanvasRenderer.prototype._renderSprites = function (sprites, spriteDims, canvasses) {
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

		canvasses[id] = canvas;
	}
};

CanvasRenderer.prototype._renderFrames = function (canvasses, spriteProperties) {
	var identityMatrix = [1, 0, 0, 1, 0, 0];
	var identityColor  = [1, 1, 1, 1, 0, 0, 0, 0];

	for (var className in this._extractor._classGroupList) {

		var classId   = this._extractor._classGroupList[className];
		var symbol    = this._extractor._symbols[classId];
		var ratio     = this._extractor._fileGroupRatio;
		var fixedSize = this._options.fixedSize;

		var frameCount     = symbol.frameCount;
		var animColors     = [];
		var animTransforms = [];
		var animInstance   = { id: classId, colors: animColors, transforms: animTransforms };

		var bounds = symbol.containerBounds || symbol.bounds;
		if (!bounds) {
			continue;
		}

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
			var frame   = frames[f];
			var canvas  = getCanvas();
			var context = canvas.getContext('2d');

			var frameBounds = bounds[frame];
			if (!frameBounds) {
				continue;
			}

			var x = frameBounds.left;
			var y = frameBounds.top;
			var w = frameBounds.right  - frameBounds.left;
			var h = frameBounds.bottom - frameBounds.top;

			var ratioW = ratio;
			var ratioH = ratio;
			if (fixedSize) {
				ratioW *= fixedSize.width  / w;
				ratioH *= fixedSize.height / h;
			}

			canvas.width  = Math.ceil(ratioW * w);
			canvas.height = Math.ceil(ratioH * h);

			if (canvas.width === 0 || canvas.height === 0) {
				continue;
			}

			animColors[frame]     = identityColor;
			animTransforms[frame] = [ratioW, 0, 0, ratioH, - ratioW * frameBounds.left, - ratioH * frameBounds.top, 1];
			this._renderSymbol(canvas, context, identityMatrix, identityColor, animInstance, frame, false);

			// TODO: find a more elegant way to deal with the 'only one frame' case: may be add an option to remove any suffix?
			// Issue: we have image name resolution in 2 places (see Jeff._generateImageName in jeff/index.js file)
			var canvasName = this._options.onlyOneFrame ? symbol.className : symbol.frameNames[frame];
			canvasses[canvasName] = canvas;
			spriteProperties[canvasName] = {
				x: x, y: y,
				w: w, h: h,
				sx: 0, sy: 0,
				sw: canvas.width,
				sh: canvas.height,
				margin: MARGIN
			};
		}
	}
};

function nextHighestPowerOfTwo(x) {
	x -= 1;
	for (var i = 1; i < 32; i <<= 1) {
		x = x | x >> i;
	}
	return x + 1;
}

function augmentToNextPowerOf2(canvasses) {
	for (var imageName in canvasses) {
		var canvas = canvasses[imageName];
		var width  = nextHighestPowerOfTwo(canvas.width);
		var height = nextHighestPowerOfTwo(canvas.height);

		// Creating a canvas with power of 2 dimensions
		var po2Canvas  = getCanvas();
		var po2Context = po2Canvas.getContext('2d');
		po2Canvas.width  = width;
		po2Canvas.height = height;
		po2Context.drawImage(canvas, 0, 0);

		// Replacing non-power of 2 canvas by power of 2 canvas
		canvasses[imageName] = po2Canvas;
	}
}

CanvasRenderer.prototype._renderImages = function (retry) {
	var imageMap  = [];
	var canvasses = {};
	var spriteProperties = {};
	if (this._options.renderFrames) {
		this._renderFrames(canvasses, spriteProperties);
	} else {
		// 1 - Generating list of sprites to render
		var sprites = this._getSpritesToRender();

		// 2 - Computing minimum rendering size that will guarantee lossless quality for each sprite
		var spriteMaxDims = this._getMaxDimensions(sprites);

		// 3 - Computing sprite dimensions with respect to their maximum dimensions and required ratios
		spriteProperties = this._setSpriteDimensions(sprites, spriteMaxDims);

		// 4 - Rendering sprites in canvasses
		this._renderSprites(sprites, spriteProperties, canvasses);
	}

	if (this._options.createAtlas) {
		var atlas = this._renderAtlas(canvasses, spriteProperties);
		if (atlas) {
			// imageList = [{ img: atlas, name: 'atlas' }];
			var spriteList = this._extractor._spriteList;
			for (var s = 0; s < spriteList.length; s += 1) {
				imageMap[spriteList[s]] = atlas;
			}
		} else {
			// TODO: add an option to let the user choose whether he wants to create
			// several atlases or reduce the asset sizes when this situation happens

			// Atlas could not be extracted at current ratio
			// Reducing extraction ratio and attempting rendering once more
			this._extractor._fileGroupRatio *= 0.9;
			var nbRetries = retry || 0;
			return this._renderImages(nbRetries + 1);
		}

		if (retry) {
			console.warn(
				'[CanvasRenderer.renderImages] Atlas created with ratio ' + this._extractor._fileGroupRatio +
				' because it did not fit into the required dimensions.' +
				'(File Group ' + this._extractor._fileGroupName + ', Class ' + this._extractor._classGroupName + ')'
			);
		}

	} else {
		if (this._options.powerOf2Images) {
			augmentToNextPowerOf2(canvasses);
		}

		imageMap = canvasses;
		// for (var imageName in canvasses) {
		// 	imageList.push({ name: imageName, img: canvasses[imageName] });
		// }
	}

	// End of the rendering
	// All swf objects should have been correctly rendered at this point
	this._rendering = false;
	if (this._callback) {
		this._callback(imageMap, spriteProperties);
	}
};
