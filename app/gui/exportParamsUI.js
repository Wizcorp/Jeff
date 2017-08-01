var exportParams = require('./exportParams');
var domUtils     = require('./domUtils');
var createDom    = domUtils.createDom;
var createDiv    = domUtils.createDiv;
var clickable    = domUtils.clickable;


var JEFF_OPTIONS_UI = {
	scope:              { type: 'dropdown', values: ['main', 'classes'], desc: 'Scope of the animation to export' },
	filtering:          { type: 'dropdown', values: ['linear'], desc: 'Filtering that should be used by animation' },
	ratio:              { type: 'number', desc: 'Image scale' },
	renderFrames:       { type: 'toggle', desc: 'Extract specified frames as PNGs' },
	createAtlas:        { type: 'toggle', desc: 'Extract images into a single atlas' },
	powerOf2Images:     { type: 'toggle', desc: 'Set image dimensions to a powers of 2' },
	maxImageDim:        { type: 'number', isInteger: true, desc: 'Maximum image dimension' },
	simplify:           { type: 'toggle', desc: 'Simplify animations' },
	beautify:           { type: 'toggle', desc: 'Beautify JSON output' },
	flatten:            { type: 'toggle', desc: 'Extract a flat animation structure' },
	compressMatrices:   { type: 'toggle', desc: 'Use compressed format for matrices' },
	splitClasses:       { type: 'toggle', desc: 'Split the different classes' },
	exportAtRoot:       { type: 'toggle', desc: 'Export everything at root directory' },
	ignoreData:         { type: 'toggle', desc: 'Not to export JSON meta-data' },
	ignoreImages:       { type: 'toggle', desc: 'Not to export images' },
	outlineEmphasis:    { type: 'number', desc: 'Emphasis of outlines of vectorial drawings' }
};

var jeffOptions = createDiv('jeffOptions');


function createOptionEntry(id, def) {
	var optionEntry = createDiv('jeffOption', jeffOptions);
	var title = createDiv('jeffOption-title', optionEntry);
	title.innerText = id;

	var container = createDiv('jeffOption-container', optionEntry);

	var description = createDiv('jeffOption-description', optionEntry);
	description.innerText = def.desc || '';

	return container;
}

function createToggle(id, def) {
	var container = createOptionEntry(id, def);

	var input = createDom('input', 'checkbox', container);
	input.type = 'checkbox';
	input.checked = exportParams[id];
	input.addEventListener('change', function onChange() {
		exportParams[id] = !!input.checked;
	});
}

function createDropdown(id, def) {
	var container = createOptionEntry(id, def);
	var dropdown = createDom('select', 'dropdown', container);
	for (var i = 0; i < def.values.length; i++) {
		var option = createDom('option', null, dropdown);
		var value = def.values[i];
		option.value = value;
		option.innerText = value;
	}

	dropdown.addEventListener('change', function onChange() {
		exportParams[id] = dropdown.value;
	});
}

function createNumberInput(id, def) {
	var container = createOptionEntry(id, def);
	var input = createDom('input', 'numberInput', container);
	input.type = 'number';
	input.value = exportParams[id];
	input.addEventListener('change', function onChange() {
		var value = input.value;
		if (value <= 0) value = 1; // all Jeff number are strictly positive
		if (def.isInteger) value = Math.round(value);
		input.value = value;
		exportParams[id] = value;
	});
}

var CONTRUCTOR_BY_TYPE = {
	toggle:   createToggle,
	dropdown: createDropdown,
	number:   createNumberInput
};

for (var id in JEFF_OPTIONS_UI) {
	var def = JEFF_OPTIONS_UI[id];
	CONTRUCTOR_BY_TYPE[def.type](id, def);
}
