'use strict';

var fs = require('fs');


function SyncFileStream() {
}
module.exports = SyncFileStream;


SyncFileStream.prototype.open = function (filePath, minReadSize) {
	var t = this;
	t.path = filePath;

	var fd = t.fd = fs.openSync(t.path, 'r');
	if (!fd) return t._fail('Failed to open file');
	var stats = fs.fstatSync(fd);
	t.fsize = stats.size;

	t.minReadSize = minReadSize || 1024;
	t.smallBuf = t.smallBuf || new Buffer(t.minReadSize); //smallBuf grows by itself if too small
	t.offset = t.maxOffset = t.originInFile = 0;
};

SyncFileStream.prototype.close = function () {
	var t = this;
	t.smallBuf = null;
	if (t.fd) {
		fs.closeSync(t.fd);
		t.fd = null;
	}
};

SyncFileStream.prototype.size = function () {
	return this.fsize;
};

SyncFileStream.prototype.position = function () {
	return this.originInFile + this.offset;
};

SyncFileStream.prototype.seek = function (pos, relative) {
	if (relative) pos = this.originInFile + this.offset + pos;
	this.offset = pos - this.originInFile;
	//if this would be outside the current buffer, simply reset the buffer
	if (this.offset < 0 || this.offset >= this.maxOffset) {
		this.originInFile = pos;
		this.offset = this.maxOffset = 0;
	}
	//console.log('seek to filepos',pos,'remaining:'+(this.maxOffset-this.offset))
	return this.originInFile + this.offset;
};

SyncFileStream.prototype.readUnsignedNumber = function (numBytes) {
	this._ensure(numBytes);
	var buf = this.smallBuf, pos = this.offset;
	var val = buf[pos];
	for (var i = 1; i < numBytes; i++) val = (val << 8) | buf[pos + i];
	this.offset += numBytes;

	//correct the negative sign for 32bit integers
	if (val < 0)
		val = 4294967296 - val;
	return val;
};

SyncFileStream.prototype.readNumber = function (numBytes) {
	this._ensure(numBytes);
	var buf = this.smallBuf, pos = this.offset;
	var val = buf[pos];
	for (var i = 1; i < numBytes; i++) val = (val << 8) | buf[pos + i];
	this.offset += numBytes;

	//handle negative numbers
	if (numBytes < 4) { //for 32bit integers this is automatic; for smaller ones we do it here
		var numBits = numBytes * 8;
		if (val & (1 << (numBits - 1))) val -= (1 << numBits);
	}
	return val;
};

SyncFileStream.prototype.readDouble = function () {
	var t = this;
	t._ensure(8);
	var val = t.smallBuf.readDoubleBE(t.offset);
	t.offset += 8;
	return val;
};

SyncFileStream.prototype.readString = function () {
	var t = this;
	var len = t.readUnsignedNumber(2);
	t._ensure(len);
	var name = t.smallBuf.slice(t.offset, t.offset + len).toString();
	t.offset += len;
	return name;
};

SyncFileStream.prototype.readBytes = function (numBytes) {
	var t = this;
	t._ensure(numBytes);
	var bytes = t.smallBuf.slice(t.offset, t.offset + numBytes).toString();
	t.offset += numBytes;
	return bytes;
};

//--- private methods

SyncFileStream.prototype._fail = function (msg) {
	this.close();
	var err = 'Fatal error in file ' + this.path + ': ' + msg;
	throw new Error(err); //no cb means we are in sync mode => throw
};

SyncFileStream.prototype._ensure = function (numBytes) {
	var remaining = this.maxOffset - this.offset;
	if (numBytes <= remaining) return;
	this._loadBuf(numBytes);
};

// reqsize: minimum number of bytes we need
SyncFileStream.prototype._loadBuf = function (reqsize) {
	var t = this;
	var remaining = t.maxOffset - t.offset;
	//no point in reading something smaller (overhead cost)
	var size2read = Math.max(reqsize, t.minReadSize) - remaining;
	//console.log('_loadBuf','reqsize='+reqsize,'remaining='+remaining,'size2read='+size2read)
	var buf = t.smallBuf;
	var minBufferSize = reqsize;
	if (minBufferSize > buf.length) {
		//console.log('enlarging buffer to '+minBufferSize+' bytes')
		var newBuf = new Buffer(minBufferSize);
		if (remaining) buf.copy(newBuf, 0, t.offset, t.offset + remaining);
		t.smallBuf = buf = newBuf;
	} else if (remaining) {
		buf.copy(buf, 0, t.offset, t.offset + remaining);
		//console.log('copy to 0, from', t.offset, 'to', t.offset + remaining)
	}
	var filepos = t.originInFile + t.maxOffset;
	t.originInFile += t.offset; //offset in file of the 1st byte in buffer
	var read = fs.readSync(t.fd, buf, remaining, size2read, filepos);
	t.maxOffset = remaining + read;
	t.offset = 0; //current reading pos in buffer
	//console.log('read',read,' bytes from filepos',filepos,' stored them at',remaining,'; new offset='+t.offset+', new maxOffset='+t.maxOffset)
	if (reqsize > t.maxOffset)
		return this._fail('Attempt to read beyond EOF. Missing: ' + (reqsize - t.maxOffset));
};
