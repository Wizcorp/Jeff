'use strict';

var createSymbols     = require('./createSymbols');
var addClassNames     = require('./addClassNames');
var generateChildren  = require('./generateChildren');
var addContainer      = require('./addContainer');
var removeSymbols     = require('./removeSymbols');
var computeBounds     = require('./computeBounds');
var computeDimensions = require('./computeDimensions');

function processSwfObjects(swfObjects, allClasses, params) {

	// Creating symbols from swfObjects
	var symbols = createSymbols(swfObjects);

	// Adding class names to symbols
	var classSymbols = addClassNames(symbols, allClasses);

	// Generating symbols' lists of children over time from swfObject timeline
	generateChildren(symbols);

	// Adding animation container, if any
	if (params.container) addContainer(symbols, classSymbols, params.container);

	// Removing elements with respect to removeList, if any
	if (params.removeList) removeSymbols(symbols, classSymbols, params.removeList);

	// Computing bounds per frame for each symbol
	computeBounds(symbols);

	// Computing maximum dimensions per class for each graphic
	computeDimensions(symbols, allClasses);

	return symbols;
}
module.exports = processSwfObjects;
