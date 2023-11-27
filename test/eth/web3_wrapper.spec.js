const assert = require('assert');
const Web3Wrapper = require('../../blockchains/eth/lib/web3_wrapper');
const Web3 = require('web3');
const constants =  require('../../blockchains/eth/lib/constants');

describe('Web3Wrapper tests', function() {
    const web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    const web3Wrapper = new Web3Wrapper(web3);

    it('decode timestamp block', function() {
        // A block object as input. Stripped from all but the tested field.
        const block =  {
            timestamp: '0x5b1067c1'
        };

        const expectedResult = 1527801793;
        const result = web3Wrapper.decodeTimestampFromBlock(block);
        assert.strictEqual(expectedResult, result);
    });
});