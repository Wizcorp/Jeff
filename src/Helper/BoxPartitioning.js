/* jslint node: true */

var DoublyList = require('./DoublyList.js');

function Box(left, right, top, bottom, element) {
	this.e = element || null;

	this.l = left;
	this.r = right;
	this.t = top;
	this.b = bottom;

	// width
	this.w = this.r - this.l;
	// height
	this.h = this.b - this.t;
	// area
	this.a = this.w * this.h;
}

Box.prototype.reset = function (left, right, top, bottom) {
	this.l = left;
	this.r = right;
	this.t = top;
	this.b = bottom;

	// width
	this.w = this.r - this.l;
	// height
	this.h = this.b - this.t;
	// area
	this.a = this.w * this.h;
};

/**
 * BOX PARTITIONING Class
 *
 * @author Brice Chevalier
 * @desc Manages the sequential insertion of boxes into a given area in order to minimize the total surface at each insertion.
 * However, the result does not guarantee an optimal surface usage in the end.
 *
 * @param {Object} upperBounds, an object containing 4 properties
 * 'left', 'right', 'top' and 'bottom' that defines the area the boxes should fit in 
 *
 * @param {Object} priorityZone, an object containing 4 properties
 * 'left', 'right', 'top' and 'bottom' that defines the area in which boxes are put in priority
 *
 */


// TODO: to speed up the process, replace DoublyList by a tree structure for faster insertion and space fragmentation
function BoxPartitioning(upperBounds, priorityZone) {
	this._freeSpace = new DoublyList();
	this._freeSpace.add(new Box(upperBounds.left, upperBounds.right, upperBounds.top, upperBounds.bottom));

	this.occupiedSpace = [];
	this.occupiedBounds = new Box(Infinity, -Infinity, Infinity, -Infinity);

	var priorityLeft, priorityRight, priorityTop, priorityBottom;
	if (priorityZone) {
		priorityLeft   = priorityZone.left   || Infinity;
		priorityRight  = priorityZone.right  || -Infinity;
		priorityTop    = priorityZone.top    || Infinity;
		priorityBottom = priorityZone.bottom || -Infinity;
	} else {
		priorityLeft   = Infinity;
		priorityRight  = -Infinity;
		priorityTop    = Infinity;
		priorityBottom = -Infinity;
	}
	this._priorityZone = new Box(priorityLeft, priorityRight, priorityTop, priorityBottom);

	this.nRejections = 0;
}
module.exports = BoxPartitioning;

BoxPartitioning.prototype._fragmentFreeSpace = function (newBox) {
	/* jslint maxstatements: 60 */
	var l0 = newBox.l;
	var r0 = newBox.r;
	var t0 = newBox.t;
	var b0 = newBox.b;
	var w0 = newBox.w;
	var h0 = newBox.h;

	var l1;
	var r1;
	var t1;
	var b1;
	
	var freeBox;
	var newFreeSpaceBoxes = [];
	var freeSpacePtr = this._freeSpace.getFirst();
	while (freeSpacePtr !== null) {
		freeBox = freeSpacePtr.object;

		l1 = freeBox.l;
		r1 = freeBox.r;
		t1 = freeBox.t;
		b1 = freeBox.b;

		var l2 = (l0 < l1) ? l0 : l1;
		var r2 = (r0 > r1) ? r0 : r1;
		var t2 = (t0 < t1) ? t0 : t1;
		var b2 = (b0 > b1) ? b0 : b1;
		if ((r2 - l2 < w0 + freeBox.w) && (b2 - t2 < h0 + freeBox.h)) {
			// the free space box intersect with the newly created box

			// saving ptr to the next element
			var next = freeSpacePtr.next;

			// removing box from free space
			this._freeSpace.remove(freeBox);

			// creating new free space boxes

			// box 1
			var newFreeSpaceBox1 = new Box(l1, l0, t1, b1);
			if (newFreeSpaceBox1.a > 0) newFreeSpaceBoxes.push(newFreeSpaceBox1);

			// box 2
			var newFreeSpaceBox2 = new Box(l1, r1, t1, t0);
			if (newFreeSpaceBox2.a > 0) newFreeSpaceBoxes.push(newFreeSpaceBox2);

			// box 3
			var newFreeSpaceBox3 = new Box(r0, r1, t1, b1);
			if (newFreeSpaceBox3.a > 0) newFreeSpaceBoxes.push(newFreeSpaceBox3);

			// box 4
			var newFreeSpaceBox4 = new Box(l1, r1, b0, b1);
			if (newFreeSpaceBox4.a > 0) newFreeSpaceBoxes.push(newFreeSpaceBox4);

			freeSpacePtr = next;
		} else {
			freeSpacePtr = freeSpacePtr.next;
		}

	}

	// Inserting the newly created free space boxes
	for (var i = 0; i < newFreeSpaceBoxes.length; i += 1) {
		var newFreeBox = newFreeSpaceBoxes[i];
		var l = newFreeBox.l;
		var r = newFreeBox.r;
		var t = newFreeBox.t;
		var b = newFreeBox.b;

		var insert = true;

		// Checking for inclusion in existing free space
		freeSpacePtr = this._freeSpace.getFirst();
		while (freeSpacePtr !== null) {
			freeBox = freeSpacePtr.object;
			freeSpacePtr = freeSpacePtr.next;

			if (freeBox.l <= l && r <= freeBox.r && freeBox.t <= t && b <= freeBox.b) {
				insert = false;
				break;
			}
		}

		if (!insert) {
			continue;
		}

		// Checking for inclusion in other newly created free space boxes
		for (var j = i + 1; j < newFreeSpaceBoxes.length; j += 1) {
			freeBox = newFreeSpaceBoxes[j];
			if (freeBox.l <= l && r <= freeBox.r && freeBox.t <= t && b <= freeBox.b) {
				insert = false;
				break;
			}
		}

		if (insert) {
			// free box is not included in any other box of the free space
			this._freeSpace.add(newFreeSpaceBoxes[i]);
		}
	}
};

BoxPartitioning.prototype.add = function (element, w, h) {
	// Finding placement for element such that the total area of occupied space remains minimum

	var minArea = Infinity;
	var minBox  = null;
	var position = { x: 0, y: 0 };

	// Iterating through the free space
	var freeSpacePtr = this._freeSpace.getFirst();
	while (freeSpacePtr !== null) {
		var freeBox = freeSpacePtr.object;

		// Checking for inclusion
		if (w <= freeBox.w && h <= freeBox.h) {

			// Checking for new total area if inserted at position
			var x = freeBox.l;
			var y = freeBox.t;

			var areaW = (x + w > this._priorityZone.r) ? x + w : this._priorityZone.r;
			var areaH = (y + h > this._priorityZone.b) ? y + h : this._priorityZone.b;
			var area = areaW * areaH;
			if (area < minArea || (area === minArea && freeBox.a < minBox.a)) {
				position.x = x;
				position.y = y;

				minArea = area;
				minBox  = freeBox;
			}
		}
		freeSpacePtr = freeSpacePtr.next;
	}

	if (minBox === null) {
		this.nRejections += 1;
		return 0;
	}

	var elementBox = new Box(position.x, position.x + w, position.y, position.y + h, element);
	this.occupiedSpace.push(elementBox);
	this._fragmentFreeSpace(elementBox);

	this._priorityZone.reset(
		(elementBox.l < this._priorityZone.l) ? elementBox.l : this._priorityZone.l,
		(elementBox.r > this._priorityZone.r) ? elementBox.r : this._priorityZone.r,
		(elementBox.t < this._priorityZone.t) ? elementBox.t : this._priorityZone.t,
		(elementBox.b > this._priorityZone.b) ? elementBox.b : this._priorityZone.b
	);

	this.occupiedBounds.reset(
		(elementBox.l < this.occupiedBounds.l) ? elementBox.l : this.occupiedBounds.l,
		(elementBox.r > this.occupiedBounds.r) ? elementBox.r : this.occupiedBounds.r,
		(elementBox.t < this.occupiedBounds.t) ? elementBox.t : this.occupiedBounds.t,
		(elementBox.b > this.occupiedBounds.b) ? elementBox.b : this.occupiedBounds.b
	);

	return 1;
};

BoxPartitioning.prototype.displayFreeSpace = function () {
	console.log('Free Space:');
	var freeSpacePtr = this._freeSpace.getFirst();
	while (freeSpacePtr !== null) {
		var box = freeSpacePtr.object;
		console.log('\t[' + box.l + ',' + box.r + '] X [' + box.t + ',' + box.b + ']');
		freeSpacePtr = freeSpacePtr.next;
	}
};

BoxPartitioning.prototype.displayOccupiedSpace = function () {
	console.log('Occupied Space:');
	for (var i = 0; i < this.occupiedSpace.length; i += 1) {
		var box = this.occupiedSpace[i];
		console.log('\t[' + box.l + ',' + box.r + '] X [' + box.t + ',' + box.b + ']', box.e);
	}
};
