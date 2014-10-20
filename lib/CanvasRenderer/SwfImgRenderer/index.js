'use strict';

var zlib = require('zlib');
var PngWriter = require('./PngWriter');
var Canvas = require('canvas');
var CImage = Canvas.Image;


function SwfImgRenderer() {
}
module.exports = SwfImgRenderer;

SwfImgRenderer.prototype.render = function (obj, whenDone) {
	if (obj.colorData) {
		this.renderPng(obj, whenDone);
	} else {
		this.renderJpg(obj, whenDone);
	}
};

SwfImgRenderer.prototype.renderPng = function (obj, whenDone) {
	var t = this;
	if (!obj.colorData) throw new Error('Invalid data for PNG file'); //should never happen unless caller is wrong
	this.inflate(obj.colorData, function (buffer) {
		obj.data = buffer;
		t.translatePng(obj, whenDone);
	});
};

SwfImgRenderer.prototype.renderJpg = function (obj, whenDone) {
	var t = this;
	if (obj.alphaData) {
		this.inflate(obj.alphaData, function (buffer) {
			obj.inflatedAlphaData = buffer;
			t.translateJpg(obj, whenDone);
		});
	} else {
		t.translateJpg(obj, whenDone);
	}
};

SwfImgRenderer.prototype.inflate = function (strdata, onData) {
	var data = new Buffer(strdata, 'binary');
	zlib.inflate(data, function (error, buffer) {
		if (error) throw new Error('Invalid compressed data. ' + error);
		onData(buffer);
	});
};

SwfImgRenderer.prototype.translateJpg = function (obj, whenDone) {
	// if no alpha data is added, the data follows already JPEG file format
	if (!obj.alphaData) {
		obj.jpgContent = new Buffer(obj.data, 'binary');
		whenDone(obj, obj.jpgContent);
		return;
	}
	//there is alpha data; since JPEG does not handle it we convert to PNG (TODO: review this)
	var inflatedAlphaData = obj.inflatedAlphaData,
		canvas, ctx, imgData, pxData, len, pxIdx, i, response, stream;
	var uri = 'data:image/jpeg;base64,' + new Buffer(obj.data, 'binary').toString('base64');
	var img = new CImage();
	img.src = uri;
	var width = img.width, height = img.height;
	canvas = new Canvas(width, height);
	ctx = canvas.getContext('2d');
	len = width * height;
	ctx.drawImage(img, 0, 0);
	imgData = ctx.getImageData(0, 0, width, height);
	pxData = imgData.data;
	pxIdx = 0;
	for (i = 0; i < len; i++) {
		pxData[pxIdx + 3] = inflatedAlphaData[i];
		pxIdx += 4;
	}
	ctx.putImageData(imgData, 0, 0);
	response = '';
	stream = canvas.createPNGStream();
	stream.on('data', function (chunk) {
		response += chunk.toString('binary');
	});
	stream.on('end', function () {
		obj.jpgContent = new Buffer(response, 'binary');
		whenDone(obj, obj.jpgContent);
	});
};

SwfImgRenderer.prototype.translatePng = function (obj, whenDone) {
	//console.log('translatePng; colorTableSize=',obj.colorTableSize);
	var imgData = this.translateSwfPngToPng(obj);
	var isGrayscale = false;
	var pw = new PngWriter(obj.width, obj.height, true, obj.colorTableSize, isGrayscale);
	if (obj.colorTableSize) pw.addPalette(obj.data);
	pw.addData(imgData, imgData.length, function () {
		obj.pngContent = pw.getFinalContent();
		whenDone(obj, obj.pngContent);
	});
};

SwfImgRenderer.prototype.translateSwfPngToPng = function (obj) {
	//console.log('data before un-swf-ing: ',p.dumpVal(obj.data,650));
	var width = obj.width;
	var height = obj.height;
	var colorTableSize = obj.colorTableSize || 0;
	var withAlpha = obj.withAlpha;
	// var bpp = (withAlpha ? 4 : 3);
	var bpp = 4;
	var cmIdx = colorTableSize * bpp;
	var pxIdx = 0;
	var data = obj.data;
	var pxData = new Buffer(width * height * bpp + height); //+height for filter byte (1 per line)
	var pad = colorTableSize ? ((width + 3) & ~3) - width : 0;

	//console.log('translateSwfPngToPng: ',data,width,height,colorTableSize, cmIdx, bpp, pxIdx, pad)
	for (var y = 0; y < height; y++) {
		pxData[pxIdx++] = 0; //PNG filter-type
		for (var x = 0; x < width; x++) {
			var idx = (colorTableSize ? data[cmIdx] : cmIdx) * bpp;
			var alpha = withAlpha ? data[idx] : 255;
			var premultiplier = 255 / alpha; 
			pxData[pxIdx]     = data[idx + 1] * premultiplier;
			pxData[pxIdx + 1] = data[idx + 2] * premultiplier;
			pxData[pxIdx + 2] = data[idx + 3] * premultiplier;
			pxData[pxIdx + 3] = alpha;
			// if(data[idx+1]>0) console.log('pixel:',idx,data[idx+1],data[idx+2],data[idx+3],alpha,'->',pxData[pxIdx],pxData[pxIdx+1],pxData[pxIdx+2],pxData[pxIdx+3])
			cmIdx++;
			pxIdx += 4;
		}
		cmIdx += pad;
	}
	return pxData;
};

