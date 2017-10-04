
function groupSwfObjects(swfObjectGroups) {
	// Merging swf objects from several input swf files
	// Duplicated classes will be discared with respect to the priorities

	var idOffset = 0;
	function updateId(key, val) {
		if (key === 'id') {
			return val + idOffset;
		}
		return val;
	}

	var swfObjects  = [];
	var nGroups     = swfObjectGroups.length;
	for (var g = 0; g < nGroups; g += 1) {
		idOffset = swfObjects.length;

		// Making a deep copy of swf objects with updated IDs
		var updatedSwfObjects = JSON.parse(JSON.stringify(swfObjectGroups[g], updateId));

		var s, swfObject;
		var nObjects = updatedSwfObjects.length;
		for (s = 0; s < nObjects; s += 1) {
			swfObject = updatedSwfObjects[s];
			if (!swfObject) {
				console.warn('[helper.groupSwfObjects] Had to substitute undefined swf object (id ' + s + ') by empty object');
				swfObjects.push({ id: s });
				continue;
			}

			swfObjects.push(swfObject);
		}


		// Updating IDs of the symbolClasses objects within the newly added swf objects
		var nValidObjects = swfObjects.length;
		for (s = idOffset; s < nValidObjects; s += 1) {
			swfObject = swfObjects[s];

			var symbolClasses = swfObject.symbolClasses;
			if (!symbolClasses) {
				continue;
			}

			var newSymbolClasses = {};
			for (var className in symbolClasses) {
				newSymbolClasses[className] = symbolClasses[className] + idOffset;
			}
			swfObject.symbolClasses = newSymbolClasses;
		}
	}

	return swfObjects;
}
module.exports = groupSwfObjects;