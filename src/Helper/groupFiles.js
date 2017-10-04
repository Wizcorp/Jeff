
function getFileName(uri) {
	var separator = uri.match('.d2p') ? ':' : '/';
	return uri.substring(uri.lastIndexOf(separator) + 1, uri.lastIndexOf('.'));
}

function groupFiles(uris, fileGroupsRegEx) {
	var fileGroupsArray  = [];
	var u, fileName;
	if (!fileGroupsRegEx) {
		for (u = 0; u < uris.length; u += 1) {
			fileName = getFileName(uris[u]);
			fileGroupsArray.push({ input: [uris[u]], output: fileName });
		}
		return fileGroupsArray;
	}

	// Creating one group per file
	var fileGroupsObject = {};
	for (u = 0; u < uris.length; u += 1) {
		fileName = getFileName(uris[u]);
		fileGroupsObject[fileName] = [uris[u]];
	}

	var output;
	for (output in fileGroupsRegEx) {
		var fileGroup = fileGroupsObject[output];
		if (fileGroup === undefined) {
			fileGroup = [];
			fileGroupsObject[output] = fileGroup;
		}

		var groupRegEx = fileGroupsRegEx[output]; // pattern of the current group
		for (u = 0; u < uris.length; u += 1) {
			fileName = getFileName(uris[u]);
			if (fileName === output) {
				// File name is identical to the output, therefore they are merged
				continue;
			}

			// Merging file to group if it matches the pattern
			if (fileName.match(groupRegEx)) {
				fileGroup.push(uris[u]);

				// Removing the file as a stand-alone
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
module.exports = groupFiles;