'use strict';

function groupSwfObjects(groupSwfObjects) {
	// Symbols from several input swf files have to be merged
	// Duplicated classes will be discared with respect to the priorities

	var idOffset = 0;
	function updateId(key, val) {
		if (key === 'id') {
			return val + idOffset;
		}
		return val;
	}

	var swfObjects = [];
	for (var g = 0; g < groupSwfObjects.length; g += 1) {
		idOffset = swfObjects.length;

		// Parsing swfObject of given file while updating all its ids
		var updatedSwfObjects = JSON.parse(JSON.stringify(groupSwfObjects[g], updateId));

		var s, swfObject;
		for (s = 0; s < updatedSwfObjects.length; s += 1) {
			swfObject = updatedSwfObjects[s];
			swfObjects.push(swfObject);
		}

		// Updating ids of the symbolClasses objects
		for (s = 0; s < updatedSwfObjects.length; s += 1) {
			swfObject = updatedSwfObjects[s];
			var symbolClasses = swfObject.symbolClasses;
			if (symbolClasses) {
				var newSymbolClasses = {};
				for (var className in symbolClasses) {
					newSymbolClasses[className] = symbolClasses[className] + idOffset;
				}
				swfObject.symbolClasses = newSymbolClasses;
			}
		}
	}

	return swfObjects;
}
module.exports = groupSwfObjects;