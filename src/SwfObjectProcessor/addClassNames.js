'use strict';

function addClassNames(symbols, allClasses) {
	var classSymbols = [];
	for (var className in allClasses) {
		var classIds  = allClasses[className];
		var nbClasses = classIds.length;
		for (var c = 0; c < nbClasses; c += 1) {
			var classSymbol = symbols[classIds[c]];
			if (classSymbol) {
				classSymbol.className = className;
				classSymbols.push(classSymbol);
			}
		}
	}

	return classSymbols;
}

module.exports = addClassNames;
