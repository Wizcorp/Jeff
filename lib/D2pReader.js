//See format in com.ankamagames.jerakine.resources.protocols.impl.PakProtocol2.as

'use strict';

var fs = require('fs');


function D2pReader() {
	this._init();
}
module.exports = D2pReader;

D2pReader.VERSION_MAX = 2;
D2pReader.VERSION_MIN = 1;

D2pReader.prototype._init = function () {
	var t = this;
	t.path = null;
	t.fsize = 0;
	t.toc = {};
	t.numFiles = 0;
	t.properties = {};
	t.smallBuf = t.smallBuf || new Buffer(1024); //smallBuf grows by itself if too small
};

//This method throws exceptions; catch them if you need to recover.
D2pReader.prototype.open = function (arcFilePath) {
	var t = this;
	t._init();
	t.path = arcFilePath;

	var fd = t.fd = fs.openSync(t.path, 'r');
	if (!fd) return t._fail('Failed to open file');
	var stats = fs.fstatSync(fd);
	t.fsize = stats.size;

	var buf = t._loadBuf(0, 4);
	if (buf[0] === D2pReader.VERSION_MAX && buf[1] === D2pReader.VERSION_MIN) {
		t._readToc();
		return;
	}
	//second chance for old d2p file (currently only 1 d2p file found in old format: monsterIcons.d2p)
	if (!t._readOldToc()) return t._fail('Wrong archive file');
};

D2pReader.prototype.close = function () {
	var t = this;
	t.smallBuf = null;
	t.toc = {};
	if (t.fd) {
		fs.closeSync(t.fd);
		t.fd = null;
	}
};

//Returns a buffer with the data from the file
D2pReader.prototype.getFileSync = function (fname) {
	var t = this;
	var desc = t.toc[fname];
	if (!desc) return t._fail('Missing file in archive', fname);
	var size = desc.len;
	var buf = new Buffer(size);
	var bytesRead = fs.readSync(t.fd, buf, 0, size, desc.pos);
	if (bytesRead !== size) return t._fail('(got ' + bytesRead + ' bytes, requested ' + size + ')', fname);
	return buf;
};

//Calls cb(err,buf) when done or error
D2pReader.prototype.getFile = function (fname, cb) {
	var t = this;
	var desc = t.toc[fname];
	if (!desc) return t._fail('Missing file in archive', fname, cb);
	var size = desc.len;
	var buf = new Buffer(size);
	fs.read(t.fd, buf, 0, size, desc.pos, function (err, bytesRead, buffer) {
		if (err) return t._fail('' + err, fname, cb);
		if (bytesRead !== size) return t._fail('(got ' + bytesRead + ' bytes, requested ' + size + ')', fname, cb);
		cb(null, buffer);
	});
};

//No async version; we will not use this in realtime anyway; maybe as a tool
D2pReader.prototype.extractAll = function (dstDir) {
	var t = this;
	if (dstDir[dstDir.length - 1] !== '/') dstDir += '/';
	t.dstDir = dstDir;
	var toc = t.toc;
	for (var i in toc) {
		var desc = toc[i];
		t._loadBuf(desc.pos, desc.len);
		var fpath = dstDir + desc.name.replace(/\//g, '-'); //we do not create subdirs for now
		//console.log('Writing file '+fpath)
		fs.writeFileSync(fpath, t.smallBuf.slice(0, desc.len));
	}
	t.close();
	console.log('Extracted', t.numFiles, 'files');
};

D2pReader.prototype._fail = function (msg, fname, cb) {
	var err;
	if (fname) {
		//if we were looking for a specific asset, we signal the error but keep the archive open
		err = 'Error while getting file from archive ' + this.path + ', ' + fname + ': ' + msg;
	} else {
		//if the error is at the archive level, close it, since all is over
		this.close();
		err = 'Fatal error in archive ' + this.path + ': ' + msg;
	}
	if (cb) return cb(err);
	throw new Error(err); //no cb means we are in sync mode => throw
};

D2pReader.prototype._readHeader = function () {
	var t = this;
	t._loadBuf(t.fsize - 24, 24); //sample: 0,0,0,2,0,5,88,3e,0,5,88,40,0,0,0,2d,0,5,8b,ec,0,0,0,0
	//console.log('file infos: ',su.dumpVal(t.smallBuf,24))
	t.fileOffset = t._readNumber(4); //offset so we skip our file header (2 bytes currently)
	t._readNumber(4); //data count (not used)
	t.tocPos = t._readNumber(4);
	t.numFiles = t._readNumber(4);
	var propertiesPos = t._readNumber(4);
	var numProperties = t._readNumber(4);
	if (numProperties !== 0) {
		t._loadBuf(propertiesPos, t.fsize - propertiesPos);
		//sample: 0,4,6c,69,6e,6b,0,c,62,6f,6e,65,73,30,5f,31,2e,64,32,70, | ..link..bones0_1.d2p
		for (var p = 0; p < numProperties; p++) {
			var name = t._readString();
			var value = t._readString();
			t.properties[name] = value;
		}
		//if (t.properties.link) console.warn('Links to',t.properties.link) //TODO: handle this
	}
};

D2pReader.prototype._readToc = function () {
	var t = this;
	t._readHeader();
	t._loadBuf(t.tocPos, t.fsize - t.tocPos);
	//console.log('table:',su.dumpVal(t.smallBuf,100))
	for (var n = t.numFiles; n > 0; n--) {
		//file entry sample: 0,a,31,32,2f,31,2f,39,2e,6a,70,67,0,5,6f,5,0,0,19,39
		var name = t._readString();
		var filePos = t._readNumber(4) + t.fileOffset;
		var fileLen = t._readNumber(4);
		t.toc[name] = {pos: filePos, len: fileLen};
	}
	//console.log('TOC:',t.numFiles,'files',t.toc)
};

D2pReader.prototype._readOldToc = function () {
	var t = this;
	var oldTocPos = t._readNumber(4);
	var oldTocSize = t.fsize - oldTocPos;
	if (oldTocPos < 0 || oldTocSize > t.fsize / 10) return false;
	t._loadBuf(oldTocPos, oldTocSize);
	while (t.offset < oldTocSize) {
		var name = t._readString();
		var filePos = t._readNumber(4);
		var fileLen = t._readNumber(4);
		t.toc[name] = {pos: filePos, len: fileLen};
		t.numFiles++;
	}
	return t.numFiles > 0;
};

D2pReader.prototype._readNumber = function (numBytes) {
	var buf = this.smallBuf, pos = this.offset;
	var val = buf[pos];
	for (var i = 1; i < numBytes; i++) val = (val << 8) | buf[pos + i];
	this.offset += numBytes;
	return val;
};

D2pReader.prototype._readString = function () {
	var t = this;
	var nameLen = t._readNumber(2);
	var name = t.smallBuf.slice(t.offset, t.offset + nameLen).toString();
	t.offset += nameLen;
	return name;
};

D2pReader.prototype._loadBuf = function (pos, size) {
	var t = this;
	var buf = t.smallBuf;
	if (size > buf.length) {
		//console.log('enlarging buffer to '+size+' bytes')
		delete t.smallBuf;
		t.smallBuf = buf = new Buffer(size);
	}
	var read = fs.readSync(t.fd, buf, 0, size, pos);
	if (read !== size) return t._fail('Error while reading (got ' + read + ' bytes, requested ' + size + ')');
	t.offset = 0;
	return buf;
};
