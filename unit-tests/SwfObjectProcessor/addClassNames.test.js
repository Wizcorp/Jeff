const expect = require('chai').expect;

const addClassNames = require('../../src/SwfObjectProcessor/addClassNames');

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
});