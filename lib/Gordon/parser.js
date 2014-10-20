//See http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/swf/pdf/swf-file-format-spec.pdf

'use strict';

var Base = require('./base.js');
var Stream = require('./stream.js');

function SwfParser() {
}
module.exports = SwfParser;

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
};

SwfParser.prototype = {

	//Parses SWF (or SWL) format data.
	// swfName is just for error messages
	// swfData is a buffer containing the SWF data
	// ondata(object) will be called several times with the result of the parsing of 1 object
	// cb(error) will be called at the end or upon error
	parse: function (swfName, swfData, ondata, cb) {
		var t = this;
		t.swfName = swfName;
		t.ondata = ondata;
		var s = t._stream = new Stream(swfData);
		t._readSwlTable(s); //symbol table not used
		var sign = s.readString(3),
			v = Base.validSignatures;
		t.version = s.readUI8();
		t.fileLen = s.readUI32();
		if (sign === v.COMPRESSED_SWF) {
			s.decompressAsync(function () {
				t._parseSwf(cb);
			});
		} else if (sign === v.SWF) {
			t._parseSwf(cb);
		} else {
			throw new Error('Invalid SWF file: ' + swfName);
		}
	},

	// TODO: wonder for a while why we need this function and remove it
	// once we figure out it is actually useless:
	// Supposition: the swl table is here to mention which classes should be
	// exported, otherwise the number of exported classes can be really high.
	// However this function should not appear in this component as it is meant
	// to extract regular swf files.
	// It should possible to determine the symbols of the swl table from the dofus database

	//Special table at the head of a ".swl" file; we did not find why this is useful...
	//Maybe to be able to easily look for which symbols are defined in a .swf without
	//having to parse/decompress it all.
	_readSwlTable: function (s) {
		var sign = s.readString(2);
		if (sign[0] !== 'L' || sign.charCodeAt(1) !== 0) {
			s.seek(-2);
			return null;
		}
		s.readNumber(2, true);
		s.readNumber(2, true);
		s.readNumber(2, true);
		var n = s.readNumber(2, true),
			symbols = [];
		while (n-- > 0) {
			var len = s.readNumber(2, true);
			symbols.push(s.readString(len));
		}
		return symbols;
	},

	_parseSwf: function (cb) {
		//console.log('entering parseSwf... len=',this.fileLen);
		var t = this,
			s = t._stream;
		t.aborting = false;
		t.skippedTags = {};
		t._dictionary = {};
		t._jpegTables = null;
		//create a "header" object with file level info
		t.ondata({
			type: 'header',
			version: t.version,
			fileLength: t.fileLen,
			frameSize: s.readRect(),
			frameRate: s.readUI16() / 256
		});
		//parse the main frame that contains everything else
		t._parseMainFrame(s, cb);
	},

	_parseMainFrame: function (s, cb) {
		var h = Base.tagHandlers, SHOW_FRAME = Base.tagCodes.SHOW_FRAME;
		var t = this;
		var code = 0;
		var timeline = [];
		var frameCount = s.readUI16();
		var symbolClasses = {};
		var mainFrame = {
			type: 'main',
			frameCount: frameCount, //maybe useless since timeline.length has it too
			id: 0,
			timeline: timeline,
			symbolClasses: symbolClasses
		};
		var f = 0;
		do {
			var frm = {
				type: 'frame',
				displayList: {},
				symbolClasses: symbolClasses
			};
			f++;
			var numTags = 0;
			while (true) {
				var hdr = s.readUI16();
				code = hdr >> 6;
				var len = hdr & 0x3f,
					handl = h[code];
				if (0x3f === len) { len = s.readUI32(); }
				if (!code || code === SHOW_FRAME) break;
				numTags++;
				if (t[handl]) { t._handleTag(handl, s, len, frm); }
				else { t._handleUnhandledTag(handl, code, s, s.offset, len); }
				if (t.aborting) {
					console.warn('Aborting the parsing of ' + t.swfName);
					cb('Parsing failed');
					return;
				}
			}
			if (numTags > 0) timeline.push(frm);
		} while (code);
		t._generateWarnings();
		t.ondata(mainFrame);
		t._dictionary.main = mainFrame;
		cb();
	},

	//NB: quite similar to _parseMainFrame
	_handleDefineSprite: function (s, offset, taglen) {
		var h = Base.tagHandlers, SHOW_FRAME = Base.tagCodes.SHOW_FRAME;
		var sprTags = Base.spriteTags;
		offset = offset; //not used
		taglen = taglen; //not used
		var id = s.readUI16();
		//console.log('_handleDefineSprite',id,offset)
		var frameCount = s.readUI16();
		var timeline = [];
		var sprite = {
			type: 'sprite',
			frameCount: frameCount, //maybe useless since it is equal to timeline.length
			id: id,
			timeline: timeline
		};
		var code = 0;
		var t = this;
		do {
			var frm = {
				type: 'frame',
				displayList: {}
			};
			var numTags = 0;
			do {
				var hdr = s.readUI16();
				code = hdr >> 6;
				var len = hdr & 0x3f,
					handl = h[code];
				if (0x3f === len) { len = s.readUI32(); }
				if (!code || code === SHOW_FRAME) break;
				numTags++;
				// console.log('handling sprite', handl);
				if (sprTags.indexOf(code) >= 0 && t[handl]) { t._handleTag(handl, s, len, frm); } //t[handl](s,s.offset,len,frm)
				else { t._handleUnhandledTag(handl, code, s, s.offset, len, frm); }
				if (t.aborting) return null;
			}while (code);
			if (numTags > 0) timeline.push(frm);
		}while (code);
		t.ondata(sprite);
		t._dictionary[id] = sprite;
		return t;
	},

	_handleTag: function (handl, s, len, frm) {
		//var id = s.readUI16(); s.seek(-2)
		//console.log('parsing tag '+handl+', len:'+len+', id:'+id)
		var offset = s.offset;
		try {
			this[handl](s, offset, len, frm);
			var lenRead = s.offset - offset;
			if (lenRead !== len) throw new Error('Parsing error in ' + handl + ': actual len read=' + lenRead + ' VS intended len=' + len);
		} catch (e) {
			console.warn(this.swfName + ': ' + e);
			s.seek(offset, true);
			var val = s.readString(len);
			console.warn(this.swfName + ': Mishandled tag:', handl.substr(7) + '=' + dumpVal(val, 500) + ' total length:' + len + ' starting at:' + offset);
			this.aborting = true;
		}
	},

	_handleUnhandledTag: function (handl, code, s, offset, len) {
		//if (! frm.unknownTags) frm.unknownTags = [];
		if (!handl) code = 'code ' + code;
		else code = handl.substr(7) + '/code ' + code;
		var val = s.readString(len);
		//frm.unknownTags.push(code+'='+dumpVal(val,50));
		console.warn(this.swfName + ': Unhandled tag:', code + '=' + dumpVal(val, 30) + ' total length:' + len);
		this.aborting = true;
		//throw new Error('Aborting '+this.swfName)
	},

	_skipEndOfTag: function (tag, fine2skip, s, offset, len) {
		if (!fine2skip) {
			if (!this.skippedTags[tag]) this.skippedTags[tag] = 1;
			else this.skippedTags[tag]++;
		}
		s.seek(len - (s.offset - offset));
	},

	_generateWarnings: function () {
		var tags = this.skippedTags;
		for (var tag in tags) {
			var count = tags[tag];
			console.warn(this.swfName + ': Skipped ' + count + ' time(s) tag ' + tag);
		}
	},

	//---------------------------------------------------------
	//we ignore or fake the tags below (in alphabetical order)
	_handleCsmTextSettings: function (s, offset, len) {
		this._skipEndOfTag('CsmTextSettings', true, s, offset, len);
	},
	_handleDefineBinaryData: function (s, offset, len) {
		this._skipEndOfTag('DefineBinaryData', true, s, offset, len);
	},
	_handleDefineEditText: function (s, offset, len) {
		var id = s.readUI16();
		var edit = { type: 'fakeEditText', id: id };
		this._dictionary[id] = edit;
		this.ondata(edit);
		this._skipEndOfTag('DefineEditText', true, s, offset, len);
	},
	_handleDefineFont3: function (s, offset, len) {
		//NB: function _handleDefineFont exists but needs more work
		var id = s.readUI16();
		var font = {
				type: 'font',
				id: id,
			};
		this._dictionary[id] = font;
		this._skipEndOfTag('DefineFont3 or 4', true, s, offset, len);
		//console.warn('Skipping _handleDefineFontN',id)
		this.ondata(font);
	},
	_handleDefineFont4: function (s, offset, len) {
		this._handleDefineFont3(s, offset, len);
	},
	_handleDefineFontAlignZones: function (s, offset, len) {
		this._skipEndOfTag('DefineFontAlignZones', true, s, offset, len);
	},
	_handleDefineFontName: function (s) {
		var id = s.readUI16();
		var font = {
				type: 'font',
				id: id,
				fontName: s.readString(),
			};
		s.readString(); //FontCopyright
		this._dictionary[id] = font;
		this.ondata(font);
	},
	_handleDefineScalingGrid: function (s, offset, len) {
		var grid = {
			type: 'scalingGrid',
			id: s.readUI16(),
			rect: s.readRect(),
		};
		this.ondata(grid);
		//console.warn(this.swfName + ': Scaling grid ignored for character ' + objId);
		this._skipEndOfTag('DefineScalingGrid', false, s, offset, len);
	},
	_handleDefineSceneAndFrameLabelData: function (s, offset, len) {
		this._skipEndOfTag('DefineScalingGrid', true, s, offset, len);
	},
	_handleDebugId: function (s) { s.readString(16); },
	_handleDoAbc: function (s, offset, len) {
		var action = {
			type: 'DoAbc',
			lazyInitializeFlag: s.readUI32() & 1, //kDoAbcLazyInitializeFlag = 1
			name: s.readString(),
			len: len,
		};
		this.ondata(action);
		this._skipEndOfTag('DoAbc', true, s, offset, len);
	},
	_handleDoAction: function (s, offset, len, frm) {
		var actions = [];
		var action = {
			type: 'DoAction',
			actions: actions,
			len: len,
		};
		frm.action = action;
		this._skipEndOfTag('DoAction', true, s, offset, len);
	},
	_handleEnableDebugger2: function (s, offset, len) { s.seek(len); offset = offset; },
	_handleExportAssets: function (s, offset, len) { s.seek(len); offset = offset; },
	_handleFileAttributes: function (s) { s.readUI32(); },
	_handleMetadata: function (s) {
		s.readString(); //XML defined using the RDF def (XMP specification). More info on W3C site.
	},
	_handleProductInfo: function (s) { s.readString(26); },
	_handleProtect: function (s, offset, len) { s.seek(len); offset = offset; },
	_handleScriptLimits: function (s) {
		s.readUI16(); //MaxRecursionDepth
		s.readUI16(); //ScriptTimeoutSeconds
	},
	_handleUndocumented1: function (s, offset, len) {
		offset = offset;
		var code = s.readUI8();
		if (code !== 0 || len !== 1) throw new Error('Unexpected value in undocumented1 tag: ' + code + ',' + len);
	},
	//---------------------------------------------------------

	_handleSymbolClass: function (s, offset, len, frm) {
		var count = s.readUI16();

		var symbolClasses = frm.symbolClasses;
		if (!symbolClasses) {
			console.warn('No symbolClass on _handleSymbolClass');
			return;
		}

		while (count--) {
			var id = s.readUI16();
			var name = s.readString();
			symbolClasses[name] = id;
		}
	},

	_handleFrameLabel: function (s, offset, len, frm) {
		frm.label = s.readString();
	},

	_handleDefineShape2: function (s, offset, len) {
		this._handleDefineShape(s, offset, len);
	},

	_handleDefineShape3: function (s, offset, len, frm) {
		this._handleDefineShape(s, offset, len, frm, /*withAlpha=*/true);
	},

	_handleDefineShape4: function (s, offset, len, frm) {
		this._handleDefineShape(s, offset, len, frm, /*withAlpha=*/true, /*v4shape=*/true);
	},

	_handleDefineShape: function (s, offset, len, frm, withAlpha, v4shape) {
		var id = s.readUI16();
		//console.log('_handleDefineShape',id,offset,len,withAlpha,v4shape)
		var shape = {
			type: 'shape',
			id: id,
			bounds: s.readRect(),
		};
		var t = this;
		if (v4shape) {
			shape.strokeRect = s.readRect();
			s.readUB(5); //reserved

			// TODO: figure out the utility of the following parameters
			shape.usesFillWindingRule = s.readUB(1);
			shape.usesNonScalingStrokes = s.readUB(1);
			shape.usesScalingStrokes = s.readUB(1);
		}
		var fillStyles = t._readFillStyles(s, withAlpha);
		var lineStyles = t._readLineStyles(s, withAlpha, /*morph=*/ false, /*v2lineStyle=*/ v4shape);
		var edges = t._readEdges(s, fillStyles, lineStyles, withAlpha, /*morph=*/ false, /*v2edges=*/ v4shape);
		// shape._fillStyles = fillStyles;
		// shape._lineStyles = lineStyles;
		// if (edges instanceof Array) {
		// 	var segments = shape.segments = [];
		// 	for (var i = 0, seg = edges[0]; seg; seg = edges[++i]) {
		// 		segments.push({
		// 			type: 'shape',
		// 			id: id + '-' + (i + 1),
		// 			commands: edges2cmds(seg.records, !!seg.line),
		// 			fill: seg.fill,
		// 			line: seg.line
		// 		});
		// 	}
		// } else {
		// 	shape.commands = edges2cmds(edges.records, !!edges.line);
		// 	shape.fill = edges.fill;
		// 	shape.line = edges.line;
		// }
		shape.edges = edges;
		t.ondata(shape);
		t._dictionary[id] = shape;
	},

	_handleDefineMorphShape2: function (s, offset, len, frm) {
		//console.log('DefineMorphShape2 ',offset,len)
		this._handleDefineMorphShape(s, offset, len, frm, true);
	},

	_handleDefineMorphShape: function (s, offset, len, frm, v2morph) {
		var id = s.readUI16();
		//console.log('DefineMorphShape ',id,offset,len,v2morph)
		var shape = {
				type: 'morph',
				id: id,
				startBounds: s.readRect(),
				endBounds: s.readRect(),
			};
		if (v2morph) {
			shape.startEdgeBounds = s.readRect();
			shape.endEdgeBounds = s.readRect();
			//1 byte of flags:
			var reserved = s.readUB(5);
			if (reserved !== 0) throw new Error('Unknown flags: ' + reserved);
			shape.usesFillWindingRule = s.readUB(1);
			shape.usesNonScalingStrokes = s.readUB(1);
			shape.usesScalingStrokes = s.readUB(1);
		}
		var beforeEndEdges = s.readUI32();
		var endEdgesOffset = s.offset + beforeEndEdges; //we will control this is true below
		if (endEdgesOffset < s.offset || endEdgesOffset > offset + len) throw new Error('Parsing failed in DefineMorphShape');
		var fillStyles = this._readFillStyles(s, /*withAlpha=*/ true, /*morph=*/ true);
		var lineStyles = this._readLineStyles(s, /*withAlpha=*/ true, /*morph=*/ true, /*v2lineStyle=*/ v2morph);
		shape.startEdges = this._readEdges(s, fillStyles, lineStyles, true, /*morph=*/ true, /*v2edges=*/ v2morph);
		if (s.offset !== endEdgesOffset)
			throw new Error('Parsing failure in DefineMorphShape: ' + s.offset + ',' + endEdgesOffset + ',' + v2morph);
		shape.endEdges = this._readEdges(s, fillStyles, lineStyles, true, /*morph=*/ true, /*v2edges=*/ v2morph);

		this.ondata(shape);
		this._dictionary[id] = shape;
	},

	_readEdges: function (s, fillStyles, lineStyles, withAlpha, morph, v2edges) {
		/* jshint maxstatements: 80 */
		var changeStates = Base.styleChangeStates;
		var numFillBits = s.readUB(4);
		var numLineBits = s.readUB(4);

		var shapes = [];
		var records;
		var x = 0;
		var y = 0;
		var leftFill;
		var rightFill;
		var rightFillIdx = 0;
		var leftFillIdx = 0;
		var lineIdx = 0;
		var styleIdx = 0;
		var line;

		var endOfShapeRecord = false;
		while (!endOfShapeRecord) {
			var type = s.readUB(1);

			if (type) {
				var isStraight = s.readBool();
				var numBits = s.readUB(4) + 2;
				var edge, x2, y2;
				if (isStraight) {
					var isGeneral = s.readBool();
					if (isGeneral) {
						x2 = x + s.readSB(numBits);
						y2 = y + s.readSB(numBits);
					} else {
						var isVertical = s.readBool();
						if (isVertical) {
							x2 = x;
							y2 = y + s.readSB(numBits);
						} else {
							x2 = x + s.readSB(numBits);
							y2 = y;
						}
					}
					edge = {
						x1: x,
						y1: y,
						x2: x2,
						y2: y2,
						c: false
					};
				} else {
					var cx = x + s.readSB(numBits);
					var cy = y + s.readSB(numBits);
					x2 = cx + s.readSB(numBits);
					y2 = cy + s.readSB(numBits);
					edge = {
						x1: x,
						y1: y,
						cx: cx,
						cy: cy,
						x2: x2,
						y2: y2,
						c: true
					};
				}

				x = x2;
				y = y2;
				records.push(edge);
			} else {
				var state = s.readUB(5);
				if (state) {
					// New Record
					if (state & changeStates.MOVE_TO) {
						var moveBits = s.readUB(5);
						x = s.readSB(moveBits);
						y = s.readSB(moveBits);
					}

					if (state & changeStates.LEFT_FILL_STYLE) {
						// Left fill
						leftFillIdx = s.readUB(numFillBits);
						if (leftFillIdx === 0) {
							leftFill = undefined;
						} else {
							leftFill = fillStyles[leftFillIdx - 1];
						}
					}

					if (state & changeStates.RIGHT_FILL_STYLE) {

						// Right fill
						rightFillIdx = s.readUB(numFillBits);
						if (rightFillIdx === 0) {
							rightFill = undefined;
						} else {
							rightFill = fillStyles[rightFillIdx - 1];
						}
					}

					if (state & changeStates.LINE_STYLE) {
						lineIdx = s.readUB(numLineBits);
						if (lineIdx === 0) {
							line = undefined;
						} else {
							line = lineStyles[lineIdx - 1];
						}
					}

					if (state & changeStates.NEW_STYLES) {
						fillStyles = this._readFillStyles(s, withAlpha, morph);
						lineStyles = this._readLineStyles(s, withAlpha, morph, /*v2lineStyle=*/ v2edges);
						numFillBits = s.readUB(4);
						numLineBits = s.readUB(4);
						styleIdx += 1;
					}

					// Initialising new records
					records = [];
					shapes.push({
						records: records,
						leftFill: leftFill,
						rightFill: rightFill,
						lineIdx: lineIdx,
						leftFillIdx: leftFillIdx,
						rightFillIdx: rightFillIdx,
						styleIdx: styleIdx,
						line: line
					});

				} else {
					// No more records
					endOfShapeRecord = true;
				}
			}
		}
		s.align();

		return shapes;
	},

	_readFillStyles: function (s, withAlpha, morph) {
		var numStyles = s.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = s.readUI16(); }
		while (numStyles--) {
			var style = this._readFillStyle(s, withAlpha, morph);
			styles.push(style);
		}
		return styles;
	},

	_readFillStyle: function (s, withAlpha, morph) {
		var style,
			matrix,
			type = s.readUI8(),
			f = Base.fillStyleTypes;

		switch (type) {
		case f.SOLID:
			if (morph) { style = [s.readRGBA(), s.readRGBA()]; }
			else { style = withAlpha ? s.readRGBA() : s.readRGB(); }
			break;
		case f.FOCAL_RADIAL_GRADIENT:
		case f.LINEAR_GRADIENT:
		case f.RADIAL_GRADIENT:
			if (morph) { matrix = [nlizeMatrix(s.readMatrix()), nlizeMatrix(s.readMatrix())]; }
			else { matrix = nlizeMatrix(s.readMatrix()); }
			var stops = [];
			style = {
				type: type === f.LINEAR_GRADIENT ? 'linear' :
					(type === f.FOCAL_RADIAL_GRADIENT ? 'focal-radial' : 'radial'),
				matrix: matrix,
				spread: s.readUB(2),
				interpolation: s.readUB(2),
				stops: stops
			};
			var numStops = s.readUB(4);
			if (numStops === 0) throw new Error('Invalid NumGradients value: ' + numStops);
			//Disabling warning below since, despite was Adobe doc v19 says, the format is as we
			//implemented here. For sure the limit for morphs is not 8 but 15 just like for shapes.
			//if (morph && (style.spread!==0 || style.interpolation!==0))
			//	console.warn('Undocumented flags for morph FillStyle: ',style.spread,style.interpolation)
			while (numStops--) {
				var offset = s.readUI8() / 255,
					color = (withAlpha || morph) ? s.readRGBA() : s.readRGB();
				stops.push({
					offset: morph ? [offset, s.readUI8() / 255] : offset,
					color: morph ? [color, s.readRGBA()] : color
				});
			}
			if (type === f.FOCAL_RADIAL_GRADIENT) {
				style.focalPoint = morph ? [s.readFixed8(), s.readFixed8()] : s.readFixed8();
			}
			break;
		case f.REPEATING_BITMAP:
		case f.CLIPPED_BITMAP:
		case f.NON_SMOOTHED_CLIPPED_BITMAP:
		case f.NON_SMOOTHED_REPEATING_BITMAP:
			var imgId = s.readUI16();
			var img = imgId !== 65535 ? this._dictionary[imgId] : null; //null as placeholder for animations
			if (img === undefined) {
				img = 'id:' + imgId;
				console.warn(this.swfName + ': Image used but not found: ' + imgId);
				//throw new Error('Image not found: ID='+imgId);
			}
			matrix = morph ? [s.readMatrix(), s.readMatrix()] : s.readMatrix();
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

	_readLineStyles: function (s, withAlpha, morph, v2lineStyle) {
		if (v2lineStyle) return this._readLineStylesV2(s, morph);
		var numStyles = s.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = s.readUI16(); }
		while (numStyles--) {
			var style = {};
			if (morph) {
				var width0 = s.readUI16();
				var width1 = s.readUI16();
				style.width = [(width0 >= 2) ? width0 : 2, (width1 >= 2) ? width1 : 2];
			} else {
				var width = s.readUI16();
				style.width = (width >= 2) ? width : 2;
			}
			var color = morph ? [s.readRGBA(), s.readRGBA()] : (withAlpha ? s.readRGBA() : s.readRGB());
			style.color = color;
			styles.push(style);
		}
		return styles;
	},

	_readLineStylesV2: function (s, morph) {
		var numStyles = s.readUI8(),
			styles = [];
		if (0xff === numStyles) { numStyles = s.readUI16(); }
		while (numStyles--) {
			var style = {};
			if (morph) {
				var width0 = s.readUI16();
				var width1 = s.readUI16();
				style.width = [(width0 >= 2) ? width0 : 2, (width1 >= 2) ? width1 : 2];
			} else {
				var width = s.readUI16();
				style.width = (width >= 2) ? width : 2;
			}
			var capStart, join, capEnd;
			switch (s.readUB(2)) {
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
			switch (s.readUB(2)) {
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
			var hasFill = s.readUB(1);
			style.noHScale = s.readUB(1);
			style.noVScale = s.readUB(1);
			style.pixelHinting = s.readUB(1);
			var reserved = s.readUB(5);
			if (reserved !== 0) throw new Error('Invalid LineStyle flags: ' + reserved);
			style.noClose = s.readUB(1);
			switch (s.readUB(2)) {
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
			s.align();
			style.capStart = capStart;
			style.join = join;
			style.capEnd = capEnd;
			if (join === 'MITER') style.miterLimit = s.readFixed8();
			if (!hasFill) {
				style.color = morph ? [s.readRGBA(), s.readRGBA()] : s.readRGBA();
			} else {
				style.fill = this._readFillStyle(s, /*withAlpha=*/true, morph);
			}
			styles.push(style);
		}
		return styles;
	},

	_handlePlaceObject: function (s, offset, len, frm) {
		var objId = s.readUI16(),
			depth = s.readUI16();
		var character = {
				id: this._dictionary[objId].id,
				depth: depth,
				matrix: s.readMatrix()
			};
		if (s.offset - offset !== len) { character.cxform = s.readCxform(); }
		frm.displayList[depth] = character;
	},

	_handlePlaceObject2: function (s, offset, len, frm) {
		this._handlePlaceObject3(s, offset, len, frm, true);
	},

	_handlePlaceObject3: function (s, offset, len, frm, v2place) {
		//console.log('_handlePlaceObject3 ',offset,len,v2place)
		var t = this,
			f = Base.placeFlags,
			flags = s.readUI8(),
			flags2 = v2place ? 0 : s.readUI8(),
			depth = s.readUI16(),
			hasCharacter = flags & f.HAS_CHARACTER,
			hasImage = flags2 & f.HAS_IMAGE,
			className = ((flags2 & f.HAS_CLASS_NAME) || (hasImage && hasCharacter)) ?
				s.readString : undefined,
			character = {depth: depth};
		className = className; //not used
		if (hasCharacter) {
			var objId = s.readUI16();
			if (t._dictionary[objId]) {
				if (t._dictionary[objId].id !== objId)
					throw new Error('Unexpected error in PlaceObject'); //should not happen ever!
				character.id = t._dictionary[objId].id;
			} else {
				//if you see this, it usually means something
				//not handled has been skipped - or we are parsing in the wild...
				console.warn(this.swfName + ': Sprite includes missing object ' + objId);
			}
		}
		if (flags & f.HAS_MATRIX) { character.matrix = s.readMatrix(); }
		if (flags & f.HAS_CXFORM) { character.cxform = s.readCxformA(); }
		if (flags & f.HAS_RATIO) { character.ratio = s.readUI16(); }
		if (flags & f.HAS_NAME) { character.name = s.readString(); }
		if (flags & f.HAS_CLIP_DEPTH) { character.clipDepth = s.readUI16(); }
		if (flags2 & f.HAS_FILTER_LIST) { character.filters = t._readFilterList(s); }
		if (flags2 & f.HAS_BLEND_MODE) { character.blendMode = s.readUI8(); }
		if (flags2 & f.HAS_CACHE_AS_BITMAP) { character.bitmapCache = s.readUI8(); }
		if (flags2 & f.HAS_VISIBLE) {
			character.visible = s.readUI8();
			character.bgColor = s.readRGBA();
		}
		if (flags2 & f.HAS_OPAQUE_BACKGROUND) { character.opaqueBackground = true; }
		if (flags & f.HAS_CLIP_ACTIONS) { //NOT HANDLED; we should be OK
			t._skipEndOfTag('PlaceObject ClipActions', false, s, offset, len);
		}
		frm.displayList[depth] = character;
	},

	_handleRemoveObject2: function (s, offset, len, frm) {
		var depth = s.readUI16();
		frm.displayList[depth] = null;
	},

	_handleRemoveObject: function (s, offset, len, frm) {
		s.readUI16(); //ID
		var depth = s.readUI16();
		frm.displayList[depth] = null;
	},

	_handleDefineBitsLossless2: function (s, offset, len, frm) {
		this._handleDefineBitsLossless(s, offset, len, frm, true);
	},

	_handleDefineBitsLossless: function (s, offset, len, frm, withAlpha) {
		var id = s.readUI16(),
			format = s.readUI8(),
			img = {
				type: 'image',
				id: id,
				width: s.readUI16(),
				height: s.readUI16(),
				withAlpha: withAlpha || false
			};
		if (format === Base.bitmapFormats.COLORMAPPED) { img.colorTableSize = s.readUI8() + 1; }
		//console.log('image parsed :',img, Base.bitmapFormats.COLORMAPPED, 'format = ',format)
		img.colorData = s.readString(len - (s.offset - offset));
		this.ondata(img);
		this._dictionary[id] = img;
	},

	_handleDefineBitsJpeg3: function (s, offset, len, frm) {
		this._handleDefineBits(s, offset, len, frm, true);
	},

	_handleDefineBitsJpeg2: function (s, offset, len) {
		this._handleDefineBits(s, offset, len);
	},

	_handleDefineBits: function (s, offset, len, frm, withAlpha) {
		var id = s.readUI16(),
			img = {
				type: 'image',
				id: id,
				width: 0,
				height: 0
			},
			t = this,
			data,
			h = t._jpegTables;
		if (withAlpha) {
			var alphaDataOffset = s.readUI32();
			data = s.readString(alphaDataOffset);
			img.alphaData = s.readString(len - (s.offset - offset));
		} else {
			data = s.readString(len - 2);
		}
		for (var i = 0; data[i]; i++) {
			var word = ((data.charCodeAt(i) & 0xff) << 8) | (data.charCodeAt(++i) & 0xff);
			if (0xffd9 === word) {
				word = ((data.charCodeAt(++i) & 0xff) << 8) | (data.charCodeAt(++i) & 0xff);
				if (word === 0xffd8) {
					i++; //fix mentioned in https://github.com/tobeytailor/gordon/issues/4
					data = data.substr(0, i - 4) + data.substr(i);
					i -= 4;
				}
			} else if (0xffc0 === word) {
				i += 3;
				img.height = ((data.charCodeAt(++i) & 0xff) << 8) | (data.charCodeAt(++i) & 0xff);
				img.width = ((data.charCodeAt(++i) & 0xff) << 8) | (data.charCodeAt(++i) & 0xff);
				break;
			}
		}
		img.data = h ? h.substr(0, h.length - 2) + data.substr(2) : data;
		t.ondata(img);
		t._dictionary[id] = img;
	},

	_handleDefineButton2: function (s, offset, len, frm) {
		this._handleDefineButton(s, offset, len, frm, true);
	},

	_handleDefineButton: function (s, offset, len, frm, advanced) {
		var id = s.readUI16(),
			t = this,
			d = t._dictionary,
			states = {},
			button = {
				type: 'button',
				id: id,
				states: states,
				trackAsMenu: advanced ? s.readBool(8) : false
			};
		if (advanced) { s.seek(2); }
		while (true) {
			var flags = s.readUI8();
			if (!flags) break;
			var objId = s.readUI16(),
				depth = s.readUI16(),
				state = 0x01,
				character = {
					id: d[objId].id,
					depth: depth,
					matrix: s.readMatrix()
				};
			if (advanced) { character.cxform = s.readCxformA(); }
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
		t._skipEndOfTag('Button-action', true, s, offset, len);
		t.ondata(button);
		d[id] = button;
	},

	_handleDefineButtonCxform: function (s) {
		var t = this,
			d = t._dictionary,
			buttonId = s.readUI16(),
			button = d[buttonId];
		button.cxform = s.readCxform();
		t.ondata(button);
		d[buttonId] = button;
	},

	_handleJpegTables: function (s, offset, len) {
		this._jpegTables = s.readString(len);
	},

	_handleSetBackgroundColor: function (s, offset, len, frm) {
		frm.bgcolor = s.readRGB();
	},

	_handleDefineFont: function (s) {
		var id = s.readUI16(),
			numGlyphs = s.readUI16() / 2,
			glyphs = [],
			t = this,
			font = {
				type: 'font',
				id: id,
				glyphs: glyphs
			};
		s.seek(numGlyphs * 2 - 2);
		while (numGlyphs--) { glyphs.push(t._readGlyph(s)); }
		t.ondata(font);
		t._dictionary[id] = font;
	},

	_handleDefineFont2: function (s, offset, len) {
		offset = offset; //not used
		len = len; //not used
		var id = s.readUI16(),
			hasLayout = s.readBool(),
			glyphs = [],
			font = {
				type: 'font',
				id: id,
				glyphs: glyphs
			},
			codes = [],
			f = font.info = {
				isShiftJIS: s.readBool(),
				isSmall: s.readBool(),
				isANSI: s.readBool(),
				useWideOffsets: s.readBool(),
				isUTF8: s.readBool(),
				isItalic: s.readBool(),
				isBold: s.readBool(),
				languageCode: s.readLanguageCode(),
				name: s.readString(s.readUI8()),
				codes: codes
			},
			numGlyphs = s.readUI16(),
			i,
			w = f.useWideOffsets,
			offsets = [],
			tablesOffset = s.offset,
			u = f.isUTF8;
		i = numGlyphs;
		while (i--) { offsets.push(w ? s.readUI32() : s.readUI16()); }
		s.seek(w ? 4 : 2);
		i = 0;
		for (var o = offsets[0]; o; o = offsets[++i]) {
			s.seek(tablesOffset + o, true);
			glyphs.push(this._readGlyph(s));
		}
		i = numGlyphs;
		while (i--) { codes.push(u ? s.readUI16() : s.readUI8()); }
		if (hasLayout) {
			f.ascent = s.readUI16();
			f.descent = s.readUI16();
			f.leading = s.readUI16();
			var advanceTable = f.advanceTable = [],
				boundsTable = f.boundsTable = [],
				kerningTable = f.kerningTable = [];
			i = numGlyphs;
			while (i--) { advanceTable.push(s.readUI16()); }
			i = numGlyphs;
			while (i--) { boundsTable.push(s.readRect()); }
			var kerningCount = s.readUI16();
			while (kerningCount--) {
				kerningTable.push({
					code1: u ? s.readUI16() : s.readUI8(),
					code2: u ? s.readUI16() : s.readUI8(),
					adjustment: s.readUI16()
				});
			}
		}
		this.ondata(font);
		this._dictionary[id] = font;
	},

	_readGlyph: function (s) {
		var numFillBits = s.readUB(4);
		s.readUB(4); //numLineBits not used?
		var x = 0,
			y = 0,
			cmds = [],
			numBits, flags, type,
			c = Base.styleChangeStates;
		do {
			type = s.readUB(1);
			flags = null;
			if (type) {
				var isStraight = s.readBool();
				numBits = s.readUB(4) + 2;
				if (isStraight) {
					var isGeneral = s.readBool();
					if (isGeneral) {
						x += s.readSB(numBits);
						y += s.readSB(numBits);
						cmds.push('L' + x + ',' + y);
					} else {
						var isVertical = s.readBool();
						if (isVertical) {
							y += s.readSB(numBits);
							cmds.push('V' + y);
						} else {
							x += s.readSB(numBits);
							cmds.push('H' + x);
						}
					}
				} else {
					var cx = x + s.readSB(numBits),
						cy = y + s.readSB(numBits);
					x = cx + s.readSB(numBits);
					y = cy + s.readSB(numBits);
					cmds.push('Q' + cx + ',' + cy + ',' + x + ',' + y);
				}
			} else {
				flags = s.readUB(5);
				if (flags) {
					if (flags & c.MOVE_TO) {
						numBits = s.readUB(5);
						x = s.readSB(numBits);
						y = s.readSB(numBits);
						cmds.push('M' + x + ',' + y);
					}
					if (flags & c.LEFT_FILL_STYLE || flags & c.RIGHT_FILL_STYLE) { s.readUB(numFillBits); }
				}
			}
		}while (type || flags);
		s.align();
		return {commands: cmds.join('')};
	},

	_handleDefineFontInfo: function (s, offset, len) {
		offset = offset; //not used
		len = len; //not used
		var d = this._dictionary,
			fontId = s.readUI16(),
			font = d[fontId],
			codes = [],
			f = font.info = {
				name: s.readString(s.readUI8()),
				isSmall: s.readBool(3),
				isShiftJIS: s.readBool(),
				isANSI: s.readBool(),
				isItalic: s.readBool(),
				isBold: s.readBool(),
				codes: codes
			},
			u = f.isUTF8 = s.readBool(),
			i = font.glyphs.length;
		while (i--) { codes.push(u ? s.readUI16() : s.readUI8()); }
		this.ondata(font);
		d[fontId] = font;
	},

	_handleDefineText2: function (s, offset, len, frm) {
		this._handleDefineText(s, offset, len, frm, /*withAlpha=*/true);
	},

	_handleDefineText: function (s, offset, length, frm, withAlpha) {
		var id = s.readUI16(),
			strings = [],
			txt = {
				type: 'text',
				id: id,
				bounds: s.readRect(),
				matrix: s.readMatrix(),
				strings: strings
			},
			numGlyphBits = s.readUI8(),
			numAdvBits = s.readUI8(),
			fontId = null,
			fill = null,
			x = 0,
			y = 0,
			size = 0,
			str = null,
			d = this._dictionary;
		while (true) {
			var hdr = s.readUB(8);
			if (!hdr) break;
			var type = hdr >> 7;
			if (type) {
				var flags = hdr & 0x0f;
				if (flags) {
					var f = Base.textStyleFlags;
					if (flags & f.HAS_FONT) { fontId = s.readUI16(); }
					if (flags & f.HAS_COLOR) { fill = withAlpha ? s.readRGBA() : s.readRGB(); }
					if (flags & f.HAS_XOFFSET) { x = s.readSI16(); }
					if (flags & f.HAS_YOFFSET) { y = s.readSI16(); }
					if (flags & f.HAS_FONT) { size = s.readUI16(); }
				}
				if (fontId !== null && !d[fontId]) {
					console.warn(this.swfName + ': DefineText ' + id + ' uses ignored font ' + fontId);
				}
				str = {
					font: fontId,
					fill: fill,
					x: x,
					y: y,
					size: size,
					entries: []
				};
				strings.push(str);
			} else {
				var numGlyphs = hdr & 0x7f,
					entries = str.entries;
				while (numGlyphs--) {
					var index = s.readUB(numGlyphBits);
					var adv = s.readSB(numAdvBits);
					entries.push({
						index: index,
						advance: adv,
					});
					x += adv;
				}
				s.align();
			}
		}
		d[id] = txt;
		this.ondata(txt);
	},

	_readFilterList: function (s) {
		var numFilters = s.readUI8();
		var filters = [], filter, i;
		//console.log('NumFilters:',numFilters)
		while (numFilters--) {
			var filterId = s.readUI8();
			switch (filterId) {
			case 0: //DropShadowFilter
				filter = {
					type: 'drop shadow',
					dropShadowColor: s.readRGBA(),
					blurX: s.readFixed(),
					blurY: s.readFixed(),
					angle: s.readFixed(),
					distance: s.readFixed(),
					strength: s.readFixed8(),
					innerShadow: s.readUB(1),
					knockout: s.readUB(1),
					compositeSource: s.readUB(1),
					numPasses: s.readUB(5),
				};
				break;
			case 1: //BlurFilter
				filter = {
					type: 'blur',
					blurX: s.readFixed(),
					blurY: s.readFixed(),
					numPasses: s.readUB(5),
				};
				if (s.readUB(3) !== 0) throw new Error('Invalid blur filter');
				break;
			case 2: //GlowFilter
				filter = {
					type: 'glow',
					glowColor: s.readRGBA(),
					blurX: s.readFixed(),
					blurY: s.readFixed(),
					strength: s.readFixed8(),
					innerGlow: s.readUB(1),
					knockout: s.readUB(1),
					compositeSource: s.readUB(1),
					numPasses: s.readUB(5),
				};
				break;
			case 4: //GradientGlowFilter
				var numColors = s.readUI8();
				var gc = [], gr = [];
				for (i = numColors; i > 0; i--) gc.push(s.readRGBA());
				for (i = numColors; i > 0; i--) gr.push(s.readUI8());
				filter = {
					type: 'gradient glow',
					gradientColors: gc,
					gradientRatios: gr,
					blurX: s.readFixed(),
					blurY: s.readFixed(),
					angle: s.readFixed(),
					distance: s.readFixed(),
					strength: s.readFixed8(),
					innerShadow: s.readUB(1),
					knockout: s.readUB(1),
					compositeSource: s.readUB(1),
					onTop: s.readUB(1),
					numPasses: s.readUB(4),
				};
				break;
			case 6: //ColorMatrixFilter
				var m = [];
				for (i = 20; i > 0; i--) m.push(s.readFloat());
				filter = {
					type: 'color matrix',
					matrix: m
				};
				break;
			//not handled yet:
			case 3: //BevelFilter
			case 5: //ConvolutionFilter
			case 7: //GradientBevelFilter
				throw new Error('Unhandled filter: ' + filterId);
			default:
				throw new Error('Invalid filter code: ' + filterId);
			}
			filters.push(filter);
		}
		return filters;
	},

}; //end SwfParser.prototype

