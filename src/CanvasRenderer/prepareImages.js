'use strict';
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
	var onWrittenCallBack = function (imageData, imageCanvas) {
		if (imageCanvas.width > 0 && imageCanvas.height > 0) {
			self._images[imageData.id] = imageCanvas;
		} else {
			console.warn('[CanvasRenderer.prepareImages] Image is empty', imageCanvas.width, imageCanvas.height, imageData.id);
		}

		nImagesReady += 1;
		if (nImagesReady === nImagesToPrepare) {
			self._renderImages();
		}
	};

	for (var i = 0; i < imagesToPrepare.length; i += 1) {
		this._renderImageToCanvas(imagesToPrepare[i], onWrittenCallBack);
	}
};