
function filterClasses(classList, exclusiveList, ignoreList, ignoreExpression) {
	var className;
	var newClassList = {};

	if (exclusiveList) {
		for (var e = 0; e < exclusiveList.length; e += 1) {
			className = exclusiveList[e];
			if (classList[className]) {
				newClassList[className] = classList[className][0];
			}
		}
	} else {
		for (className in classList) {
			newClassList[className] = classList[className][0];
		}
	}

	if (ignoreList) {
		for (var i = 0; i < ignoreList.length; i += 1) {
			className = ignoreList[i];
			if (newClassList[className]) {
				delete newClassList[className];
			}
		}
	}

	if (ignoreExpression) {
		for (className in newClassList) {
			if (className.match(ignoreExpression)) {
				delete newClassList[className];
			}
		}
	}

	return newClassList;
}
module.exports = filterClasses;