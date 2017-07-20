'use strict';

// function generateHierarchy(symbols, classList) {
// 	/* jshint maxstatements: 100 */

// 	var c, id, symbol;
// 	var parents     = [];
// 	var children    = [];
// 	var ancestors   = [];
// 	var descendants = [];

// 	var ancestorsObjects   = [];
// 	var descendantsObjects = [];
// 	for (id = 0; id < symbols.length; id += 1) {
// 		ancestors[id]   = [];
// 		parents[id]     = [];
// 		children[id]    = [];
// 		descendants[id] = [];

// 		ancestorsObjects[id]   = {};
// 		descendantsObjects[id] = {};
// 	}

// 	var symbolsToIterate = [];
// 	for (var className in classList) {
// 		symbolsToIterate.push(classList[className]);
// 	}

// 	var visitedObjects = {};
// 	while (symbolsToIterate.length > 0) {
// 		id = symbolsToIterate.pop();
// 		symbol = symbols[id];

// 		if (visitedObjects[id]) {
// 			continue;
// 		} else {
// 			visitedObjects[id] = true;
// 		}

// 		// Parsing timeline to make a list of children
// 		var timelineChildren = symbol.children;
// 		if (!timelineChildren) {
// 			continue;
// 		}

// 		var visitedChildren = {};
// 		for (c = 0; c < timelineChildren.length; c += 1) {
// 			var childData = timelineChildren[c];
// 			if (childData === null) {
// 				continue;
// 			}

// 			visitedChildren[childData.id] = childData.id;
// 		}

// 		for (var childIdString in visitedChildren) {
// 			var childId = visitedChildren[childIdString];
// 			symbolsToIterate.push(childId);
// 			children[id].push(childId);
// 			parents[childId].push(id);
// 		}
// 	}

// 	var ancestorId, descendantId;
// 	for (id = 0; id < symbols.length; id += 1) {
// 		var descendantsToVisit = [];
// 		var objectChildren     = children[id];

// 		for (c = 0; c < objectChildren.length; c += 1) {
// 			descendantId = objectChildren[c];
// 			ancestorsObjects[descendantId][id]   = id;
// 			descendantsObjects[id][descendantId] = descendantId;
// 			Array.prototype.push.apply(descendantsToVisit, children[descendantId]);
// 		}

// 		while (descendantsToVisit.length > 0) {
// 			descendantId = descendantsToVisit.pop();
// 			ancestorsObjects[descendantId][id]   = id;
// 			descendantsObjects[id][descendantId] = descendantId;
// 			Array.prototype.push.apply(descendantsToVisit, children[descendantId]);
// 		}
// 	}

// 	for (id = 0; id < symbols.length; id += 1) {
// 		var ancestorsObject = ancestorsObjects[id];
// 		for (ancestorId in ancestorsObject) {
// 			ancestors[id].push(ancestorsObject[ancestorId]);
// 		}

// 		var descendantsObject = descendantsObjects[id];
// 		for (descendantId in descendantsObject) {
// 			descendants[id].push(descendantsObject[descendantId]);
// 		}
// 	}

// 	return {
// 		parents:     parents,
// 		ancestors:   ancestors,
// 		descendants: descendants,
// 		children:    children
// 	};
// }

// function generateExportList(symbols, classList) {
// 	var symbolList = [];
// 	var visistedSymbols = {};

// 	var descendants = generateHierarchy(symbols, classList).descendants;

// 	for (var className in classList) {
// 		var classId = classList[className];
// 		symbolList[classId] = classId;
// 		var classDescendants = descendants[classId];
// 		for (var d = 0; d < classDescendants.length; d += 1) {
// 			var symbolId = classDescendants[d];
// 			symbolList[symbolId] = symbolId;
// 		}
// 	}

// 	return symbolList;
// }


function generateExportList(items, classList, attributeFilter) {
	var itemList = [];

	// Creating list of items to export
	// Starting with the items corresponding to the classes to export
	var itemsToVisit = [];
	for (var className in classList) {
		var classId = classList[className];

		if (attributeFilter) {
			var classSymbol = items[classId];
			for (var a = 0; a < attributeFilter.length; a +=1) {
				if (classSymbol[attributeFilter[a]]) {
					// The class has the corresponding attribute, it is added for export
					itemsToVisit.push(classId);
				}
			}
		} else {
			itemsToVisit.push(classId);
		}
	}

	// Including symbols that are descendants of the classes to export
	var visistedItems = {};
	while (itemsToVisit.length > 0) {
		var itemId = itemsToVisit.pop();
		if (visistedItems[itemId]) {
			continue;
		}

		visistedItems[itemId] = true;

		// First time to visit the item
		// Adding it to the list of symbols to export
		itemList.push(itemId);

		var item = items[itemId];
		if (item.isSprite) {
			continue;
		}

		var children = item.children;
		for (var c = 0; c < children.length; c += 1) {
			var childData = children[c];
			itemsToVisit.push(childData.id);
		}
	}

	return itemList;
}
module.exports = generateExportList;