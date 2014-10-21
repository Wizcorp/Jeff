'use strict';

var fs   = require('fs');
var walk = require('walk');

function getFileURIs(inputDir, srcPattern, cb) {

	var uris        = [];
	var regexp      = new RegExp(srcPattern);
	var rootNbChars = inputDir.length + 1;
	var walker      = walk.walk(inputDir, { followLinks: false });

	walker.on('file', function (root, stat, next) {
	    var filePath = root.substr(rootNbChars);
	    var fileName = stat.name;
		var pathFromInputDir = (filePath !== '') ? filePath + '/' + fileName : fileName;

		if (regexp.test(pathFromInputDir)) {
			uris.push(pathFromInputDir);
		}

	    next();
	});

	walker.on('end', function () {
		console.log('uris', uris);
		cb(uris);
	});
};
module.exports = getFileURIs;