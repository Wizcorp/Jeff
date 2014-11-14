'use strict';

var zlib      = require('zlib');
var PngWriter = require('./PngWriter');
var Canvas    = require('canvas');
var CImage    = Canvas.Image;

function SwfImgRenderer() {}
module.exports = SwfImgRenderer;

SwfImgRenderer.prototype.render = function (swfObject, whenDone) {
	if (swfObject.colorData) {
		this._renderPng(swfObject, whenDone);
	} else {
		this._renderJpg(swfObject, whenDone);
	}
};

SwfImgRenderer.prototype._renderPng = function (swfObject, whenDone) {
	if (!swfObject.colorData) {
		// Should never happen unless caller is wrong
		throw new Error('Invalid data for PNG file');
	}
	
	var self = this;
	this._inflate(swfObject.colorData, function (buffer) {
		swfObject.data = buffer;
		self._translatePng(swfObject, whenDone);
	});
};

SwfImgRenderer.prototype._renderJpg = function (swfObject, whenDone) {
	var self = this;
	if (swfObject.alphaData) {
		this._inflate(swfObject.alphaData, function (buffer) {
			swfObject.inflatedAlphaData = buffer;
			self._translateJpg(swfObject, whenDone);
		});
	} else {
		self._translateJpg(swfObject, whenDone);
	}
};

SwfImgRenderer.prototype._inflate = function (strdata, onData) {
	var data = new Buffer(strdata, 'binary');
	zlib.inflate(data, function (error, buffer) {
		if (error) throw new Error('Invalid compressed data. ' + error);
		onData(buffer);
	});
};

SwfImgRenderer.prototype._translateJpg = function (swfObject, whenDone) {
	// if no alpha data is added, the data follows already JPEG file format
	if (!swfObject.alphaData) {
		swfObject.jpgContent = new Buffer(swfObject.data, 'binary');
		whenDone(swfObject, swfObject.jpgContent);
		return;
	}

	//there is alpha data; since JPEG does not handle it we convert to PNG (TODO: review this)
	var inflatedAlphaData = swfObject.inflatedAlphaData;

	// Image creation
	var uri = 'data:image/jpeg;base64,' + new Buffer(swfObject.data, 'binary').toString('base64');
	var img = new CImage();
	img.src = uri;

	// Writing image into canvas in order to manipulate its pixels
	var width   = img.width;
	var height  = img.height;
	var canvas  = new Canvas(width, height);
	var context = canvas.getContext('2d');
	var nPixels = width * height;
	context.drawImage(img, 0, 0);

	// Fetching image pixels from canvas
	// & replacing alpha values with inflated alpha
	// & removing alpha premultiplication
	var imgData = context.getImageData(0, 0, width, height);
	var pxData  = imgData.data;
	for (var i = 0; i < nPixels; i++) {
		var px = 4 * i;
		var alpha = inflatedAlphaData[i];
		var premultiplierInv = 255 / alpha;
		pxData[px]     = pxData[px]     * premultiplierInv;
		pxData[px + 1] = pxData[px + 1] * premultiplierInv;
		pxData[px + 2] = pxData[px + 2] * premultiplierInv;
		pxData[px + 3] = alpha;
	}
	context.putImageData(imgData, 0, 0);

	var response = [];
	var stream   = canvas.createPNGStream();
	stream.on('data', function (chunk) {
		response.push(chunk);
	});

	stream.on('end', function () {
		swfObject.jpgContent = Buffer.concat(response);
		whenDone(swfObject, swfObject.jpgContent);
	});
};

SwfImgRenderer.prototype._translatePng = function (swfObject, whenDone) {
	var imgData   = this._translateSwfPngToPng(swfObject);
	var pngWriter = new PngWriter(swfObject.width, swfObject.height, true, swfObject.colorTableSize, false);

	if (swfObject.colorTableSize) pngWriter.addPalette(swfObject.data);

	pngWriter.addData(imgData, imgData.length, function () {
		swfObject.pngContent = pngWriter.getFinalContent();
		whenDone(swfObject, swfObject.pngContent);
	});
};

SwfImgRenderer.prototype._translateSwfPngToPng = function (swfObject) {
	var width  = swfObject.width;
	var height = swfObject.height;

	var colorTableSize = swfObject.colorTableSize || 0;
	var withAlpha      = swfObject.withAlpha;
	var data           = swfObject.data;

	var pxIdx  = 0;
	var bpp    = 4;
	// var bpp = (withAlpha ? 4 : 3); <- used to be this, but doesn't seem to work
	var cmIdx  = colorTableSize * bpp;
	var pad    = colorTableSize ? ((width + 3) & ~3) - width : 0;
	var pxData = new Buffer(width * height * bpp + height); //+height for filter byte (1 per line)

	for (var j = 0; j < height; j += 1) {
		pxData[pxIdx++] = 0; // PNG filter-type
		for (var i = 0; i < width; i += 1) {
			var idx = (colorTableSize ? data[cmIdx] : cmIdx) * bpp;
			var alpha = withAlpha ? data[idx] : 255;
			var premultiplierInv = 255 / alpha;
			pxData[pxIdx]     = data[idx + 1] * premultiplierInv;
			pxData[pxIdx + 1] = data[idx + 2] * premultiplierInv;
			pxData[pxIdx + 2] = data[idx + 3] * premultiplierInv;
			pxData[pxIdx + 3] = alpha;
			
			cmIdx += 1;
			pxIdx += 4;
		}
		cmIdx += pad;
	}
	return pxData;
};
