
function areObjectsDifferent(objectA, objectB) {
	for (var property in objectA) {
		var valueA = objectA[property];
		var valueB = objectB[property];
		if (typeof valueA === 'object') {
			if (typeof valueB !== 'object') {
				return true;
			}

			if (areObjectsDifferent(valueA, valueB)) {
				return true;
			}
		} else {
			if (valueA !== valueB) {
				return true;
			}
		}

	}

	return false;
}
module.exports.areObjectsDifferent = areObjectsDifferent;

module.exports.areTransformsDifferent = function (a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5];
}

module.exports.areColorsDifferent = function (a, b) {
	return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4] || a[5] !== b[5] || a[6] !== b[6] || a[7] !== b[7];
}