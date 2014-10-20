'use strict';

var fs = require('fs');
var async = require('async');
var walk = require('walk');
var zlib = require('zlib');
var path = require('path');
var D2pReader = require('./D2pReader');
var D2oReader = require('./D2oReader');


var defaultCacheDirs = [
	'./ankamaCache/',
	'/Applications/DofusBeta.app/Contents/Data/DofusBeta.app/Contents/Resources/'
];

//We cache the directories scanned by all asset loaders to avoid rescanning
//and especially reopening the same d2p files each time initialize method is called.
var directoryCache = {};


/** @class */
function AssetLoader() {
	this.files = null;
}
module.exports = AssetLoader;

AssetLoader.prototype.getCacheDir = function () {
	if (this.cacheDir) return this.cacheDir;
	for (var n = 0; n < defaultCacheDirs.length; n++) {
		var cacheDir = defaultCacheDirs[n];
		if (fs.existsSync(cacheDir + 'data/common/Spells.d2o')) {
			this.cacheDir = cacheDir;
			return cacheDir;
		}
	}
	console.warn('AssetLoader failed to find ankamaCache files in default locations');
	return null;
};

/** Initializes an asset loader. This method can be called again with a different cacheDir, HOWEVER,
 *  doing so will increase the number of open files (and you can reach the system's limit). To avoid
 *  this, you can call the close method before calling initialize again.
 *  @param {string} cacheDir - directory where all assets are. If null we will try default locations
 *  @param {callback} cb - called when the init is completed. */
AssetLoader.prototype.initialize = function (cacheDir, cb) {
	this.cacheDir = cacheDir || this.getCacheDir();
	if (!fs.existsSync(this.cacheDir)) return cb('Directory not found: ' + this.cacheDir);

	//first look if we already cached this directory
	var dir = directoryCache[this.cacheDir];
	if (dir) {
		dir.refcount++;
		this.files = dir.files;
		return cb();
	}
	//we will load and cache this new directory
	this.files = {};
	directoryCache[this.cacheDir] = { refcount: 1, files: this.files };
	this._loadDirectory(cb);
};

/** Closes an asset loader (releases files, etc.).
 *  NB: you don't have to call this method. See comments in initialize method */
AssetLoader.prototype.close = function () {
	//if applicable, remove the directory from cache
	var dir = directoryCache[this.cacheDir];
	if (dir) {
		dir.refcount--;
		if (dir.refcount !== 0) return; //another AssetLoader uses this directory
		delete directoryCache[this.cacheDir];
	}
	//close all the D2pReader
	for (var fname in this.files) {
		if (path.extname(fname) !== '.d2p') continue;
		var d2pReader = this.files[fname];
		d2pReader.close();
	}
	this.files = null;
};

/** Loads all the file names from asset loader directory.
 *  Note the archive files (d2p) are opened so this uses file handles */
AssetLoader.prototype._loadDirectory = function (cb) {
	var t = this;
	var files = t.files;
	var rootLen = t.cacheDir.length + 1;
	var walker = walk.walk(t.cacheDir, { followLinks: false });
	walker.on('file', function (root, stat, next) {
	    //add this file to the list of files
	    var fpath = root.substr(rootLen), fname = stat.name;
		var key = fpath !== '' ? fpath + '/' + fname : fname;
		var desc;
		var ext = path.extname(fname);
		if (ext !== '.d2p') {
		    desc = true; //root+'/'+stat.name;
		} else {
			var d2pReader = new D2pReader();
			d2pReader.open(t.cacheDir + '/' + key);
			desc = d2pReader;
		}
	    files[key] = desc;
	    next();
	});
	walker.on('end', function () {
		cb();
	});
};

//Returns an array of uri
AssetLoader.prototype.find = function (options) {
	var t = this;
	var uris = [];
	options = options || {};
	var extPattern = options.ext;
	var regexp = options.regexp;
	if (typeof options === 'string') regexp = new RegExp(options);

	function matches(assetName) {
		if (regexp && !regexp.test(assetName)) return false;
		if (extPattern) {
			var assetExt = path.extname(assetName);
			if (!extPattern.test(assetExt)) return false;
		}
		return true;
	}

	for (var f in t.files) {
		var ext = path.extname(f);
		switch (ext) {
		case '.d2p': //archive
			var d2pReader = t.files[f];
			for (var assetName in d2pReader.toc) {
				var uri = f + ':' + assetName;
				if (!matches(uri)) continue;
				uris.push(uri);
			}
			break;
		default:
			if (!matches(f)) continue;
			uris.push(f);
		}
	}
	return uris;
};

//Debug only
AssetLoader.prototype._reviewD2o = function (cb) {
	var t = this;
	var files = t.find({ ext: /\.d2o/	});
	var count = 0, errors = 0;
	var reader = new D2oReader();

	async.eachSeries(files, function (uri, callback) {
		if ((count % ~~(files.length / 100)) === 0) console.log(Math.round(count * 100 / files.length) + '% done...');
		reader.open(t.cacheDir + '/' + uri);
		try {
			reader.getObjects();
		} catch (err) {
			console.warn('Exception in ' + uri + ': ' + err);
			errors++;
		}
		count++;
		callback();
	}, function done(err) {
		if (err) return cb(err);
		console.log('Reviewed ' + count + ' d2o files out of ' + files.length + '. Failures: ' + errors);
		cb();
	});
};

//Tool only
AssetLoader.prototype.findInD2o = function (options, cb) {
	var regexp = options ? options.regexp : undefined;
	if (typeof options === 'string') regexp = new RegExp(options);
	var t = this;
	var files = t.find({ ext: /\.d2o/ });
	var reader = new D2oReader();
	console.log('Searching for', regexp, 'in all d2o files...');

	async.eachSeries(files, function (uri, callback) {
		reader.open(t.cacheDir + '/' + uri);
		try {
			var objects = reader.getObjects();
			var count = objects.length;
			for (var n = 0; n < count; n++) {
				var obj = objects[n];
				for (var m in obj) {
					if (regexp.test(m) || regexp.test(obj[m]))
						console.log(uri + ': id=' + obj.id + ' field=' + m + ' value=' + obj[m]);
				}
			}
		} catch (err) {
			console.warn('Exception in ' + uri + ': ' + err);
		}
		callback();
	}, function done(err) {
		cb(err);
	});
};

//Debug only
AssetLoader.prototype._reviewFiles = function () {
	/* jshint maxcomplexity: 32 */
	var t = this;
	var files = t.find();
	var numUnknown = 0, numFlash = 0;
	for (var i = files.length - 1; i >= 0; i--) {
		var f = files[i];
		var ext = path.extname(f).substr(1);
		switch (ext) {
		case 'swf': //flash
		case 'swl': //flash
			numFlash++;
			break;
		case 'd2p': //archive
		case 'png':
		case 'jpg':
		case 'flv': //flash movie
		case 'mp3':
		case 'css':
		case 'html':
		case 'ele': //zlib deflated
		case 'dlm': //zlib deflated (dlm are inside d2p)
		case 'd2o': //database file (see GameDataFileAccessor.as)
		case 'd2os': //signed d2o (only one: ActionDescriptions.d2os)
		case 'd2ui': //binary mix of xml and refs to assets/scripts used for UI
		case 'meta': //xml
		case 'metas'://signed xml
		case 'dt': //xml
		case 'dm': //xml
		case 'xml': //xml
		case 'd2i': //i18n_en.d2i = localized strings (I18nFileAccessor.as)
		case 'txt': //text only
		case 'ici': //install script
		case 'exe': //we can ignore
		case 'dx': //AS script file
			break;
		//various files we do not think we care about specially:
		case '':
		case 'md5':
		case 'plist':
		case 'icns':
		case 'directory':
		case 'desktop':
			break;
		default:
			numUnknown++;
			console.warn('Unknown extention: ' + f + '[' + ext + ']');
		}
	}
	console.log('Reviewed ' + files.length + ' of which ' + numUnknown + ' had an unknown extension and ' +
		numFlash + ' were swf/swl');
};

AssetLoader.prototype.extract = function (files, extractDir, cb) {
	if (!fs.existsSync(extractDir)) return cb('Directory not found: ' + extractDir);
	var t = this;
	async.eachSeries(files, function (f, callback) {
		//console.log('file:',f)
		t.getAsset(f, function (err, buf) {
			if (err) return cb(err);
			var fname = f.replace(/\//g, '-').replace(/:/g, '#');
			fname = extractDir + '/' + fname;
			console.log('Writing asset to file', fname);
			fs.writeFileSync(fname, buf);
			callback();
		});
	}, function done(err) {
		cb(err);
	});
};

//URI syntax:
//  ui/Ankama_Admin/Ankama_Admin.d2ui
//or for files in d2p archives:
//  content/maps/maps1.d2p:0/0.dlm
//cb(err,buf) will be called when data is ready.
//NB: compressed content is automatically decompressed.
AssetLoader.prototype.getAsset = function (uri, cb) {
	var t = this;
	var lastColon = uri.lastIndexOf(':');
	var assetName = lastColon > 0 ? uri.substr(lastColon + 1) : uri;
	var filePath = lastColon > 0 ? uri.substr(0, lastColon) : uri;
	var desc = t.files[filePath];
	if (!desc) return cb('Asset not found: ' + filePath);

	if (typeof desc === 'object') {
		var d2pReader = desc;
		d2pReader.getFile(assetName, function (err, buf) {
			if (err) return cb(err);
			if (t.isCompressedFile(assetName))
				t.inflate(assetName, buf, cb);
			else
				cb(null, buf);
		});
	} else {
		t._getLocalFile(assetName, cb);
	}
};

AssetLoader.prototype.isCompressedFile = function (fileName) {
	var ext = path.extname(fileName);
	if (ext === '.dlm' || ext === '.ele') return true;
	return false;
};

//NB: compressed content is automatically decompressed.
AssetLoader.prototype._getLocalFile = function (assetName, cb) {
	var t = this;
	var filePath = t.cacheDir + '/' + assetName;
	fs.readFile(filePath, function (err, buf) {
		if (err) return cb('Failed to read file ' + filePath + ': ' + err);
		if (t.isCompressedFile(assetName))
			t.inflate(assetName, buf, cb);
		else
			cb(null, buf);
	});
};

AssetLoader.prototype.inflate = function (assetName, buf, cb) {
	// console.log('Deflating asset ' + assetName + '...');
	zlib.inflate(buf, function (error, buffer) {
		if (error) return cb('Invalid compressed data in asset ' + assetName + ': ' + error);
		cb(null, buffer);
	});
};
