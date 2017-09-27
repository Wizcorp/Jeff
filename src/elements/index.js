
function Dimensions () {
	this.width  = 0;
	this.height = 0;
}

function Bounds (left, right, top, bottom) {
	this.left   = left;
	this.right  = right;
	this.top    = top;
	this.bottom = bottom;
}

function Item () {
	this.id = -1;

	this.swfObject = null;
	this.parents   = {};
	this.className = null;
}

function Sprite () {
	Item.call(this);
	this.maxDims = new Dimensions();

	this.isImage    = false;
	this.isShape    = false;
	this.isMorphing = false;

	this.bounds = null;
	this.shapes = null;
	this.images = null;
}

Sprite.prototype.isSprite = true;
Sprite.prototype.frameCount = 1;

function Symbol (frameCount, frameRate, frameSize) {
	Item.call(this);
	this.frameCount = frameCount;
	this.frameRate = frameRate;
	this.frameSize = frameSize;
	this.scalingGrid = null;
	this.children = [];
	this.bounds = [];
}

Symbol.prototype.isSymbol = true;

function UnhandledItem () {
	Item.call(this);

	this.unhandled = true;
}

UnhandledItem.prototype.isUnhandled = true;


module.exports.Bounds = Bounds;
module.exports.Sprite = Sprite;
module.exports.Symbol = Symbol;
module.exports.UnhandledItem = UnhandledItem;
