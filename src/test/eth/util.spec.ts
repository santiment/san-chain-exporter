import { expect } from 'earl';
const rewire = require('rewire');
const util = rewire('../../blockchains/eth/lib/util');

describe('utils', () => {
    it('should sort by block and log position', () => {
        let result = [{
            block: 1,
            logPosition: 2
        }, {
            block: 1,
            logPosition: 3
        },
        {
            block: 2,
            logPosition: 3
        }
        ]
        util.stableSort(result, util.transactionOrder)
        expect(result[0].block).toEqual(1);
        expect(result[0].logPosition).toEqual(2);
    })
})