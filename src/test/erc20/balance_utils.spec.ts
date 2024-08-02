const assert = require('assert');
const { breakNeededBalancesPerBatch } = require('../../blockchains/erc20/lib/balance_utils');

describe('test breakNeededBalancesPerBatch', function () {
  it('break correctly per batch size', async function () {

    const addresses = ['0x000001', '0x000002', '0x000003', '0x000004', '0x000005']
    const result = breakNeededBalancesPerBatch(addresses, 2)

    assert.deepStrictEqual(result, [['0x000001', '0x000002'], ['0x000003', '0x000004'], ['0x000005']])
  });

  it('small list does not need breaking', async function () {

    const addresses = ['0x000001', '0x000002']
    const result = breakNeededBalancesPerBatch(addresses, 3)

    assert.deepStrictEqual(result, [['0x000001', '0x000002']])
  });
});
