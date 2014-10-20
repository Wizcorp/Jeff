'use strict';

function groupClasses(classList, classGroups, split) {

	// Grouping classes
	if (!split && Object.keys(classGroups).length === 0) {
		return [{ name: '', list: classList }];
	}

	var splitName;
	var classSplits = {};
	for (splitName in classGroups) {
		classSplits[splitName] = {};
	}

	var className;
	var remainingClasses = [];
	for (className in classList) {
		var matchFound = false;
		for (splitName in classGroups) {
			var splitRegEx = classGroups[splitName];
			if (className.match(splitRegEx)) {
				classSplits[splitName][className] = classList[className];
				matchFound = true;
			}
		}

		if (!matchFound) {
			remainingClasses.push(className);
		}
	}

	var c;
	if (split) {
		for (c = 0; c < remainingClasses.length; c += 1) {
			className = remainingClasses[c];
			classSplits[className] = {};
			classSplits[className][className] = classList[className];
		}
	} else {
		var otherClasses = {};
		classSplits.others = otherClasses;
		for (c = 0; c < remainingClasses.length; c += 1) {
			className = remainingClasses[c];
			otherClasses[className] = classList[className];
		}
	}

	var namedClassLists = [];
	for (splitName in classSplits) {
		var classSplit = classSplits[splitName];
		if (Object.keys(classSplit).length > 0) {
			namedClassLists.push({ name: splitName, list: classSplit });
		}
	}

	return namedClassLists;
}
module.exports = groupClasses;