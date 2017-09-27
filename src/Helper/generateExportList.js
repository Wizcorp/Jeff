

function generateExportList(items, classList, attributeFilter) {
	var itemList = {};

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
		itemList[itemId] = true;

		var item = items[itemId];
		if (item.isSprite || item.unhandled) {
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