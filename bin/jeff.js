#!/usr/bin/env node

var Jeff    = require('../lib/index.js');
var program = require('commander');

// So many options!
// But don't worry, Jeff can handle them all

program

// Primary options
.option('-src, --srcPattern <src file/regex>',                      'Source of the file(s) to export. Can be defined as a regular expression', '*.swf')
.option('-in,  --inputDir <dir>',                                   'Input directory (default is ./); directory must exist', './')
.option('-out, --outDir <dir>',                                     'Output directory (default is ./);', './')

// Secondary options
.option('-s,   --scope <scope>',                                    'Scope of the animation to export, either \'classes\' or \'main\'', 'main')
.option('-r,   --ratio <ratio>',                                    'Image scale', '1')
.option('-rf,  --renderFrames <boolean>',                           'To extract each frame of the animations as PNGs', 'false')

// Optimisation options
.option('-ca,  --createAtlas <boolean>',                            'To extract all the images of an animation into a single atlas', 'false')
.option('-po2, --powerOf2Images <boolean>',                         'To set the dimensions of output images to powers of 2', 'false')
.option('-sfy, --simplify <boolean>',                               'To simplify animations (reduce number of symbols)', 'false')
.option('-iq,  --imageQuality <quality>',                           'Image quality. From 0 to 100', '100')
.option('-mid, --maxImageDim <dimension>',                          'Maximum image dimension', '2048')

// Advanced options (aka Legacy options)
.option('-ffo, --firstFrameOnly <boolean>',                         'To extract the first frame only, as a PNG', 'false')
.option('-sc,  --splitClasses <boolean>',                           'To split the different classes of the animation into several outputs', 'false')
.option('-b,   --beautify <boolean>',                               'To beautify JSON output', 'false')
.option('-ear, --exportAtRoot <boolean>',                           'To export everything at the root of output directory', 'false')
.option('-id,  --ignoreData <boolean>',                             'Not to export JSON meta-data', 'false')
.option('-ii,  --ignoreImages <boolean>',                           'Not to export images', 'false')
.option('-dgr, --defaultGroupRatio <ratio>',                        'Default scale for groups', '1')
.option('-oe,  --outlineEmphasis <coefficient>',                    'Emphasis of outlines when rendering Flash vectorial drawings', '1')
.option('-cg,  --classGroups <map group-name class-name(regex)>',   'Groupings of classes corresponding to regular-expressions', '{}')
.option('-fg,  --fileGroups <map group-name array-of-files>',       'Groupings of files', '{}')
.option('-gr,  --fileGroupRatios <map group-name ratio>',           'Scales per file group', '{}')
.option('-cr,  --classRatios <map class-name ratio>',               'Scales per class', '')
.option('-c,   --container <class-name>',                           'Name of class to use as container', '')
.option('-ie,  --ignoreExpression <class-name(regex)>',             'Regular expression corresponding to classes to ignore for the export', '')
.option('-il,  --ignoreList <array of class-names>',                'List of classes to ignore for the export', '')
.option('-rl,  --removeList <array of class-names>',                'List of classes to remove within the animations', '')
.option('-el,  --exclusiveList <array of class-names>',             'Exclusive list of classes to export', '')
.option('-pp,  --postProcess <function>',                           'Post-process function that will be executed before generating the output files', '')
.option('-cwf, --customWriteFile <function>',                       'Custom write function for output files (JSONs and PNGs)', '')
.option('-fs,  --fixedSize <dimensions>',                           'To force dimensions of extracted animation', '')

.parse(process.argv);

var exportParams = {

	// Primary options
	inputDir:           program.inputDir,
	outDir:             program.outDir,
	srcPattern:         program.srcPattern,

	// Secondary options
	scope:              program.scope,
	ratio:              program.ratio,
	renderFrames:       program.renderFrames,

	// Optimisation options
	createAtlas:        program.createAtlas,
	powerOf2Images:     program.powerOf2Images,
	simplify:           program.simplify,
	imageQuality:       program.imageQuality,
	maxImageDim:        program.maxImageDim,

	// Advanced options
	firstFrameOnly:     program.firstFrameOnly,
	splitClasses:       program.splitClasses,
	beautify:           program.beautify,
	exportAtRoot:       program.exportAtRoot,
	ignoreData:         program.ignoreData,
	ignoreImages:       program.ignoreImages,
	defaultGroupRatio:  program.defaultGroupRatio,
	outlineEmphasis:    program.outlineEmphasis,
	classGroups:        JSON.parse(program.classGroups),
	fileGroups:         JSON.parse(program.fileGroups),
	fileGroupRatios:    JSON.parse(program.fileGroupRatios),
	classRatios:        JSON.parse(program.classRatios),
	container:          JSON.parse(program.container),
	ignoreExpression:   JSON.parse(program.ignoreExpression),
	ignoreList:         JSON.parse(program.ignoreList),
	removeList:         JSON.parse(program.removeList),
	exclusiveList:      JSON.parse(program.exclusiveList),
	postProcess:        JSON.parse(program.postProcess),
	customWriteFile:    JSON.parse(program.customWriteFile),
	fixedSize:          JSON.parse(program.fixedSize)
};

// Creating a new Jeff
// His only purpose in life: extracting the given swf file(s) for your beautiful eyes
var jeff = new Jeff();
jeff.extractSwf(exportParams);

// Waving good bye to Jeff