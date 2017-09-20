// See http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/swf/pdf/swf-file-format-spec.pdf


var Base = require('./base.js');
var Stream = require('./stream.js');

function SwfParser() {}
module.exports = SwfParser;

// TODO: figure out if we can get rid of this 'nlizeMatrix' function
function nlizeMatrix(matrix) {
	return {
		scaleX: matrix.scaleX * 20,
		scaleY: matrix.scaleY * 20,
		skewX: matrix.skewX * 20,
		skewY: matrix.skewY * 20,
		moveX: matrix.moveX,
		moveY: matrix.moveY
	};
}

function dumpVal(str, max) {
	var len = str.length;
	var hex = '';
	var txt = '';
	if (len > max) len = max;
	for (var i = 0; i < len; i++) {
		var code = typeof str === 'string' ? str.charCodeAt(i) : code = str[i];
		hex += '' + code.toString(16) + ',';
		txt += code > 0x1f ? String.fromCharCode(code) : '.';
	}
	if (len < str.length) hex += '...';
	else hex = hex.substr(0, hex.length - 1);
	return '(' + len + ' bytes)' + hex + ' | ' + txt;
}

SwfParser.prototype = {

	// Parses SWF format data.
	// swfName is just for error messages
	// swfData is a buffer containing the SWF data
	// onData(object) will be called several times with the result of the parsing of 1 object
	// cb(error) will be called at the end or upon error
	parse: function (swfName, swfData, onData, cb) {
		this.swfName = swfName;
		this.onData  = onData;

		var stream = new Stream(swfData);
		this._readSwlTable(stream); // Symbol table not used
		var sign = stream.readString(3);

		this.version = stream.readUI8();
		this.fileLen = stream.readUI32();

		var signatures = Base.validSignatures;
		if (sign === signatures.COMPRESSED_SWF) {
			var self = this;
			stream.decompressAsync(function () {
				self._parseSwf(stream, cb);
			});
		} else if (sign === signatures.SWF) {
			this._parseSwf(stream, cb);
		} else {
			cb('Invalid SWF file: ' + swfName);
		}
	},

	// TODO: wonder for a while why we need this function and remove it
	// once we figure out it is actually useless:
	// Supposition: the swl table is here to mention which classes should be
	// exported, otherwise the number of exported classes can be really high.
	// However this function should not appear in this component as it is meant
	// to extract regular swf files.
	// It should possible to determine the symbols of the swl table from the dofus database

	// Special table at the head of a ".swl" file; we did not find why this is useful...
	// Maybe to be able to easily look for which symbols are defined in a .swf without
	// having to parse/decompress it all.
	_readSwlTable: function (stream) {
		var sign = stream.readString(2);
		if (sign[0] !== 'L' || sign.charCodeAt(1) !== 0) {
			stream.seek(-2);
			return null;
		}
		stream.readUI16();
		stream.readUI16();
		stream.readUI16();
		var n = (stream.readUI8() << 8) + stream.readUI8();
		var symbols = [];
		while (n-- > 0) {
			var len = (stream.readUI8() << 8) + stream.readUI8();
			symbols.push(stream.readString(len));
		}
		return symbols;
	},

	_parseSwf: function (stream, cb) {
		//console.log('entering parseSwf... len=',this.fileLen);
		this.aborting = false;
		this.skippedTags = {};
		this._dictionary = {};
		this._jpegTables = null;
		//create a "header" object with file level info
		this.onData({
			type: 'header',
			version: this.version,
			fileLength: this.fileLen,
			frameSize: stream.readRect(),
			frameRate: stream.readUI16() / 256
		});
		this._symbolClasses = {};
		//parse the main frame that contains everything else
		this._parseMainFrame(stream, cb);
	},

	_parseMainFrame: function (stream, cb) {
		var h = Base.tagHandlers, SHOW_FRAME = Base.tagCodes.SHOW_FRAME;
		var code = 0;
		var timeline = [];
		var frameCount = stream.readUI16();
		var mainFrame = {
			type: 'main',
			frameCount: frameCount, //maybe useless since timeline.length has it too
			id: 0,
			timeline: timeline,
			symbolClasses: this._symbolClasses
		};
		var f = 0;
		do {
			var frm = {
				type: 'frame',
				displayList: {}
			};
			f++;
			var numTags = 0;
			while (true) {
				var hdr = stream.readUI16();
				code = hdr >> 6;
				var len = hdr & 0x3f,
					handle = h[code];
				if (0x3f === len) { len = stream.readUI32(); }
				if (!code || code === SHOW_FRAME) break;
				numTags++;
				if (this[handle]) { this._handleTag(handle, stream, len, frm); }
				else { this._handleUnhandledTag(handle, code, stream, stream.offset, len); }
				if (this.aborting) {
					console.warn('Aborting the parsing of ' + this.swfName);
					cb('Parsing failed');
					return;
				}
			}
			if (numTags > 0) timeline.push(frm);
		} while (code);
		this._generateWarnings();
		this.onData(mainFrame);
		this._dictionary.main = mainFrame;
		cb();
	},

	//NB: quite similar to _parseMainFrame
	_handleDefineSprite: function (stream, offset, taglen) {
		var h = Base.tagHandlers, SHOW_FRAME = Base.tagCodes.SHOW_FRAME;
		var sprTags = Base.spriteTags;
		offset = offset; //not used
		taglen = taglen; //not used
		var id = stream.readUI16();
		//console.log('_handleDefineSprite',id,offset)
		var frameCount = stream.readUI16();
		var timeline = [];
		var sprite = {
			type: 'sprite',
			frameCount: frameCount,
			id: id,
			timeline: timeline
		};
		var code = 0;
		do {
			var frm = {
				type: 'frame',
				displayList: {}
			};
			var numTags = 0;
			do {
				var hdr = stream.readUI16();
				code = hdr >> 6;
				var len = hdr & 0x3f,
					handle = h[code];
				if (0x3f === len) { len = stream.readUI32(); }
				if (!code || code === SHOW_FRAME) break;
				numTags++;
				// console.log('handling sprite', handle);
				if (sprTags.indexOf(code) >= 0 && this[handle]) { this._handleTag(handle, stream, len, frm); } //this[handle](stream,stream.offset,len,frm)
				else { this._handleUnhandledTag(handle, code, stream, stream.offset, len, frm); }
				if (this.aborting) return null;
			}while (code);
			if (code !== 0) {
				timeline.push(frm);
			}
		}while (code);
		this.onData(sprite);
		this._dictionary[id] = sprite;
		return this;
	},

	_handleTag: function (handle, stream, len, frm) {
		//var id = stream.readUI16(); stream.seek(-2)
		//console.log('parsing tag '+handle+', len:'+len+', id:'+id)
		var offset = stream.offset;
		try {
			this[handle](stream, offset, len, frm);
			var lenRead = stream.offset - offset;
			if (lenRead !== len) throw new Error('Parsing error in ' + handle + ': actual len read=' + lenRead + ' VS intended len=' + len);
		} catch (e) {
			console.warn(this.swfName + ': ' + e);
			stream.seek(offset, true);
			var val = stream.readString(len);
			console.warn(this.swfName + ': Mishandled tag:', handle.substr(7) + '=' + dumpVal(val, 500) + ' total length:' + len + ' starting at:' + offset);
			this.aborting = true;
		}
	},

	_handleUnhandledTag: function (handle, code, stream, offset, len) {
		//if (! frm.unknownTags) frm.unknownTags = [];
		if (!handle) code = 'code ' + code;
		else code = handle.substr(7) + '/code ' + code;
		var val = stream.readString(len);
		//frm.unknownTags.push(code+'='+dumpVal(val,50));
		console.warn(this.swfName + ': Unhandled tag:', code + '=' + dumpVal(val, 30) + ' total length:' + len);
		// this.aborting = true;
		//throw new Error('Aborting '+this.swfName)
	},

	_skipEndOfTag: function (tag, fine2skip, stream, offset, len) {
		if (!fine2skip) {
			if (!this.skippedTags[tag]) this.skippedTags[tag] = 1;
			else this.skippedTags[tag]++;
		}
		stream.seek(len - (stream.offset - offset));
	},

	_generateWarnings: function () {
		var tags = this.skippedTags;
		for (var tag in tags) {
			var count = tags[tag];
			console.warn(this.swfName + ': Skipped ' + count + ' time(stream) tag ' + tag);
		}
	},

	//---------------------------------------------------------
	//we ignore or fake the tags below (in alphabetical order)
	_handleCsmTextSettings: function (stream, offset, len) {
		this._skipEndOfTag('CsmTextSettings', true, stream, offset, len);
	},
	_handleDefineBinaryData: function (stream, offset, len) {
		this._skipEndOfTag('DefineBinaryData', true, stream, offset, len);
	},
	_handleDefineEditText: function (stream, offset, len) {
		var id = stream.readUI16();
		var edit = { type: 'fakeEditText', id: id };
		this._dictionary[id] = edit;
		this.onData(edit);
		this._skipEndOfTag('DefineEditText', true, stream, offset, len);
	},
	_handleDefineScalingGrid: function (stream, offset, len) {
		var grid = {
			type: 'scalingGrid',
			appliedTo: stream.readUI16(),
			rect: stream.readRect(),
		};
		this.onData(grid);
	},
	_handleDefineSceneAndFrameLabelData: function (stream, offset, len) {
		var sceneNames  = [];
		var sceneLabels = [];
		var sceneAndFrameLabelData = {
			type: 'labels',
			sceneNames: sceneNames,
			sceneLabels: sceneLabels
		};

		var sceneCount = stream.readEncodedU32();
		for (var s = 0; s < sceneCount; s += 1) {
			sceneNames.push({ offset: stream.readEncodedU32(), name: stream.readString() });
		}

		var frameLabelCount = stream.readEncodedU32();
		for (var l = 0; l < frameLabelCount; l += 1) {
			sceneLabels.push({ number: stream.readEncodedU32(), label: stream.readString() });
		}

		this.onData(sceneAndFrameLabelData);
	},
	_handleDebugId: function (stream) { stream.readString(16); },
	_handleDoAbc: function (stream, offset, len) {
		var action = {
			type: 'DoAbc',
			lazyInitializeFlag: stream.readUI32() & 1, //kDoAbcLazyInitializeFlag = 1
			name: stream.readString(),
			len: len,
		};
		this.onData(action);
		this._skipEndOfTag('DoAbc', true, stream, offset, len);
	},
	_handleDoAction: function (stream, offset, len, frm) {
		var actions = [];
		var action = {
			type: 'DoAction',
			actions: actions,
			len: len,
		};
		frm.action = action;
		this._skipEndOfTag('DoAction', true, stream, offset, len);
	},
	_handleEnableDebugger2: function (stream, offset, len) { stream.seek(len); offset = offset; },
	_handleExportAssets: function (stream, offset, len) {
		// var tags = [];
		// var exportAssets = {
		// 	type: 'exportAssets',
		// 	tags: tags
		// };

		// var count = stream.readUI16();
		// for (var i = 0; i < count; i += 1) {
		// 	tags.push({ id: stream.readUI16(), name: stream.readString() });
		// }
		// this.onData(exportAssets);

		// Simply adding pair (name, id) to list of symbol classes
		// (is it the right way to do?)
		var count = stream.readUI16();
		for (var i = 0; i < count; i += 1) {
			var id = stream.readUI16();
			var name = stream.readString();
			this._symbolClasses[name] = id;
		}
	},
	_handleFileAttributes: function (stream) { stream.readUI32(); },
	_handleMetadata: function (stream) {
		stream.readString(); // XML defined using the RDF def (XMP specification). More info on W3C site.
	},
	_handleProductInfo: function (stream) { stream.readString(26); },
	_handleProtect: function (stream, offset, len) { stream.seek(len); offset = offset; },
	_handleScriptLimits: function (stream) {
		stream.readUI16(); // MaxRecursionDepth
		stream.readUI16(); // ScriptTimeoutSeconds
	},
	_handleUndocumented1: function (stream, offset, len) {
		offset = offset;
		var code = stream.readUI8();
		if (code !== 0 || len !== 1) throw new Error('Unexpected value in undocumented1 tag: ' + code + ',' + len);
	},
	//---------------------------------------------------------

	_handleSymbolClass: function (stream, offset, len, frm) {
		var count = stream.readUI16();
		while (count--) {
			var id = stream.readUI16();
			var name = stream.readString();
			this._symbolClasses[name] = id;
		}
	},

	_handleFrameLabel: function (stream, offset, len, frm) {
		frm.label = stream.readString();
	},

	_handleDefineShape2: function (stream, offset, len) {
		this._handleDefineShape(stream, offset, len);
	},

	_handleDefineShape3: function (stream, offset, len, frm) {
		this._handleDefineShape(stream, offset, len, frm, /*withAlpha=*/true);
	},

	_handleDefineShape4: function (stream, offset, len, frm) {
		this._handleDefineShape(stream, offset, len, frm, /*withAlpha=*/true, /*v4shape=*/true);
	},

	_handleDefineShape: function (stream, offset, len, frm, withAlpha, v4shape) {
		var id = stream.readUI16();
		var shape = {
			type:  'shape',
			id:     id,
			bounds: stream.readRect()
		};

		if (v4shape) {
			shape.strokeRect = stream.readRect();
			stream.readUB(5); //reserved

			// TODO: figure out the utility of the following parameters
			shape.usesFillWindingRule   = stream.readUB(1);
			shape.usesNonScalingStrokes = stream.readUB(1);
			shape.usesScalingStrokes    = stream.readUB(1);
		}


		var fillStyles = this._readFillStyles(stream, withAlpha);
		var lineStyles = this._readLineStyles(stream, withAlpha, /*morph=*/ false, /*v2lineStyle=*/ v4shape);
		shape.edges = this._readEdges(stream, fillStyles, lineStyles, withAlpha, /*morph=*/ false, /*v2edges=*/ v4shape);

		this.onData(shape);
		this._dictionary[id] = shape;
	},

	_handleDefineMorphShape2: function (stream, offset, len, frm) {
		//console.log('DefineMorphShape2 ',offset,len)
		this._handleDefineMorphShape(stream, offset, len, frm, true);
	},

	_handleDefineMorphShape: function (stream, offset, len, frm, v2morph) {
		var id = stream.readUI16();
		//console.log('DefineMorphShape ',id,offset,len,v2morph)
		var shape = {
				type:        'morph',
				id:          id,
				startBounds: stream.readRect(),
				endBounds:   stream.readRect(),
			};
		if (v2morph) {
			shape.startEdgeBounds = stream.readRect();
			shape.endEdgeBounds   = stream.readRect();
			//1 byte of flags:
			var reserved = stream.readUB(5);
			if (reserved !== 0) throw new Error('Unknown flags: ' + reserved);
			shape.usesFillWindingRule = stream.readUB(1);
			shape.usesNonScalingStrokes = stream.readUB(1);
			shape.usesScalingStrokes = stream.readUB(1);
		}
		var beforeEndEdges = stream.readUI32();
		var endEdgesOffset = stream.offset + beforeEndEdges; //we will control this is true below
		if (endEdgesOffset < stream.offset || endEdgesOffset > offset + len) throw new Error('Parsing failed in DefineMorphShape');
		var fillStyles = this._readFillStyles(stream, /*withAlpha=*/ true, /*morph=*/ true);
		var lineStyles = this._readLineStyles(stream, /*withAlpha=*/ true, /*morph=*/ true, /*v2lineStyle=*/ v2morph);
		shape.startEdges = this._readEdges(stream, fillStyles, lineStyles, true, /*morph=*/ true, /*v2edges=*/ v2morph);
		if (stream.offset !== endEdgesOffset)
			throw new Error('Parsing failure in DefineMorphShape: ' + stream.offset + ',' + endEdgesOffset + ',' + v2morph);
		shape.endEdges = this._readEdges(stream, fillStyles, lineStyles, true, /*morph=*/ true, /*v2edges=*/ v2morph);

		this.onData(shape);
		this._dictionary[id] = shape;
	},

	_readEdges: function (stream, fillStyles, lineStyles, withAlpha, morph, v2edges) {
		/* jshint maxstatements: 80 */
		var changeStates = Base.styleChangeStates;
		var numFillBits = stream.readUB(4);
		var numLineBits = stream.readUB(4);

		var shapes  = [];
		var records = [];

		var x = 0;
		var y = 0;

		var leftFill;
		var rightFill;

		var rightFillIdx = 0;
		var leftFillIdx  = 0;

		var lineIdx  = 0;
		var styleIdx = 0;
		var edgeIdx  = 0;

		var lineStyle;
		while (true) {
			var type = stream.readUB(1);
			if (type) {
				var isStraight = stream.readBool();
				var numBits = stream.readUB(4) + 2;
				var edge, x2, y2;
				if (isStraight) {
					var isGeneral = stream.readBool();
					if (isGeneral) {
						x2 = x + stream.readSB(numBits);
						y2 = y + stream.readSB(numBits);
					} else {
						var isVertical = stream.readBool();
						if (isVertical) {
							x2 = x;
							y2 = y + stream.readSB(numBits);
						} else {
							x2 = x + stream.readSB(numBits);
							y2 = y;
						}
					}
					edge = {
						x1: x,  y1: y,
						x2: x2, y2: y2,
						c: false,
						i: edgeIdx
					};
					edgeIdx += 1;
				} else {
					var cx = x + stream.readSB(numBits);
					var cy = y + stream.readSB(numBits);
					x2 = cx + stream.readSB(numBits);
					y2 = cy + stream.readSB(numBits);
					edge = {
						x1: x,  y1: y,
						cx: cx, cy: cy,
						x2: x2, y2: y2,
						c: true,
						i: edgeIdx
					};
					edgeIdx += 1;
				}

				x = x2;
				y = y2;
				records.push(edge);
			} else {
				var state = stream.readUB(5);
				if (state) {
					// New Record
					if (state & changeStates.MOVE_TO) {
						var moveBits = stream.readUB(5);
						x = stream.readSB(moveBits);
						y = stream.readSB(moveBits);
					}

					if (state & changeStates.LEFT_FILL_STYLE) {
						// Left fill
						leftFillIdx = stream.readUB(numFillBits);
						// Should be undefined when leftFillIdx === 0
						leftFill = fillStyles ? fillStyles[leftFillIdx - 1] : undefined;
					}

					if (state & changeStates.RIGHT_FILL_STYLE) {
						// Right fill
						rightFillIdx = stream.readUB(numFillBits);
						// Should be undefined when rightFillIdx === 0
						rightFill = fillStyles ? fillStyles[rightFillIdx - 1] : undefined;
					}

					if (state & changeStates.LINE_STYLE) {
						lineIdx = stream.readUB(numLineBits);
						// Should be undefined when lineIdx === 0
						lineStyle = lineStyles ? lineStyles[lineIdx - 1] : undefined;
					}

					if (state & changeStates.NEW_STYLES) {
						fillStyles = this._readFillStyles(stream, withAlpha, morph);
						lineStyles = this._readLineStyles(stream, withAlpha, morph, /*v2lineStyle=*/ v2edges);
						numFillBits = stream.readUB(4);
						numLineBits = stream.readUB(4);
						styleIdx += 1;
					}

					// Initialising new records
					records = [];
					var shape = {};
					if (records      !== undefined) shape.records      = records;
					if (leftFill     !== undefined) shape.leftFill     = leftFill;
					if (rightFill    !== undefined) shape.rightFill    = rightFill;
					if (lineIdx      !== undefined) shape.lineIdx      = lineIdx;
					if (leftFillIdx  !== undefined) shape.leftFillIdx  = leftFillIdx;
					if (rightFillIdx !== undefined) shape.rightFillIdx = rightFillIdx;
					if (styleIdx     !== undefined) shape.styleIdx     = styleIdx;
					if (lineStyle    !== undefined) shape.lineStyle    = lineStyle;
					shapes.push(shape);
				} else {
					// No more records
					break;
				}
			}
		}
		stream.align();

		return shapes;
	},

	_readFillStyles: function (stream, withAlpha, morph) {
		var numStyles = stream.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = stream.readUI16(); }
		while (numStyles--) {
			var style = this._readFillStyle(stream, withAlpha, morph);
			styles.push(style);
		}
		return styles;
	},

	_readFillStyle: function (stream, withAlpha, morph) {
		var style,
			matrix,
			type = stream.readUI8(),
			f = Base.fillStyleTypes;

		switch (type) {
		case f.SOLID:
			if (morph) { style = [stream.readRGBA(), stream.readRGBA()]; }
			else { style = withAlpha ? stream.readRGBA() : stream.readRGB(); }
			break;
		case f.FOCAL_RADIAL_GRADIENT:
		case f.LINEAR_GRADIENT:
		case f.RADIAL_GRADIENT:
			if (morph) { matrix = [nlizeMatrix(stream.readMatrix()), nlizeMatrix(stream.readMatrix())]; }
			else { matrix = nlizeMatrix(stream.readMatrix()); }
			var stops = [];
			style = {
				type: type === f.LINEAR_GRADIENT ? 'linear' :
					(type === f.FOCAL_RADIAL_GRADIENT ? 'focal-radial' : 'radial'),
				matrix: matrix,
				spread: stream.readUB(2),
				interpolation: stream.readUB(2),
				stops: stops
			};
			var numStops = stream.readUB(4);
			if (numStops === 0) throw new Error('Invalid NumGradients value: ' + numStops);
			//Disabling warning below since, despite was Adobe doc v19 says, the format is as we
			//implemented here. For sure the limit for morphs is not 8 but 15 just like for shapes.
			//if (morph && (style.spread!==0 || style.interpolation!==0))
			//	console.warn('Undocumented flags for morph FillStyle: ',style.spread,style.interpolation)
			while (numStops--) {
				var offset = stream.readUI8() / 255,
					color = (withAlpha || morph) ? stream.readRGBA() : stream.readRGB();
				stops.push({
					offset: morph ? [offset, stream.readUI8() / 255] : offset,
					color: morph ? [color, stream.readRGBA()] : color
				});
			}
			if (type === f.FOCAL_RADIAL_GRADIENT) {
				style.focalPoint = morph ? [stream.readFixed8(), stream.readFixed8()] : stream.readFixed8();
			}
			break;
		case f.REPEATING_BITMAP:
		case f.CLIPPED_BITMAP:
		case f.NON_SMOOTHED_CLIPPED_BITMAP:
		case f.NON_SMOOTHED_REPEATING_BITMAP:
			var imgId = stream.readUI16();
			var img = imgId !== 65535 ? this._dictionary[imgId] : null; //null as placeholder for animations
			if (img === undefined) {
				img = 'id:' + imgId;
				console.warn(this.swfName + ': Image used but not found: ' + imgId);
				//throw new Error('Image not found: ID='+imgId);
			}
			matrix = morph ? [stream.readMatrix(), stream.readMatrix()] : stream.readMatrix();
			style = {
				type: 'pattern',
				image: img,
				matrix: matrix,
			};
			if (type === f.REPEATING_BITMAP || type === f.NON_SMOOTHED_REPEATING_BITMAP)
				style.repeat = true;
			if (type === f.NON_SMOOTHED_CLIPPED_BITMAP || type === f.NON_SMOOTHED_REPEATING_BITMAP)
				style.nonSmoothed = true;
			break;
		default:
			throw new Error('Invalid style found in _readFillStyle: ' + type);
		}
		return style;
	},

	_readLineStyles: function (stream, withAlpha, morph, v2lineStyle) {
		if (v2lineStyle) return this._readLineStylesV2(stream, morph);
		var numStyles = stream.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = stream.readUI16(); }
		while (numStyles--) {
			var style = {};
			if (morph) {
				var width0 = stream.readUI16();
				var width1 = stream.readUI16();
				style.width = [(width0 >= 2) ? width0 : 2, (width1 >= 2) ? width1 : 2];
			} else {
				var width = stream.readUI16();
				style.width = (width >= 2) ? width : 2;
			}
			var color = morph ? [stream.readRGBA(), stream.readRGBA()] : (withAlpha ? stream.readRGBA() : stream.readRGB());
			style.color = color;
			styles.push(style);
		}
		return styles;
	},

	_readLineStylesV2: function (stream, morph) {
		var numStyles = stream.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = stream.readUI16(); }
		while (numStyles--) {
			var style = {};
			if (morph) {
				var width0 = stream.readUI16();
				var width1 = stream.readUI16();
				style.width = [(width0 >= 2) ? width0 : 2, (width1 >= 2) ? width1 : 2];
			} else {
				var width = stream.readUI16();
				style.width = (width >= 2) ? width : 2;
			}
			var capStart, join, capEnd;
			switch (stream.readUB(2)) {
			case 0:
				capStart = 'ROUND';
				break;
			case 1:
				capStart = 'FLAT';
				break;
			case 2:
				capStart = 'SQUARE';
				break;
			default:
				capStart = 'ERROR';
			}
			switch (stream.readUB(2)) {
			case 0:
				join = 'ROUND';
				break;
			case 1:
				join = 'BEVEL';
				break;
			case 2:
				join = 'MITER';
				break;
			default:
				join = 'ERROR';
			}
			var hasFill = stream.readUB(1);
			style.noHScale = stream.readUB(1);
			style.noVScale = stream.readUB(1);
			style.pixelHinting = stream.readUB(1);
			var reserved = stream.readUB(5);
			if (reserved !== 0) throw new Error('Invalid LineStyle flags: ' + reserved);
			style.noClose = stream.readUB(1);
			switch (stream.readUB(2)) {
			case 0:
				capEnd = 'ROUND';
				break;
			case 1:
				capEnd = 'FLAT';
				break;
			case 2:
				capEnd = 'SQUARE';
				break;
			default:
				capEnd = 'ERROR';
			}
			stream.align();
			style.capStart = capStart;
			style.join = join;
			style.capEnd = capEnd;
			if (join === 'MITER') style.miterLimit = stream.readFixed8();
			if (!hasFill) {
				style.color = morph ? [stream.readRGBA(), stream.readRGBA()] : stream.readRGBA();
			} else {
				style.fill = this._readFillStyle(stream, /*withAlpha=*/true, morph);
			}
			styles.push(style);
		}
		return styles;
	},

	_handlePlaceObject: function (stream, offset, len, frm) {
		var objId = stream.readUI16();
		var depth = stream.readUI16();
		var character = {
			id: this._dictionary[objId].id,
			depth: depth,
			matrix: stream.readMatrix()
		};
		if (stream.offset - offset !== len) { character.cxform = stream.readCxform(); }
		frm.displayList[depth] = character;
	},

	_handlePlaceObject2: function (stream, offset, len, frm) {
		this._handlePlaceObject3(stream, offset, len, frm, true);
	},

	_handlePlaceObject3: function (stream, offset, len, frm, v2place) {
		var f            = Base.placeFlags;
		var flags        = stream.readUI8();
		var flags2       = v2place ? 0 : stream.readUI8();
		var depth        = stream.readUI16();
		var hasCharacter = flags  & f.HAS_CHARACTER;
		var hasImage     = flags2 & f.HAS_IMAGE;
		var baseClass    = ((flags2 & f.HAS_CLASS_NAME) || (hasImage && hasCharacter)) ? stream.readString : undefined;
		var character    = { depth: depth, baseClass: baseClass };

		if (hasCharacter) {
			var objId = stream.readUI16();
			if (this._dictionary[objId]) {
				if (this._dictionary[objId].id !== objId)
					throw new Error('Unexpected error in PlaceObject'); //should not happen ever!
				character.id = this._dictionary[objId].id;
			} else {
				//if you see this, it usually means something
				//not handled has been skipped - or we are parsing in the wild...
				console.warn(this.swfName + ': Sprite includes missing object ' + objId);
			}
		}
		if (flags  & f.HAS_MATRIX)            { character.matrix           = stream.readMatrix(); }
		if (flags  & f.HAS_CXFORM)            { character.cxform           = stream.readCxformA(); }
		if (flags  & f.HAS_RATIO)             { character.ratio            = stream.readUI16(); }
		if (flags  & f.HAS_NAME)              { character.name             = stream.readString(); }
		if (flags  & f.HAS_CLIP_DEPTH)        { character.clipDepth        = stream.readUI16(); }
		if (flags2 & f.HAS_FILTER_LIST)       { character.filters          = this._readFilterList(stream); }
		if (flags2 & f.HAS_BLEND_MODE)        { character.blendMode        = stream.readUI8(); }
		if (flags2 & f.HAS_CACHE_AS_BITMAP)   { character.bitmapCache      = stream.readUI8(); }
		if (flags2 & f.HAS_VISIBLE)           { character.visible          = stream.readUI8(); character.bgColor = stream.readRGBA(); }
		if (flags2 & f.HAS_OPAQUE_BACKGROUND) { character.opaqueBackground = true; }
		if (flags  & f.HAS_CLIP_ACTIONS) { //NOT HANDLED; we should be OK
			this._skipEndOfTag('PlaceObject ClipActions', false, stream, offset, len);
		}
		frm.displayList[depth] = character;
	},

	_handleRemoveObject2: function (stream, offset, len, frm) {
		var depth = stream.readUI16();
		frm.displayList[depth] = null;
	},

	_handleRemoveObject: function (stream, offset, len, frm) {
		stream.readUI16(); //ID
		var depth = stream.readUI16();
		frm.displayList[depth] = null;
	},

	_handleDefineBitsLossless2: function (stream, offset, len, frm) {
		this._handleDefineBitsLossless(stream, offset, len, frm, true);
	},

	_handleDefineBitsLossless: function (stream, offset, len, frm, withAlpha) {
		var id = stream.readUI16();
		var format = stream.readUI8();
		var img = {
			type: 'image',
			id: id,
			width: stream.readUI16(),
			height: stream.readUI16(),
			withAlpha: withAlpha || false
		};

		if (format === Base.bitmapFormats.COLORMAPPED) {
			img.colorTableSize = stream.readUI8() + 1;
		}
	
		img.colorData = stream.readBytes(len - (stream.offset - offset));
		this.onData(img);
		this._dictionary[id] = img;
	},

	_handleDefineBitsJpeg3: function (stream, offset, len, frm) {
		this._handleDefineBits(stream, offset, len, frm, true);
	},

	_handleDefineBitsJpeg2: function (stream, offset, len) {
		this._handleDefineBits(stream, offset, len);
	},

	_handleDefineBits: function (stream, offset, len, frm, withAlpha) {
		var id = stream.readUI16();
		var img = {
			type: 'image',
			id: id
		};

		var data;
		if (withAlpha) {
			var alphaDataOffset = stream.readUI32();
			data = stream.readBytes(alphaDataOffset);
			img.alphaData = stream.readBytes(len - (stream.offset - offset));
		} else {
			data = stream.readBytes(len - 2);
		}

		var nBytes = data.length;
		for (var i = 0; i < nBytes; i++) {
			if (data[i++] === 0xff && data[i++] === 0xd9 && data[i++] === 0xff && data[i++] === 0xd8) {
				// Fix mentioned in https://github.com/tobeytailor/gordon/issues/4
				// See also markers on http://en.wikipedia.org/wiki/JPEG
				// 0xffd9 is a marker for a start of image
				// 0xffd8 is a marker for an end of image
				data = Buffer.concat([data.slice(0, i - 4), data.slice(i)]);
			}
		}

		img.data = this._jpegTables && this._jpegTables.length > 1 ?
			Buffer.concat(this._jpegTables.slice(0, this._jpegTables.length - 2), data.slice(2)) : data;

		this.onData(img);
		this._dictionary[id] = img;
	},

	_handleDefineButton2: function (stream, offset, len, frm) {
		this._handleDefineButton(stream, offset, len, frm, true);
	},

	_handleDefineButton: function (stream, offset, len, frm, advanced) {
		var id = stream.readUI16();
		var d = this._dictionary;
		var states = {};
		var button = {
			type: 'button',
			id: id,
			states: states,
			trackAsMenu: advanced ? stream.readBool(8) : false
		};

		if (advanced) { stream.seek(2); }
		while (true) {
			var flags = stream.readUI8();
			if (!flags) break;
			var objId = stream.readUI16(),
				depth = stream.readUI16(),
				state = 0x01,
				character = {
					id: d[objId].id,
					depth: depth,
					matrix: stream.readMatrix()
				};
			if (advanced) { character.cxform = stream.readCxformA(); }
			while (state <= 0x08) {
				if (flags & state) {
					var list = states[state] || (states[state] = {});
					list[depth] = character;
				}
				state <<= 1;
			}
		}
		//rest of tag is button action (not implemented)
		button.action = undefined;
		this._skipEndOfTag('Button-action', true, stream, offset, len);
		this.onData(button);
		d[id] = button;
	},

	_handleDefineButtonCxform: function (stream) {
		var d = this._dictionary,
			buttonId = stream.readUI16(),
			button = d[buttonId];
		button.cxform = stream.readCxform();
		this.onData(button);
		d[buttonId] = button;
	},

	_handleJpegTables: function (stream, offset, len) {
		this._jpegTables = stream.readBytes(len);
	},

	_handleSetBackgroundColor: function (stream, offset, len, frm) {
		frm.bgcolor = stream.readRGB();
	},

	_handleDefineFont: function (stream) {
		var id = stream.readUI16(),
			numGlyphs = stream.readUI16() / 2,
			glyphs = [],
			font = {
				type: 'font',
				id: id,
				glyphs: glyphs
			};
		stream.seek(numGlyphs * 2 - 2);
		while (numGlyphs--) { glyphs.push(this._readEdges(stream)); }
		this.onData(font);
		this._dictionary[id] = font;
	},

	_handleDefineFont2: function (stream, offset, len) {
		offset = offset; //not used
		len = len; //not used
		var id = stream.readUI16();
		var glyphs = [];
		var codeTable = [];
		var font = {
			type: 'font',
			id: id,
			glyphs: glyphs,
			codeTable: codeTable,
			hasLayout:      stream.readBool(),
			isShiftJIS:     stream.readBool(),
			isSmall:        stream.readBool(),
			isANSI:         stream.readBool(),
			useWideOffsets: stream.readBool(),
			isUTF8:         stream.readBool(),
			isItalic:       stream.readBool(),
			isBold:         stream.readBool(),
			languageCode:   (this.version > 5) ? stream.readLanguageCode() : 0,
			name:           stream.readUI8() && stream.readString()
		};

		var numGlyphs = stream.readUI16();
		var w = font.useWideOffsets;
		var offsets = [];
		var tablesOffset = stream.offset;
		var u = font.isUTF8;
		var i = numGlyphs;
		while (i--) { offsets.push(w ? stream.readUI32() : stream.readUI16()); }
		stream.seek(w ? 4 : 2);
		i = 0;
		for (var o = offsets[0]; o; o = offsets[++i]) {
			stream.seek(tablesOffset + o, true);
			glyphs.push(this._readEdges(stream));
		}
		i = numGlyphs;
		while (i--) { codeTable.push(u ? stream.readUI16() : stream.readUI8()); }
		if (font.hasLayout) {
			font.ascent  = stream.readUI16();
			font.descent = stream.readUI16();
			font.leading = stream.readUI16();
			var advanceTable = font.advanceTable = [];
			var boundsTable  = font.boundsTable  = [];
			var kerningTable = font.kerningTable = [];
			i = numGlyphs;
			while (i--) { advanceTable.push(stream.readUI16()); }
			i = numGlyphs;
			while (i--) { boundsTable.push(stream.readRect()); }
			var kerningCount = stream.readUI16();
			while (kerningCount--) {
				kerningTable.push({
					code1: u ? stream.readUI16() : stream.readUI8(),
					code2: u ? stream.readUI16() : stream.readUI8(),
					adjustment: stream.readUI16()
				});
			}
		}
		this.onData(font);
		this._dictionary[id] = font;
	},

	_handleDefineFont3: function (stream, offset, len) {
		var startingOffset = stream.offset;
// console.error('version', this.version)
// console.error('offset -1', stream.offset)
		var id = stream.readUI16();
// console.error('offset 0', stream.offset)
		var font = {
			type: 'font',
			id: id,
			hasLayout:      stream.readBool(),
			isShiftJIS:     stream.readBool(),
			isSmall:        stream.readBool(),
			isANSI:         stream.readBool(),
			useWideOffsets: stream.readBool(),
			isUTF8:         stream.readBool(),
			isItalic:       stream.readBool(),
			isBold:         stream.readBool(),
			languageCode:   (this.version > 5) ? stream.readLanguageCode() : 0,
			name:           stream.readUI8() && stream.readString()
		};

// console.error('offset 1', stream.offset)
// console.error('font is', font)
		var n;
		var numGlyphs   = stream.readUI16();
		if (numGlyphs !== 0) {

			var offsetTable = [];
	// console.error('offset 4', stream.offset)
	// console.error('numGlyphs is', numGlyphs)

			n = numGlyphs;
			while (n--) {
				if (font.useWideOffsets) {
					stream.readUI32();
				} else {
					stream.readUI16();
				}
			} // offsetTable
			// if (stream.offset - startingOffset !== len) {
			// codeTableOffset
			if (font.useWideOffsets) {
				stream.readUI32();
			} else {
				stream.readUI16();
			}
			// }

	// console.error('offset 5', stream.offset)
			var glyphs = [];
			n = numGlyphs;
			while (n--) { glyphs.push(this._readEdges(stream)); }
			font.glyphs = glyphs;
	// console.error('offset 6', stream.offset)

			var codeTable = [];
			n = numGlyphs;
			while (n--) { codeTable.push(stream.readUI16()); }
			font.codeTable = codeTable;
	// console.error('offset 7', stream.offset)
		}

		if (font.hasLayout) {
			// N.B:  Not tested
			// TODO: This part of the code needs to be checked
			font.fontAscent  = stream.readUI16();
			font.fontDescent = stream.readUI16();
			font.fontLeading = stream.readSI16();

			var advanceTable = [];
			var boundsTable  = [];
			var kerningTable = [];

			n = numGlyphs;
			while (n--) { advanceTable.push(stream.readUI16()); }
			font.advanceTable = advanceTable;

			n = numGlyphs;
			while (n--) { boundsTable.push(stream.readRect()); }
			font.boundsTable = boundsTable;

			var isUTF8 = font.isUTF8;
			var kerningCount  = stream.readUI16();
			font.kerningCount = kerningCount;
			while (kerningCount--) {
				kerningTable.push({
					code1: isUTF8 ? stream.readUI16() : stream.readUI8(),
					code2: isUTF8 ? stream.readUI16() : stream.readUI8(),
					adjustment: stream.readUI16()
				});
			}
			font.kerningTable = kerningTable;
		}
// console.error('offset 8', stream.offset, len)

		if (stream.offset - startingOffset < len) {
			console.warn('[_handleDefineFont3] Discrepancy in the number of bytes read: read ' + (stream.offset - startingOffset) + ' bytes, expected ' + len + ' bytes.');
			stream.offset = startingOffset + len;
		}

		this._dictionary[id] = font;
		this.onData(font);
	},

	_handleDefineFont4: function (stream, offset, len) {
		this._handleDefineFont3(stream, offset, len);
	},

	_handleDefineFontAlignZones: function (stream, offset, len) {
		this._skipEndOfTag('DefineFontAlignZones', true, stream, offset, len);
	},

	_handleDefineFontName: function (stream) {
		var id = stream.readUI16();
		var font = {
				type: 'fontName',
				id: id,
				fontName: stream.readString(),
			};
		stream.readString(); // FontCopyright
		this._dictionary[id] = font;
		this.onData(font);
	},

	_handleDefineFontInfo: function (stream, offset, len) {
		offset = offset; //not used
		len = len; //not used
		var d = this._dictionary,
			fontId = stream.readUI16(),
			font = d[fontId],
			codes = [],
			f = font.info = {
				name: stream.readString(stream.readUI8()),
				isSmall: stream.readBool(3),
				isShiftJIS: stream.readBool(),
				isANSI: stream.readBool(),
				isItalic: stream.readBool(),
				isBold: stream.readBool(),
				codes: codes
			},
			u = f.isUTF8 = stream.readBool(),
			i = font.glyphs.length;
		while (i--) { codes.push(u ? stream.readUI16() : stream.readUI8()); }
		this.onData(font);
		d[fontId] = font;
	},

	_handleDefineText2: function (stream, offset, len, frm) {
		this._handleDefineText(stream, offset, len, frm, /*withAlpha=*/true);
	},

	_handleDefineText: function (stream, offset, length, frm, withAlpha) {
		var id = stream.readUI16();

		var strings = [];
		var text    = {
			type: 'text',
			id: id,
			bounds: stream.readRect(),
			matrix: stream.readMatrix(),
			strings: strings
		};
		var numGlyphBits = stream.readUI8();
		var numAdvBits   = stream.readUI8();

		var fontId = null;
		var fill   = null;
		var x      = 0;
		var y      = 0;
		var size   = 0;
		var string = null;
		var dico  = this._dictionary;

		while (true) {
			var hdr = stream.readUB(8);

			if (!hdr){
				break;
			}

			var type = hdr >> 7;
			if (type) {
				var flags = hdr & 0x0f;
				if (flags) {
					var f = Base.textStyleFlags;
					if (flags & f.HAS_FONT)    { fontId = stream.readUI16(); }
					if (flags & f.HAS_COLOR)   { fill   = withAlpha ? stream.readRGBA() : stream.readRGB(); }
					if (flags & f.HAS_XOFFSET) { x      = stream.readSI16(); }
					if (flags & f.HAS_YOFFSET) { y      = stream.readSI16(); }
					if (flags & f.HAS_FONT)    { size   = stream.readUI16(); }
				}
				if (fontId !== null && !dico[fontId]) {
					console.warn(this.swfName + ': DefineText ' + id + ' uses ignored font ' + fontId);
				}
				string = {
					font: fontId,
					fill: fill,
					x: x, y: y,
					size: size,
					entries: []
				};
				strings.push(string);
			} else {
				var numGlyphs = hdr & 0x7f;
				var entries   = string.entries;
				while (numGlyphs--) {
					var index = stream.readUB(numGlyphBits);
					var adv   = stream.readSB(numAdvBits);
					entries.push({
						index: index,
						advance: adv,
					});
					x += adv;
				}
				stream.align();
			}
		}
		dico[id] = text;
		this.onData(text);
	},

	_readFilterList: function (stream) {
		var numFilters = stream.readUI8();
		var i, filter;
		var filters = [];
		//console.log('NumFilters:',numFilters)
		while (numFilters--) {
			var filterId = stream.readUI8();
			switch (filterId) {
			case 0: // DropShadowFilter
				filter = {
					type: 'drop shadow',
					dropShadowColor: stream.readRGBA(),
					blurX:           stream.readFixed(),
					blurY:           stream.readFixed(),
					angle:           stream.readFixed(),
					distance:        stream.readFixed(),
					strength:        stream.readFixed8(),
					inner:           stream.readUB(1),
					knockout:        stream.readUB(1),
					compositeSource: stream.readUB(1),
					numPasses:       stream.readUB(5)
				};
				break;
			case 1: // BlurFilter
				filter = {
					type: 'blur',
					blurX: stream.readFixed(),
					blurY: stream.readFixed(),
					numPasses: stream.readUB(5)
				};
				if (stream.readUB(3) !== 0) throw new Error('Invalid blur filter');
				break;
			case 2: // GlowFilter
				filter = {
					type: 'glow',
					glowColor:       stream.readRGBA(),
					blurX:           stream.readFixed(),
					blurY:           stream.readFixed(),
					strength:        stream.readFixed8(),
					inner:           stream.readUB(1),
					knockout:        stream.readUB(1),
					compositeSource: stream.readUB(1),
					numPasses:       stream.readUB(5)
				};
				break;
			case 3: //BevelFilter
				filter = {
					type: 'bevel',
					highlightColor:  stream.readRGBA(),
					shadowColor:     stream.readRGBA(),
					blurX:           stream.readFixed(),
					blurY:           stream.readFixed(),
					angle:           stream.readFixed(),
					distance:        stream.readFixed(),
					strength:        stream.readFixed8(),
					inner:           stream.readUB(1),
					knockout:        stream.readUB(1),
					compositeSource: stream.readUB(1),
					onTop:           stream.readUB(1),
					numPasses:       stream.readUB(4)
				};
				break;
			case 4: // GradientGlowFilter
				var numColors = stream.readUI8();
				var gc = [], gr = [];
				for (i = numColors; i > 0; i--) gc.push(stream.readRGBA());
				for (i = numColors; i > 0; i--) gr.push(stream.readUI8());
				filter = {
					type: 'gradient glow',
					gradientColors:  gc,
					gradientRatios:  gr,
					blurX:           stream.readFixed(),
					blurY:           stream.readFixed(),
					angle:           stream.readFixed(),
					distance:        stream.readFixed(),
					strength:        stream.readFixed8(),
					inner:           stream.readUB(1),
					knockout:        stream.readUB(1),
					compositeSource: stream.readUB(1),
					onTop:           stream.readUB(1),
					numPasses:       stream.readUB(4)
				};
				break;
			case 6: // ColorMatrixFilter
				var m = [];
				for (i = 20; i > 0; i--) m.push(stream.readFloat());
				filter = {
					type: 'color matrix',
					matrix: m
				};
				break;
			//not handled yet:
			case 5: //ConvolutionFilter
			case 7: //GradientBevelFilter
				throw new Error('Unhandled filter: ' + filterId);
			default:
				throw new Error('Invalid filter code: ' + filterId);
			}
			filters.push(filter);
		}
		return filters;
	}

}; //end SwfParser.prototype

