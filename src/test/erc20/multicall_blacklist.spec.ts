const assert = require('assert');

import { MulticallBlacklist } from '../../blockchains/erc20/lib/multicall_blacklist';

const CONTRACT = '0xaa8a56638b9f91fffa3188693731a8fcbcf40a3b';

describe('MulticallBlacklist', function () {
  it('contract is blacklisted after enough consecutive contract-wide failures', function () {
    const blacklist = new MulticallBlacklist(3);

    blacklist.recordAllFailed(CONTRACT, 100);
    blacklist.recordAllFailed(CONTRACT, 101);
    assert.strictEqual(blacklist.isBlacklisted(CONTRACT), false);

    blacklist.recordAllFailed(CONTRACT, 102);
    assert.strictEqual(blacklist.isBlacklisted(CONTRACT), true);
  });

  it('a successful resolution resets the failure count', function () {
    const blacklist = new MulticallBlacklist(2);

    blacklist.recordAllFailed(CONTRACT, 100);
    blacklist.recordCleanResult(CONTRACT);
    blacklist.recordAllFailed(CONTRACT, 102);
    assert.strictEqual(blacklist.isBlacklisted(CONTRACT), false);

    blacklist.recordAllFailed(CONTRACT, 103);
    assert.strictEqual(blacklist.isBlacklisted(CONTRACT), true);
  });

  it('contracts are tracked independently', function () {
    const blacklist = new MulticallBlacklist(1);

    blacklist.recordAllFailed(CONTRACT, 100);
    assert.strictEqual(blacklist.isBlacklisted(CONTRACT), true);
    assert.strictEqual(blacklist.isBlacklisted('0xother'), false);
  });
});
