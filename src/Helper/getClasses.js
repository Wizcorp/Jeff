
function getClasses(swfObjects, exportMain) {

	var classList = {};
	var mains     = [];
	for (var s = 0; s < swfObjects.length; s += 1) {
		var swfObject = swfObjects[s];

		// Populating a global class list using class lists of different objects
		// Priority to swfObject with lowest index
		var classes = swfObject.symbolClasses;
		if (classes) {
			for (var className in classes) {
				if (!classList[className]) {
					classList[className] = [];
				} 
				classList[className].push(classes[className]);
			}
		}

		// Adding mains to class list 
		if (swfObject.type === 'main') {
			mains.push(swfObject.id);
		}
	}

	if (exportMain) {
		if (mains.length === 1) {
			classList.main = [mains[0]];
		} else {
			for (var m = 0; m < mains.length; m += 1) {
				classList['main' + m] = [mains[m]];
			}
		}
	}

	return classList;
}
module.exports = getClasses;
