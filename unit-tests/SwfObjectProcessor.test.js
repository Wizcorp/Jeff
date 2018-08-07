const expect = require('chai').expect;

const addClassNames = require('../src/SwfObjectProcessor/addClassNames');
const createSymbols = require('../src/SwfObjectProcessor/createSymbols');
const removeSymbols = require('../src/SwfObjectProcessor/removeSymbols');

describe('Add class names', function () {
    it('add one class name', function () {
        const symbols = [{}];

        const classNames = {
            test: [0]
        };

        const classNamesKeys = Object.keys(classNames);

        const result = addClassNames(symbols, classNames);

        expect(result[0]).to.exist;
        expect(result[0]).to.have.own.property('className');
        expect(result[0].className).to.eql(classNamesKeys[0]);
    });

    it('add no class', function () {
        const symbols = [];

        const classNames = {
            test: [0]
        };

        const result = addClassNames(symbols, classNames);

        expect(result).to.be.empty;
    });

    // Monkey test
    it('add two or more class name', function () {
        const min = 2;
        const max = 5;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;

        const symbols = [];

        const classNames = {
            test: []
        };

        for (let i = 0; i < random; i++) {
            symbols.push({});
            classNames.test.push(i);
        }

        const classNamesKeys = Object.keys(classNames);

        const result = addClassNames(symbols, classNames);

        for (let i = 0; i < random; i++) {
            expect(result[i]).to.exist;
            expect(result[i]).to.have.own.property('className');
            expect(result[i].className).to.eql(classNamesKeys[0]);
        }
    });
});

describe('Create Symbols', function () {
    it('create symbol from swf object of type \'main\'', function () {
        const id = 0;
        const frameCount = 1;

        const swfObjects = [{
            id: id,
            type: 'main',
            frameCount: frameCount
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isAnimation');
        expect(result[id].isAnimation).to.be.true;
        expect(result[id]).to.have.own.property('duration');
        expect(result[id].duration).to.eql(frameCount);
    });

    it('create symbol from swf object of type \'image\'', function () {
        const id = 0;
        const width = 120;
        const height = 120;

        const swfObjects = [{
            id: id,
            type: 'image',
            width: width,
            height: height
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isGraphic');
        expect(result[id].isGraphic).to.be.true;
        expect(result[id]).to.have.own.property('isImage');
        expect(result[id].isImage).to.be.true;
        expect(result[id]).to.have.own.property('maxDims');
        expect(result[id].maxDims).to.eql({});
        expect(result[id]).to.have.own.property('bounds');
        expect(result[id].bounds).to.eql([{
            left: 0,
            right: width,
            top: 0,
            bottom: height
        }]);
    });

    it('create symbol from swf object of type \'shape\'', function () {
        const id = 0;
        const imageID = 0;
        const length = 20;

        const swfObjects = [{
            id: id,
            type: 'shape',
            edges: [
                {
                    leftFill: {
                        type: 'pattern',
                        image: {
                            id: imageID
                        },
                        matrix: {
                            scaleX: length,
                            scaleY: length,
                            skewX: length,
                            skewY: length,
                            moveX: length,
                            moveY: length
                        }
                    },
                    records: []
                },
                {
                    rightFill: {
                        type: 'pattern',
                        image: {
                            id: imageID
                        },
                        matrix: {
                            scaleX: length,
                            scaleY: length,
                            skewX: length,
                            skewY: length,
                            moveX: length,
                            moveY: length
                        }
                    },
                    records: []
                },
                {
                    leftFill: {
                        type: 'non-pattern'
                    },
                    records: []
                },
                {
                    leftFill: {},
                    records: []
                },
                {
                    rightFill: {
                        type: 'non-pattern'
                    },
                    records: []
                },
                {
                    rightFill: {},
                    records: []
                }
            ],
            bounds: {
                left: length,
                right: length,
                top: length,
                bottom: length
            }
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isGraphic');
        expect(result[id].isGraphic).to.be.true;
        expect(result[id]).to.have.own.property('isShape');
        expect(result[id].isShape).to.be.true;
        expect(result[id]).to.have.own.property('maxDims');
        expect(result[id].maxDims).to.eql({});
        expect(result[id]).to.have.own.property('bounds');
        expect(result[id].bounds).to.eql([{
            left: length / 20,
            right: length / 20,
            top: length / 20,
            bottom: length / 20
        }]);
        expect(result[id]).to.have.own.property('images');
        expect(result[id].images).to.eql([{
            id: imageID,
            matrix: [
                length / 20,
                length / 20,
                length / 20,
                length / 20,
                length / 20,
                length / 20
            ],
            image: {
                id: imageID
            }
        }, {
            id: imageID,
            matrix: [
                length / 20,
                length / 20,
                length / 20,
                length / 20,
                length / 20,
                length / 20
            ],
            image: {
                id: imageID
            }
        }]);
    });

    it('create symbol from swf object of type \'shape\' with no edges', function () {
        const id = 0;
        const length = 20;

        const swfObjects = [{
            id: id,
            type: 'shape',
            edges: [],
            bounds: {
                left: length,
                right: length,
                top: length,
                bottom: length
            }
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('bounds');
        expect(result[id].bounds).to.eql([{
            left: length / 20,
            right: length / 20,
            top: length / 20,
            bottom: length / 20
        }]);
    });

    it('create symbol from swf object of type \'morph\'', function () {
        const id = 0;
        const startLength = 20;
        const endLength = 40;

        const swfObjects = [{
            id: id,
            type: 'morph',
            startBounds: {
                left: startLength,
                right: startLength,
                top: startLength,
                bottom: startLength
            },
            endBounds: {
                left: endLength,
                right: endLength,
                top: endLength,
                bottom: endLength
            }
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isGraphic');
        expect(result[id].isGraphic).to.be.true;
        expect(result[id]).to.have.own.property('isMorphing');
        expect(result[id].isMorphing).to.be.true;
        expect(result[id]).to.have.own.property('maxDims');
        expect(result[id].maxDims).to.eql({});
        expect(result[id]).to.have.own.property('bounds');
        expect(result[id].bounds).to.eql([{
            left: Math.min(startLength, endLength) / 20,
            right: Math.max(startLength, endLength) / 20,
            top: Math.min(startLength, endLength) / 20,
            bottom: Math.max(startLength, endLength) / 20
        }]);
    });

    it('create symbol from swf object of type \'sprite\'', function () {
        const id = 0;
        const frameCount = 1;
        const length = 20;

        const swfObjects = [{
            id: id,
            type: 'sprite',
            frameCount: frameCount,
            scalingGrid: {
                left: length,
                right: length,
                top: length,
                bottom: length
            }
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isAnimation');
        expect(result[id].isAnimation).to.be.true;
        expect(result[id]).to.have.own.property('duration');
        expect(result[id].duration).to.eql(frameCount);
        expect(result[id]).to.have.own.property('scalingGrid');
        expect(result[id].scalingGrid).to.eql({
            left: length / 20,
            right: length / 20,
            top: length / 20,
            bottom: length / 20
        });
    });

    it('create symbol from swf object of type \'sprite\' with no scalingGrid', function () {
        const id = 0;
        const frameCount = 1;

        const swfObjects = [{
            id: id,
            type: 'sprite',
            frameCount: frameCount
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.have.own.property('isAnimation');
        expect(result[id].isAnimation).to.be.true;
        expect(result[id]).to.have.own.property('duration');
        expect(result[id].duration).to.eql(frameCount);
    });

    it('create symbol from swf object of type \'font\'', function () {
        const id = 0;

        const swfObjects = [{
            id: id,
            type: 'font'
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.eql({
            id: id,
            swfObject: swfObjects[0],
            parents: {}
        });
    });

    it('create symbol from swf object of type \'text\'', function () {
        const id = 0;

        const swfObjects = [{
            id: id,
            type: 'text'
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.eql({
            id: id,
            swfObject: swfObjects[0],
            parents: {}
        });
    });

    it('create symbol from swf object of unknown type', function () {
        const id = 0;

        const swfObjects = [{
            id: id,
            type: 'null'
        }];

        const result = createSymbols(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.eql({
            id: id,
            swfObject: swfObjects[0],
            parents: {}
        });
    });
});

describe('Remove Symbols', function () {
    const symbols = [{
        className: 'test'
    }];

    const removeList = 'test';

    it('remove 1 symbol', function () {
        const classSymbols = [{
            children: [{
                id: 0
            }]
        }];

        removeSymbols(symbols, classSymbols, removeList);

        expect(classSymbols).to.be.eql([{
            children: []
        }]);
    });

    it('fail removing symbol because className doesn\'t exist in removeList', function () {
        const classSymbols = [{
            children: [{
                id: 0
            }]
        }];

        const emptyRemoveList = 'null';

        removeSymbols(symbols, classSymbols, emptyRemoveList);

        expect(classSymbols).to.be.eql([{
            children: [{
                id: 0
            }]
        }]);
    });

    it('fail removing symbol because removeList is null or empty', function () {
        const classSymbols = [{
            children: [{
                id: 0
            }]
        }];

        const emptyRemoveList = null;

        removeSymbols(symbols, classSymbols, emptyRemoveList);

        expect(classSymbols).to.be.eql([{
            children: [{
                id: 0
            }]
        }]);
    });

    it('fail removing symbol because symbols doesn\'t have className attribute', function () {
        const emptySymbols = [{
            empty: ''
        }];

        const classSymbols = [{
            children: [{
                id: 0
            }]
        }];

        removeSymbols(emptySymbols, classSymbols, removeList);

        expect(classSymbols).to.be.eql([{
            children: [{
                id: 0
            }]
        }]);
    });

    it('fail removing symbol because classSymbols doesn\'t have children attribute', function () {
        const emptyClassSymbols = [{
            empty: ''
        }];

        removeSymbols(symbols, emptyClassSymbols, removeList);

        expect(emptyClassSymbols).to.be.eql([{
            empty: ''
        }]);
    });

    it('fail removing symbol because classSymbols\' children doesn\'t have id attribute', function () {
        const classSymbols = [{
            children: [{
                empty: ''
            }]
        }];

        removeSymbols(symbols, classSymbols, removeList);

        expect(classSymbols).to.be.eql([{
            children: [{
                empty: ''
            }]
        }]);
    });
});