'use strict';
var Canvas         = require('canvas');
var CanvasRenderer = require('./main');

CanvasRenderer.prototype._prepareImages = function () {

	// Creating the list of images
	var imagesToPrepare = [];
	var symbolList = this._extractor._symbolList;
	var symbols    = this._extractor._symbols;
	for (var s = 0; s < symbolList.length; s += 1) {
		var symbolId = symbolList[s];
		var symbol   = symbols[symbolId];

		if (symbol.isImage) {
			imagesToPrepare.push(symbol.swfObject);
		}

		var images = symbol.images;
		if (images) {
			for (var i = 0; i < images.length; i += 1) {
				var imageData = images[i];
				imagesToPrepare.push(imageData.image);
			}
		}
	}

	var nImagesToPrepare = imagesToPrepare.length;
	if (nImagesToPrepare === 0) {
		this._renderImages();
		return;
	}

	var nImagesReady = 0;
	var self = this;
	var onWrittenCallBack = function (imageData, imageBuffer) {
		var img = new Canvas.Image(); // Create a new Image
		img.src = imageBuffer;

		if (img.width > 0 && img.height > 0) {

			// Creating canvas for drawing the image
			var imageCanvas  = new Canvas();
			var imageContext = imageCanvas.getContext('2d');

			imageCanvas.width  = img.width;
			imageCanvas.height = img.height;

			self._images[imageData.id] = imageCanvas;

			imageContext.drawImage(img, 0, 0, img.width, img.height);
		} else {
			throw new Error('nooooo!')
			console.warn('[CanvasRenderer.prepareImages] Image is empty', img.width, img.height, imageData.id, JSON.stringify(imageBuffer));
		}

		nImagesReady += 1;
		if (nImagesReady === nImagesToPrepare) {
			self._renderImages();
		}
	};

	for (var i = 0; i < imagesToPrepare.length; i += 1) {
		this._imgRenderer.render(imagesToPrepare[i], onWrittenCallBack);
	}
};