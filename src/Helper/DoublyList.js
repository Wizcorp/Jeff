
/**
 * DOUBLY LIST Class
 *
 * @author Brice Chevalier
 *
 * @desc Doubly list data structure, elements can be removed in O(1)
 * It cannot contain
 *
 *    Method                Time Complexity
 *    ___________________________________
 *
 *    add                    O(1)
 *    push                   O(1)
 *    addBefore              O(1)
 *    addAfter               O(1)
 *    replace                O(1)
 *    remove                 O(1)
 *    getFirst               O(1)
 *    getLast                O(1)
 *    getCount               O(1)
 *    forEach                O(n * P) where P is the complexity of the processing function
 *    forEachReverse         O(n * P) where P is the complexity of the processing function
 *    clear                  O(n)
 *
 *    Memory Complexity in O(n)
 */


function Node(obj, previous, next) {
	this.object   = obj;
	this.previous = previous;
	this.next     = next;
}

var listIdx = 0;
function DoublyList() {
	this._count = 0;
	this._last  = null;
	this._first = null;

	this._referenceProperty = '_doublyList' + (listIdx++) + 'Ref';
}

module.exports = DoublyList;

DoublyList.prototype.add = function (obj) {
	if (!obj || typeof obj !== 'object') {
		throw new TypeError('DoublyList can only contain objects');
	}

	if (obj[this._referenceProperty]) {
		return obj[this._referenceProperty];
	}

	this._count += 1;
	var newNode = new Node(obj, null, this._first);
	obj[this._referenceProperty] = newNode;

	if (this._first === null) {
		this._first = newNode;
		this._last  = newNode;
	} else {
		// insertion before the first node
		this._first.previous = newNode;
		this._first = newNode;
	}
	return newNode;
};

DoublyList.prototype.push = function (obj) {
	if (!obj || typeof obj !== 'object') {
		throw new TypeError('DoublyList can only contain objects');
	}

	if (obj[this._referenceProperty]) {
		return obj[this._referenceProperty];
	}

	this._count += 1;
	var newNode = new Node(obj, this._last, null);
	obj[this._referenceProperty] = newNode;

	if (this._first === null) {
		this._first = newNode;
		this._last  = newNode;
	} else {
		// insertion after the last node
		this._last.next = newNode;
		this._last = newNode;
	}
	return newNode;
};

DoublyList.prototype.replace = function (obj, replacedObj) {
	var replaceNode = replacedObj[this._referenceProperty];
	if (!replaceNode) {
		return;
	}
	replaceNode.obj = obj;
	return replaceNode;
};

DoublyList.prototype.getRef = function (obj) {
	var node = obj[this._referenceProperty];
	if (!node) {
		return undefined;
	}
	return node;
};

DoublyList.prototype.remove = function (obj) {
	var node = obj[this._referenceProperty];
	if (!node) {
		return false;
	}
	delete obj[this._referenceProperty];
	this._count -= 1;

	// Removing any reference to the node
	if (node.next === null) {
		this._last = node.previous;
	} else {
		node.next.previous = node.previous;
	}

	if (node.previous === null) {
		this._first = node.next;
	} else {
		node.previous.next = node.next;
	}

	// Removing any reference from the node to any other element of the list
	node.previous = null;
	node.next     = null;

	return true;
};

DoublyList.prototype.getFirst = function () {
	return this._first;
};

DoublyList.prototype.getLast = function () {
	return this._last;
};

DoublyList.prototype.clear = function () {
	this._first = null;
	this._last  = null;
};

DoublyList.prototype.getCount = function () {
	return this._count;
};

DoublyList.prototype.forEach = function (processingFunc, params) {
	for (var current = this._first; current; current = current.next) {
		processingFunc(current.object, params);
	}
};

DoublyList.prototype.forEachReverse = function (processingFunc, params) {
	for (var current = this._last; current; current = current.previous) {
		processingFunc(current.object, params);
	}
};
