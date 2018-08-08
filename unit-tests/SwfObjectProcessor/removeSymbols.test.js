const expect = require('chai').expect;

const removeSymbols = require('../../src/SwfObjectProcessor/removeSymbols');

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