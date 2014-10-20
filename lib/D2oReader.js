//See format in com.ankamagames.jerakine.data.GameDataFileAccessor.as

'use strict';

var SyncFileStream = require('./SyncFileStream');

//Ankama data types (NB: a type >0 is for objects)
//from com.ankamagames.jerakine.enum.GameDataTypeEnum
var ADT_INT = -1, //4 byte int
	ADT_BOOLEAN = -2, //1 byte int = 0 or 1
	ADT_STRING = -3, //UTF string
	ADT_NUMBER = -4, //double
	ADT_I18N = -5, //4 byte ID = undiacritical text ID
	ADT_UINT = -6, //4 byte unsigned int
	ADT_VECTOR = -99;

var NULL_IDENTIFIER = -1431655766;


/** @class
* @param {D2iReader} i18n - if undefined, text IDs will not be replaced by i18n texts.
*		Note that method setI18n can be called instead of passing it to constructor. */
function D2oReader(i18n) {
	if (i18n) this.i18n = i18n;
}
module.exports = D2oReader;

/** Sets the current language for text IDs replacements inside objects.
* @param {D2iReader} i18n */
D2oReader.prototype.setI18n = function (i18n) {
	this.i18n = i18n;
};

/** Opens a D2O file. Throws exceptions; catch them if you need to recover. 
* @param {string} arcFilePath - full path to .d2o file */
D2oReader.prototype.open = function (arcFilePath) {
	var t = this;
	t.path = arcFilePath;
	t.index = [];
	if (arcFilePath) {
		t.moduleName = arcFilePath.substring(arcFilePath.lastIndexOf('/') + 1, arcFilePath.lastIndexOf('.d2o'));
	}

	var s = t.stream = new SyncFileStream();
	s.open(t.path);

	var header = s.readBytes(3);
	if (header !== 'D2O') {
		s.seek(-3, /*relative=*/ true);
		header = s.readString();
		if (header !== 'AKSF')
			return t._fail('Invalid D2O/D2OS file. Header: ' + header);
		var formatVersion = s.readNumber(2);
		if (formatVersion !== 1) return t._fail('Unknown version for D2OS file: ' + formatVersion);
		var skipUntilD2o = s.readNumber(4);
		s.seek(skipUntilD2o, /*relative=*/ true);
		//...and now we should find here the regular header D2O
		header = s.readBytes(3);
		if (header !== 'D2O') return t._fail('Invalid D2OS file. Header: ' + header);
	}
	t._readIndexes();
};

/** Closes a D2O; you can reopen or open another one */
D2oReader.prototype.close = function () {
	this.stream.close();
};

/** @return {string} class of the objects in D2O */
D2oReader.prototype.getClassName = function () {
	return this.moduleName;
};

/** @return {number} number of objects in D2O */
D2oReader.prototype.getCount = function () {
	return this.count;
};

/** @return {object} a single object */
D2oReader.prototype.getObject = function (id) {
	var s = this.stream;
	var pos = this.index[id];
	if (!pos) return null;
	s.seek(pos);
	return this._readObject();
};

/** Retrieves all objects from a D2O
* @return {array} the objects */
D2oReader.prototype.getObjects = function () {
	var count = this.count;
	var s = this.stream;
	s.seek(this.streamStartPos);
	var objs = [];
	for (var i = 0; i < count; i++) {
		objs.push(this._readObject());
	}
	return objs;
};

D2oReader.prototype._readObject = function () {
	var classId = this.stream.readNumber(4);
	if (classId === NULL_IDENTIFIER) return null; //per Ankama's code
	var klass = this.classes[classId];
	if (!klass)
		throw new Error('Invalid class in file: ' + classId);
	var obj = {};
	if (this.numClasses > 1) obj._type = klass.name;
	var numFields = klass.fields.length;
	//console.log('class of object is '+klass.name+ ', '+numFields+' fields')
	for (var f = 0; f < numFields; f++) {
		var field = klass.fields[f];
		//console.log('field #'+f+':',field)
		var val = this._readValue(field.type, field.elementTypes, 0);
		obj[field.name] = val;
	}
	//console.log('read object:',obj)
	return obj;
};

D2oReader.prototype._readValue = function (type, innerTypes, innerNdx) {
	var s = this.stream;
	switch (type) {
	case ADT_INT:
		return s.readNumber(4);
	case ADT_BOOLEAN:
		return !!s.readNumber(1);
	case ADT_STRING:
		return s.readString();
	case ADT_NUMBER:
		return s.readDouble();
	case ADT_I18N:
		var txtId = s.readNumber(4);
		if (!this.i18n) return txtId;
		return this.i18n.getText(txtId);
	case ADT_UINT:
		return s.readUnsignedNumber(4);
	case ADT_VECTOR:
		var vector = [];
		var len = s.readNumber(4);
		for (var i = 0; i < len; i++) {
			vector[i] = this._readValue(innerTypes[innerNdx], innerTypes, innerNdx + 1);
		}
		return vector;
	default:
		if (type < 0) throw new Error('Invalid type id: ' + type);
		//OBJECT
		return this._readObject();
	}
};

D2oReader.prototype._readIndexes = function () {
	var t = this, s = t.stream;

	var contentOffset = s.position() - 3;
	t.streamStartPos = contentOffset + 7;

	//read index on "id"
	var indexPos = s.readNumber(4);
	s.seek(contentOffset + indexPos);
	var indexLen = s.readNumber(4);
	var i, numIndex = indexLen / 8;
	for (i = 0; i < numIndex; i++) {
		var key = s.readNumber(4);
		var pos = s.readNumber(4);
		t.index[key] = contentOffset + pos;
	}
	t.count = numIndex;

	//read classes
	var numClasses = t.numClasses = s.readNumber(4);
	t.classes = {};
	for (i = 0; i < numClasses; i++) {
		var fields = [];
		var classDef = {
			id: s.readNumber(4),
			name: s.readString(),
			package: s.readString(),
			fields: fields,
		};
		t.classes[classDef.id] = classDef;
		var fieldCount = s.readNumber(4);
		for (var f = 0; f < fieldCount; f++) {
			fields.push(t._readFieldDef());
		}
		//console.log('Class:', classDef)
	}

	//if we still have data... TODO
	//console.log('remaining in file:', s.size() - s.position())
};

D2oReader.prototype._readFieldDef = function () {
	var s = this.stream;
	var field = {
		name: s.readString(),
	};
	var type = field.type = s.readNumber(4);
	while (type === ADT_VECTOR) {
		if (!field.elementTypeNames) { field.elementTypeNames = []; field.elementTypes = []; }
		field.elementTypeNames.push(s.readString());
		type = s.readNumber(4);
		field.elementTypes.push(type);
	}
	//console.log('new field:',field)
	return field;
};

D2oReader.prototype._fail = function (msg) {
	this.stream.close();
	var err = 'Fatal error in file ' + this.path + ': ' + msg;
	throw new Error(err); //no cb means we are in sync mode => throw
};
