"use strict"

function getImage() {

	console.log("Using getImage");
	
	var image = null;

	if (typeof(window) !== 'undefined' && typeof(document) !== 'undefined' && typeof(document.createElement) !== 'undefined') {
		image = document.createElement('img');

		return image;
	} else {
		var Canvas = require('./Canvas');
		image = Canvas.Image;

		return image;
	}
}

module.exports = getImage;
