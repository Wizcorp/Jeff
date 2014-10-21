'use strict';
var Canvas         = require('canvas');
var CanvasRenderer = require('./main');

CanvasRenderer.prototype._prepareImages = function () {

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
			console.warn('[CanvasRenderer.prepareImages] Image is empty', imageData.id);
		}

		self._notifyImageAsReady();
	};

	// Creating the list of images
	var idString, imagesToPrepare = {};
	for (idString in this._symbolList) {
		var symbolId = this._symbolList[idString];
		var symbol   = this._symbols[symbolId];

		if (symbol.isImage) {
			imagesToPrepare[symbolId] = symbol.swfObject;
		}

		var images = symbol.images;
		if (images) {
			for (var i = 0; i < images.length; i += 1) {
				var imageData = images[i];
				imagesToPrepare[imageData.id] = imageData.image;
			}
		}
	}


	for (idString in imagesToPrepare) {
		this._nElemsToPrepare += 1;
		this._imgRenderer.render(imagesToPrepare[idString], onWrittenCallBack);
	}
};