
var zlib      = require('zlib');
var getCanvas = require('./GetCanvas');
var Image     = require('./Image');

function renderImageToCanvas(swfObject, whenDone) {
	if (swfObject.colorData) {
		renderPng(swfObject, whenDone);
	} else {
		renderJpg(swfObject, whenDone);
	}
}
module.exports = renderImageToCanvas;

function renderPng(swfObject, whenDone) {
	if (!swfObject.colorData) {
		// Should never happen unless caller is wrong
		throw new Error('Invalid data for PNG file');
	}

	inflate(swfObject.colorData, function (buffer) {
		swfObject.data = buffer;
		translatePng(swfObject, whenDone);
	});
}

function renderJpg(swfObject, whenDone) {
	var self = this;
	if (swfObject.alphaData) {
		inflate(swfObject.alphaData, function (buffer) {
			swfObject.inflatedAlphaData = buffer;
			translateJpg(swfObject, whenDone);
		});
	} else {
		translateJpg(swfObject, whenDone);
	}
}

function inflate(strdata, onData) {
	var data = new Buffer(strdata);
	zlib.inflate(data, function (error, buffer) {
		if (error) throw new Error('Invalid compressed data. ' + error);
		onData(buffer);
	});
}

function translateJpg(swfObject, whenDone) {
	// Image creation
	var uri = 'data:image/jpeg;base64,' + new Buffer(swfObject.data).toString('base64');
	var image = new Image();
	image.src = uri;

	// Writing image into canvas in order to manipulate its pixels
	var width   = image.width;
	var height  = image.height;
	var canvas  = getCanvas(width, height);
	var context = canvas.getContext('2d');
	context.drawImage(image, 0, 0);

	if (swfObject.alphaData) {
		var inflatedAlphaData = swfObject.inflatedAlphaData;
		var nPixels = width * height;

		// Fetching image pixels from canvas
		// & replacing alpha values with inflated alpha
		// & removing alpha premultiplication
		var imageData = context.getImageData(0, 0, width, height);
		var pxData  = imageData.data;
		for (var i = 0; i < nPixels; i++) {
			var px = 4 * i;
			var alpha = inflatedAlphaData[i];
			var premultiplierInv = 255 / alpha;
			pxData[px]     = pxData[px]     * premultiplierInv;
			pxData[px + 1] = pxData[px + 1] * premultiplierInv;
			pxData[px + 2] = pxData[px + 2] * premultiplierInv;
			pxData[px + 3] = alpha;
		}
		context.putImageData(imageData, 0, 0);
	}

	whenDone(swfObject, canvas);
}

function translatePng(swfObject, whenDone) {
	var width  = swfObject.width;
	var height = swfObject.height;
	var canvas = getCanvas(width, height);
	var context = canvas.getContext('2d');

	var colorTableSize = swfObject.colorTableSize || 0;
	var withAlpha      = swfObject.withAlpha || (colorTableSize === 0);
	var data           = swfObject.data;

	var pxIdx  = 0;
	var bpp    = (withAlpha ? 4 : 3); // used to be this, but doesn't seem to work
	var cmIdx  = colorTableSize * bpp;
	var pad    = colorTableSize ? ((width + 3) & ~3) - width : 0;
	var imageData = context.getImageData(0, 0, width, height);
	var pxData = imageData.data;

	var idx;
	var alpha = 255;
	var premultiplierInv = 1;
	for (var j = 0; j < height; j += 1) {
		for (var i = 0; i < width; i += 1) {
			if (colorTableSize) {
				idx = data[cmIdx] * bpp;
				// Warning: might not be working all the time
				// is using a color table the only reason for alpha being the last component of the pixel color?
				if (withAlpha) {
					alpha = data[idx + 3];
					premultiplierInv = 255 / alpha;
				}

				pxData[pxIdx]     = data[idx + 0] * premultiplierInv;
				pxData[pxIdx + 1] = data[idx + 1] * premultiplierInv;
				pxData[pxIdx + 2] = data[idx + 2] * premultiplierInv;
				pxData[pxIdx + 3] = alpha;
			} else {
				idx = cmIdx * bpp;
				if (withAlpha) {
					alpha = data[idx];
					premultiplierInv = 255 / alpha;
					idx += 1;
				}

				pxData[pxIdx]     = data[idx + 0] * premultiplierInv;
				pxData[pxIdx + 1] = data[idx + 1] * premultiplierInv;
				pxData[pxIdx + 2] = data[idx + 2] * premultiplierInv;
				pxData[pxIdx + 3] = alpha;
			}

			cmIdx += 1;
			pxIdx += 4;
		}
		cmIdx += pad;
	}

	context.putImageData(imageData, 0, 0);

	whenDone(swfObject, canvas);
}
