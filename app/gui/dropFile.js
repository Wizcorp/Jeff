var path         = require('path');
var exportParams = require('./exportParams');
var dropArea     = require('./dropArea').dropArea;
var jeff         = require('../../src/index.js');

function openFiles(e) {
	var files = e.dataTransfer.files;
	var uri   = files[0].path; // TODO: all files

	if (path.extname(uri) !== '.swf') {
		// TODO log error ?
		return;
	}

	// set following attributes of exportParams:
	// - source
	// - inputDir
	// - outDir

	exportParams.source   = path.basename(uri);
	exportParams.inputDir = path.dirname(uri);

	var basePath = exportParams.outBasePath || path.dirname(uri);

	if (exportParams.createNewDir) {
		exportParams.outDir = path.join(basePath, path.basename(uri, '.swf'));
	} else {
		exportParams.outDir = basePath;
	}

	// executing Jeff with the parameters
	jeff(exportParams, function onFinish() {
		console.log('Exports done with following parameters', exportParams);
	});
}

function onDragOver(e) {
	e.stopPropagation();
	e.preventDefault();
	e.dataTransfer.dropEffect = 'copy';
}

function onDrop(e) {
	e.stopPropagation();
	e.preventDefault();
	dropArea.style.borderColor = '';
	openFiles(e);
}

document.body.addEventListener('dragover', onDragOver, false);
document.body.addEventListener('drop', onDrop, false);
document.addEventListener('dragover', onDragOver);
document.addEventListener('drop', onDrop);
dropArea.addEventListener('dragenter', function () {
	dropArea.style.borderColor = 'cyan';
});
dropArea.addEventListener('dragleave', function () {
	dropArea.style.borderColor = '';
});
