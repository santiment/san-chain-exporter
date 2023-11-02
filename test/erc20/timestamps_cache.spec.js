const assert = require('assert');
const { TimestampsCache } = require('../../blockchains/erc20/lib/timestamps_cache');

class TimestampsCacheMock extends TimestampsCache {
  constructor(timestampToReturn) {
    super();
    this.timestampToReturn = timestampToReturn;
    this.countCalls = 0;
  }

  async getTimestampFromNode() {
    this.countCalls += 1;
    return this.timestampToReturn;
  }
}

describe('Test Timestamps cache', function () {
  it('test non existing block reach node', async function () {
    const timestampsCache = new TimestampsCacheMock(5);

    assert.equal(await timestampsCache.getBlockTimestamp(null, 1), 5);
    assert.equal(timestampsCache.countCalls, 1);
  });

  it('test existing block does not reach node', async function () {
    const timestampsCache = new TimestampsCacheMock(5);

    await timestampsCache.getBlockTimestamp(null, 1);
    assert.equal(await timestampsCache.getBlockTimestamp(null, 1), 5);
    assert.equal(timestampsCache.countCalls, 1);
  });

});
