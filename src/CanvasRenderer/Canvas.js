var Canvas;
if (typeof(window) !== 'undefined' && window.Canvas) {
	Canvas = window.Canvas;
} else {
	Canvas = require('canvas');
}
module.exports = Canvas;