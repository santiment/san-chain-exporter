const assert = require('assert');
const fetch_data = require('../../blockchains/eth/lib/fetch_data');

const testNullAction = require('./test_action_null.json');

describe('Test that when action is null parsing would not break', function () {
    it('Null action should not break parsing', function () {
        const result = fetch_data.parseEthInternalTrx(testNullAction);

        assert.deepStrictEqual(result, []);
    });
});
