
function removeSymbols(symbols, classSymbols, removeList){
	var nbClassSymbols = classSymbols.length;
	for (var s = 0; s < nbClassSymbols; s += 1) {

		var classSymbol = classSymbols[s];
		if (!classSymbol || !classSymbol.children) {
			continue;
		}

		var children = classSymbol.children;
		for (var c = 0; c < children.length; c += 1) {

			var child  = children[c];
			var symbol = symbols[child.id];
			if (!symbol.className){
				continue;
			}

			var idx = removeList.indexOf(symbol.className);
			if (idx !== -1) {
				children.splice(c, 1);
				c -= 1;
			}
		}
	}
}

module.exports = removeSymbols;