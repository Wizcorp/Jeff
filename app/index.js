var electron    = require('electron');
var main        = electron.remote.require('./main.js');
var ipcRenderer = electron.ipcRenderer;
var jeff        = require('../src/index.js');
var commander   = require('commander');


function executeJeff(argv, cb) {

	commander

	// Primary options
	.option('-s, --source <src file/glob expression>',      'Source of the file(s) to export. Can be defined as a regular expression', '*.swf')
	.option('-i, --inputDir <dir>',                         'Input directory, directory must exist', '.')
	.option('-o, --outDir <dir>',                           'Output directory', '.')

	// Secondary options
	.option('-S, --scope <scope>',                          'Scope of the animation to export, either \'classes\' or \'main\'', 'main')
	.option('-r, --ratio <ratio>',                          'Image scale', '1')
	.option('-f, --renderFrames <boolean/array of frames>', 'To extract specified frames of the animations as PNGs', 'false')

	// Optimisation options
	.option('-O, --imageOptim <boolean>',                   'To apply a lossless image compression', 'false')
	.option('-q, --imageQuality <quality>',                 'Image quality. From 0 to 100', '100')
	.option('-a, --createAtlas <boolean>',                  'To extract all the images of an animation into a single atlas', 'false')
	.option('-p, --powerOf2Images <boolean>',               'To set the dimensions of output images to powers of 2', 'false')
	.option('-M, --maxImageDim <number>',                   'Maximum image dimension', '2048')
	.option('-m, --simplify <boolean>',                     'To simplify animations (reduce number of symbols)', 'false')
	.option('-b, --beautify <boolean>',                     'To beautify JSON output', 'false')
	.option('-n, --flatten <boolean>',                      'To extract a flat animation structure rather than a hierarchical structure', 'false')
	.option('-c, --compressMatrices <boolean>',             'To extract animations with matrices under a compressed format', 'false')

	// Advanced options
	.option('-R, --exportAtRoot <boolean>',                 'To export everything at the root of the output directory', 'false')
	.option('-C, --splitClasses <boolean>',                 'To split the different classes of the animation into several outputs', 'false')
	.option('-d, --ignoreData <boolean>',                   'Not to export JSON meta-data', 'false')
	.option('-I, --ignoreImages <boolean>',                 'Not to export images', 'false')
	.option('-F, --filtering <filtering method>',           'Filtering that should be used when rendering the animation', 'linear')
	.option('-e, --outlineEmphasis <coefficient>',          'Emphasis of outlines when rendering Flash vectorial drawings', '1')

	.parse(argv);

	var exportParams = {
		// Primary options
		inputDir:           commander.inputDir,
		outDir:             commander.outDir || '.', // By default, always writing to disk when JEFF used in command line
		source:             commander.source,

		// Secondary options
		scope:              commander.scope,
		ratio:              JSON.parse(commander.ratio),
		renderFrames:       JSON.parse(commander.renderFrames),

		// Optimisation options
		imageOptim:         JSON.parse(commander.imageOptim),
		imageQuality:       JSON.parse(commander.imageQuality),
		createAtlas:        JSON.parse(commander.createAtlas),
		powerOf2Images:     JSON.parse(commander.powerOf2Images),
		maxImageDim:        JSON.parse(commander.maxImageDim),
		simplify:           JSON.parse(commander.simplify),
		beautify:           JSON.parse(commander.beautify),
		flatten:            JSON.parse(commander.flatten),
		compressMatrices:   JSON.parse(commander.compressMatrices),

		// Advanced options
		splitClasses:       JSON.parse(commander.splitClasses),
		exportAtRoot:       JSON.parse(commander.exportAtRoot),
		ignoreData:         JSON.parse(commander.ignoreData),
		ignoreImages:       JSON.parse(commander.ignoreImages),
		filtering:          commander.filtering,
		outlineEmphasis:    JSON.parse(commander.outlineEmphasis)
	};

	// Creating a new Jeff
	jeff(exportParams, cb);
}


ipcRenderer.on('argv', function (sender, argv) {
	argv = JSON.parse(argv);
	var haveArguments = argv.length > 2;

	if (haveArguments) {
		// execute jeff with provided arguments
		executeJeff(argv, function onComplete() {
			// close electron application
			main.quit();
		});
	} else {
		// TODO: no arguments -> start Jeff in GUI mode
	}
});