/*
	Simple PNG file format writer
	See http://www.libpng.org/pub/png/spec/1.2/PNG-Contents.html
	Wizcorp - olombart 2013/11/22
*/

'use strict';

var zlib = require('zlib');
var crc  = require('buffer-crc32');

function PngWriter(width, height, withAlpha, numPalColors, isGrayscale) {
	this.width  = width;
	this.height = height;

	this.withAlpha     = withAlpha;
	this.numColors     = numPalColors;
	this.isGrayscale   = isGrayscale;
	this.bytesPerPixel = (withAlpha ? 4 : 3);

	this.chunks = [];
	this.closed = false;
	this._addHeader();
}
module.exports = PngWriter;

// Returns the palette size in bytes
PngWriter.prototype.addPalette = function (data) {
	if (!this.numColors) throw new Error('Palette was not expected in PNG');
	var len = this.numColors * this.bytesPerPixel;
	//console.log('palette: ', len, data)
	this._addChunk('PLTE', data, len);
	return len;
};

PngWriter.prototype.addData = function (data, len, cb) {
	var t = this,
		bitmap = data.slice(0, len);
	//var p = new Gordon.Parser();
	//console.log('data before deflating: ',p.dumpVal(bitmap,650));
	zlib.deflate(bitmap, function (err, buf) {
		if (err) throw new Error('' + err);
		t._addChunk('IDAT', buf, buf.length);
		cb();
	});
};

PngWriter.prototype.getFinalContent = function () {
	if (!this.closed) {
		this.closed = true;
		this._addChunk('IEND', '', 0);
	}
	//compute total size
	var sig = [137, 80, 78, 71, 13, 10, 26, 10]; //PNG signature - 8 bytes
	var totalSize = 0;
	var numChunks = this.chunks.length;
	for (var n = 0; n < numChunks; n++) totalSize += this.chunks[n].length;
	var buf = new Buffer(totalSize + sig.length);
	//start with PNG file signature
	for (var i = 0; i < sig.length; i++) buf.writeUInt8(sig[i], i);
	var pos = i;
	//now add each chunk
	for (n = 0; n < numChunks; n++) {
		var chunk = this.chunks[n];
		chunk.copy(buf, pos);
		pos += chunk.length;
	}
	return buf;
};

//--- private 

PngWriter.prototype._addChunk = function (name, data, len) {
	var buf = new Buffer(len + 12, 'binary');
	buf.writeUInt32BE(len, 0);
	buf.write(name, 4, 4);
	if (typeof data !== 'string') data.copy(buf, 8, 0, len);
	else buf.write(data, 8, len, 'binary');
	//if(len<100)
	//console.log('buf:',buf.slice(4,8+len))
	var crc32 = crc.unsigned(buf.slice(4, 8 + len));
	//console.log('CRC32 for chunk '+name+'=',crc32)
	buf.writeUInt32BE(crc32, len + 8);
	this.chunks.push(buf);
};

PngWriter.prototype._addHeader = function () {
	var buf = new Buffer(13);
	var pos = 0;
	var colorType = (this.numColors ? 1 : 0) | (this.isGrayscale ? 0 : 2) | (this.withAlpha ? 4 : 0);

	buf.writeUInt32BE(this.width,  pos);
	pos += 4;

	buf.writeUInt32BE(this.height, pos);
	pos += 4;

	buf.writeUInt8(8,         pos++); //number of bits per sample (sample depth)
	buf.writeUInt8(colorType, pos++);
	buf.writeUInt8(0,         pos++); //compression method always 0 (deflate) for now
	buf.writeUInt8(0,         pos++); //filter method 0
	buf.writeUInt8(0,         pos++); //interlace not used
	this._addChunk('IHDR', buf, buf.length);
};
