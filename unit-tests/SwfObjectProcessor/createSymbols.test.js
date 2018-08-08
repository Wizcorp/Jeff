const expect = require('chai').expect;

const createSymbolsTest = require('../../src/SwfObjectProcessor/createSymbols');

describe('Create Symbols', function () {
    it('create symbol from swf object of type \'main\'', function () {
        const id = 0;
        const frameCount = 1;

        const swfObjects = [{
            id: id,
            type: 'main',
            frameCount: frameCount
        }];

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

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

        const result = createSymbolsTest(swfObjects);

        expect(result[id]).to.exist;
        expect(result[id]).to.eql({
            id: id,
            swfObject: swfObjects[0],
            parents: {}
        });
    });
});