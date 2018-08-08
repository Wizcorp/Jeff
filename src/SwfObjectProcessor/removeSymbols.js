'use strict';

function removeSymbols(symbols, classSymbols, removeList) {
    var nbClassSymbols = classSymbols.length;

    for (var s = 0; s < nbClassSymbols; s++) {
        var classSymbol = classSymbols[s];

        if (!classSymbol || !classSymbol.children) {
            continue;
        }

        var children = classSymbol.children;

        for (var c = 0; c < children.length; c++) {
            var child = children[c];

            if (!child || typeof child.id === "undefined") {
                continue;
            }

            var symbol = symbols[child.id];

            if (!symbol || !symbol.className) {
                continue;
            }

            if (removeList && removeList.length > 0) {
                var idx = removeList.indexOf(symbol.className);

                if (idx !== -1) {
                    children.splice(c, 1);
                    c -= 1;
                }
            }
        }
    }
}

module.exports = removeSymbols;