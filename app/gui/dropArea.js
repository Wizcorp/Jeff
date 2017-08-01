var fs           = require('fs');
var path         = require('path');
var electron     = require('electron');
var remote       = electron.remote;
var dialog       = remote.dialog;
var exportParams = require('./exportParams');
var domUtils     = require('./domUtils');
var createDom    = domUtils.createDom;
var createDiv    = domUtils.createDiv;
var clickable    = domUtils.clickable;


var container = createDiv('dropAreaContainer');
var dropArea  = createDiv('fileDropper', container);
dropArea.innerText = 'Drop .swf here';

createDiv('outputDirectoryCaption', container).innerText = 'Output directory';
var outputDirectory = createDiv('outputDirectory', container);

outputDirectory.innerText = 'Click to select a directory for output';

outputDirectory.addEventListener('click', function () {
	var options = {
		title: 'select location',
		defaultPath: './',
		buttonLabel: 'select',
		properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
	};

	dialog.showOpenDialog(options, function (fileNames) {
		if (!fileNames || !fileNames[0]) return;
		var fileName = fileNames[0];
		outputDirectory.innerText = fileName;
		exportParams.outBasePath  = fileName;
	});
});

var newDir = createDiv('newDirectoryOption', container);
var checkbox = createDom('input', 'checkbox', newDir);
createDom('span', 'newDirectoryOption-title', newDir).innerText = 'Create new directory for output';
checkbox.type = 'checkbox';
checkbox.checked = exportParams.createNewDir;
checkbox.addEventListener('change', function onChange() {
	exportParams.createNewDir = !!checkbox.checked;
});


exports.dropArea = dropArea;