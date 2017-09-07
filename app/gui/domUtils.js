var fs = require('fs');

// make require css create a css style
require.extensions['.css'] = function (module, filename) {
	var element = document.createElement('style');
	element.type = 'text/css';
	var textNode = document.createTextNode(fs.readFileSync(filename, 'utf8'));
	element.appendChild(textNode);
	document.getElementsByTagName('head')[0].appendChild(element);
	module.exports = null;
};

// make require html returns text content
require.extensions['.html'] = function (module, filename) {
	var html = fs.readFileSync(filename, 'utf8');
	module.exports = html;
};

// dom utility functions
var DOCUMENT_BODY = document.getElementsByTagName('body')[0];

function createDom(type, className, parent) {
	parent = parent || DOCUMENT_BODY;
	var dom = document.createElement(type);
	parent.appendChild(dom);
	if (className) dom.className = className;
	return dom;
}

function createDiv(className, parent) {
	return createDom('div', className, parent);
}

function clickable(dom, onClic) {
	dom.addEventListener('mousedown', function (e) {
		e.stopPropagation();
		e.preventDefault();
		onClic.call(dom, e);
	});
	return dom;
}

exports.createDom = createDom;
exports.createDiv = createDiv;
exports.clickable = clickable;
