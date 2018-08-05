const expect = require('chai').expect;

const addClassNames = require('../src/SwfObjectProcessor/addClassNames');

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

    it('add two or more class name', function () {
        const min = 2;
        const max = 5;
        const random = Math.floor(Math.random() * (max - min + 1)) + min;

        const symbols = [];

        const classNames = {
            test: []
        };

        for(let i = 0; i < random; i++) {
            symbols.push({});
            classNames.test.push(i);
        }

        const classNamesKeys = Object.keys(classNames);

        const result = addClassNames(symbols, classNames);

        for(let i = 0; i < random; i++) {
            expect(result[i]).to.exist;
            expect(result[i]).to.have.own.property('className');
            expect(result[i].className).to.eql(classNamesKeys[0]);
        }
    });
});