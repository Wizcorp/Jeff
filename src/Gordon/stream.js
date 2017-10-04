/* jshint white: false, curly: false */

var zlib = require('zlib');

function Stream(data){
	this._buffer = new Buffer(data);
	this._nBytes = data.length;
	this.offset  = 0;

	this._bitBuffer  = null;
	this._bitOffset  = 8;
	this._lastOffset = 0;
}
module.exports = Stream;

(function(){

	Stream.prototype = {
		readSI8: function(){
			var val = this._buffer.readInt8(this.offset);
			this.offset += 1;
			return val;
		},

		readSI16: function(){
			var val = this._buffer.readInt16LE(this.offset);
			this.offset += 2;
			return val;
		},

		readSI32: function(){
			var val = this._buffer.readInt32LE(this.offset);
			this.offset += 4;
			return val;
		},

		readUI8: function(){
			var val = this._buffer.readUInt8(this.offset);
			this.offset += 1;
			return val;
		},

		readUI16: function(){
			var val = this._buffer.readUInt16LE(this.offset);
			this.offset += 2;
			return val;
		},

		readUI32: function(){
			var val = this._buffer.readUInt32LE(this.offset);
			this.offset += 4;
			return val;
		},

		readFixed: function(){
			var val = this._buffer.readInt32LE(this.offset) / 65536;
			this.offset += 4;
			return val;
		},

		readFixed8: function(){
			var val = this._buffer.readInt16LE(this.offset) / 256;
			this.offset += 2;
			return val;
		},

		readFloat: function(){
			var val = this._buffer.readFloatLE(this.offset);
			this.offset += 4;
			return val;
		},

		readDouble: function(){
			var val = this._buffer.readDoubleLE(this.offset);
			this.offset += 8;
			return val;
		},

		readEncodedU32: function(){
			var val = this._buffer[this.offset++];
			if (!(val & 0x00000080)) {
				return val;
			}

			val = (val & 0x0000007f) | this._buffer[this.offset++] << 7;
			if (!(val & 0x00004000)) {
				return val;
			}

			val = (val & 0x00003fff) | this._buffer[this.offset++] << 14;
			if (!(val & 0x00200000)) {
				return val;
			}

			val = (val & 0x001fffff) | this._buffer[this.offset++] << 21;
			if (!(val & 0x10000000)) {
				return val;
			}

			val = (val & 0x0fffffff) | this._buffer[this.offset++] << 28;
			return val;
		},

		readUB: function(numBits){
			var val = 0;
			for(var i = 0; i < numBits; i++){
				if(this._lastOffset !== this.offset || this._bitOffset === 8){
					this._bitBuffer = this._buffer[this.offset++];
					this._lastOffset = this.offset;
					this._bitOffset = 0;
				}
				val = (val << 1) | (this._bitBuffer & (0x80 >> this._bitOffset++) ? 1 : 0);
			}
			return val;
		},

		readSB: function(numBits){
			var val = this.readUB(numBits);
			if(val >> (numBits - 1)){ val -= Math.pow(2, numBits); }
			return val;
		},

		readFB: function(numBits){
			return this.readSB(numBits) * Math.pow(2, -16);
		},

		readString: function(numBytes){
			var start = this.offset;
			if (numBytes) {
				this.offset += numBytes;
			} else {
				numBytes = 0;
				while (this._buffer[this.offset++] !== 0) {
					numBytes += 1;
				}
			}
			return this._buffer.slice(start, start + numBytes).toString();
		},

		readBytes: function(numBytes){
			var bytes = this._buffer.slice(this.offset, this.offset + numBytes);
			this.offset += numBytes;
			return bytes;
		},

		readBool: function(numBits){
			return !!this.readUB(numBits || 1);
		},

		pos: function(){
			return this.offset;
		},

		seek: function(offset, absolute){
			this.offset = (absolute ? 0 : this.offset) + offset;
			// this.align();
			return this;
		},

		align: function(){
			this._lastOffset = 0;
			return this;
		},

		readLanguageCode: function(){
			return this.readUI8();
		},

		readRGB: function(){
			return {
				red:   this.readUI8(),
				green: this.readUI8(),
				blue:  this.readUI8()
			};
		},

		readRGBA: function(){
			var rgba = this.readRGB();
			rgba.alpha = this.readUI8() / 255;
			return rgba;
		},

		readARGB: function(){
			var alpha = this.readUI8() / 255;
			var rgba = this.readRGB();
			rgba.alpha = alpha;
			return rgba;
		},

		readRect: function(){
			var numBits = this.readUB(5);
			var rect = {
				left:   this.readSB(numBits),
				right:  this.readSB(numBits),
				top:    this.readSB(numBits),
				bottom: this.readSB(numBits)
			};

			this.align();

			if (numBits === 1) {
				// Hack of the week (the year?)
				// Seems that Flash fails to encode an empty rectangle (all zero);
				// Instead of 2 bytes 08 00 (len=1 on 5 bits, then 4 times "0" bit, so 9 bits + 7 of padding)
				// Flash serializes 08 00 followed by 4 UI32 of value 0 (so 18 bytes in total)
				// We simply skip this useless zeros here, but verify it was actually zeros we skipped.
				// If one day we find something else than an all zero rect (e.g. a 0,0,1,1) we will
				// have to adapt some more here...

				// Edit: it looks like this hack is making the export fail on some swf
				// (may be those from the latest flash versions?)
				// So the bytes need to be tested in order to know whether the hack is necessary
				if (this._buffer.readUInt16LE(this.offset) === 0) {
					var empty = this.readBytes(16); //console.warn('numBits=1, rect:',rect)
					for(var i = 0; i < 16; i++) {
						if(empty[i] !== 0) { throw new Error('Unexpected rectangle data'); }
					}
				}
			}
			return rect;
		},

		readMatrix: function(){
			var numBits, scaleX, scaleY, skewX, skewY;

			if (this.readBool() /* has scale */){
				numBits = this.readUB(5);
				scaleX = this.readFB(numBits);
				scaleY = this.readFB(numBits);
			} else {
				scaleX = scaleY = 1.0;
			}

			if (this.readBool() /* has rotation */){
				numBits = this.readUB(5);
				skewX = this.readFB(numBits);
				skewY = this.readFB(numBits);
			} else {
				skewX =  skewY = 0.0;
			}

			numBits = this.readUB(5);
			var matrix = {
				scaleX: scaleX, scaleY: scaleY,
				skewX: skewX, skewY: skewY,
				moveX: this.readSB(numBits), moveY: this.readSB(numBits)
			};

			this.align();
			return matrix;
		},

		readCxform: function(){
			return this._readCxf();
		},

		readCxformA: function(){
			return this._readCxf(true);
		},

		_readCxf: function(withAlpha){
			var hasAddTerms  = this.readBool();
			var hasMultTerms = this.readBool();
			var numBits      = this.readUB(4);

			var multR, multG, multB, multA;
			var addR, addG, addB, addA;
			if (hasMultTerms){
				multR = this.readSB(numBits) / 256;
				multG = this.readSB(numBits) / 256;
				multB = this.readSB(numBits) / 256;
				multA = withAlpha ? this.readSB(numBits) / 256 : 1;
			} else {
				multR = multG = multB = multA = 1;
			}

			if (hasAddTerms){
				addR = this.readSB(numBits) / 256;
				addG = this.readSB(numBits) / 256;
				addB = this.readSB(numBits) / 256;
				addA = withAlpha ? this.readSB(numBits) / 256 : 0;
			} else {
				addR = addG = addB = addA = 0;
			}

			var cxform = {
				multR: multR, multG: multG, multB: multB, multA: multA,
				addR: addR, addG: addG, addB: addB, addA: addA
			};

			this.align();
			return cxform;
		},

		// Decompresses the remaining of the stream and get ready to read from here
		decompressAsync: function(whenDone) {
			var offset = this.offset;
			var data = this._buffer.slice(offset);

			var self = this;
			zlib.inflate(data, function (err, buffer) {
				if(err) { throw new Error('Invalid compressed data. ' + err); }
				self._buffer = Buffer.concat([self._buffer.slice(0, offset), buffer]);
				self._nBytes  = self._buffer.length;
				whenDone();
			});
		}
	};
})();
