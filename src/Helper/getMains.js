
function getMains(swfObjects) {
	var mains = [];
	for (var s = 0; s < swfObjects.length; s += 1) {
		var swfObject = swfObjects[s];
		if (swfObject.type === 'main') {
			mains.push(swfObject.id);
		}
	}

	if (mains.length === 1) {
		return { main: mains[0] };
	}

	var classList = {};
	for (var m = 0; m < mains.length; m += 1) {
		classList['main' + m] = mains[m];
	}

	return classList;
}
module.exports = getMains;