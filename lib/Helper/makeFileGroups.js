'use strict';

function getFileName(uri) {
	var separator = uri.match('.d2p') ? ':' : '/';
	return uri.substring(uri.lastIndexOf(separator) + 1, uri.lastIndexOf('.'));
}

function makeFileGroups(uris, fileGroups) {
	var fileGroupsArray  = [];
	var u, fileName;
	if (!fileGroups) {
		for (u = 0; u < uris.length; u += 1) {
			fileName = getFileName(uris[u]);
			fileGroupsArray.push({ input: [uris[u]], output: fileName });
		}
		return fileGroupsArray;
	}

	var fileGroupsObject = {};
	for (u = 0; u < uris.length; u += 1) {
		fileName = getFileName(uris[u]);
		fileGroupsObject[fileName] = [uris[u]];
	}


	var output;
	for (output in fileGroups) {
		var groupFiles = fileGroups[output];
		var fileGroup = fileGroupsObject[output];
		if (fileGroup === undefined) {
			fileGroup = [];
			fileGroupsObject[output] = fileGroup;
		}

		for (var f = 0; f < groupFiles.length; f += 1) {
			fileName = groupFiles[f];
			if (fileName === output) {
				continue;
			}
			var fileArray = fileGroupsObject[fileName];
			if (fileArray) {
				fileGroup.push(fileArray[0]);
				delete fileGroupsObject[fileName];
			}
		}

		if (fileGroup.length === 0) {
			delete fileGroupsObject[output];
		}
	}

	// Converting object into array
	for (output in fileGroupsObject) {
		fileGroupsArray.push({ input: fileGroupsObject[output], output: output });
	}

	return fileGroupsArray;
}
module.exports = makeFileGroups;