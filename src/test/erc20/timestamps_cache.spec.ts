import assert from 'assert';
import { HTTPClientInterface } from '../../types'
import { TimestampsCache } from '../../blockchains/erc20/lib/timestamps_cache';


const blockResponses = [
  {
    jsonrpc: '2.0',
    id: 0,
    result: {
      hash: '0xdc2d938e4cd0a149681e9e04352953ef5ab399d59bcd5b0357f6c0797470a524',
      number: '0x2710',
      parentHash: '0xb9ecd2df84ee2687efc0886f5177f6674bad9aeb73de9323e254e15c5a34fc93',
      timestamp: '0x55bb3ea3',
      transactions: []
    }
  },
  {
    jsonrpc: '2.0',
    'id': 1,
    result: {
      hash: '0x7e86236e83a62e7b04d09561e9e98822f353333f16ba57497ab61d8f7f9f93ab',
      number: '0x2711',
      parentHash: '0xdc2d938e4cd0a149681e9e04352953ef5ab399d59bcd5b0357f6c0797470a524',
      timestamp: '0x55bb3eaf',
      transactions: []
    }
  }
];

class EthClientMock implements HTTPClientInterface {
  request(): Promise<any> {
    return Promise.resolve(blockResponses);
  }

  requestBulk(): Promise<any> {
    return this.request();
  }

  generateRequest(): any {
    return null;
  }
}


class TimestampsCacheMock extends TimestampsCache {
  constructor() {
    super(new EthClientMock(), 10000, 10001);
  }
}


describe('Test Timestamps cache', function () {
  it('test block response fills cache', async function () {
    const timestampsCache = new TimestampsCacheMock();
    await timestampsCache.waitResponse();

    assert.equal(timestampsCache.getBlockTimestamp(10000), 1438334627);
    assert.equal(timestampsCache.getBlockTimestamp(10001), 1438334639);
  });

  it('test incorrectly filled cache would throw', async function () {
    const timestampsCache = new TimestampsCacheMock();
    timestampsCache.waitResponse();

    assert.throws(function () { timestampsCache.getBlockTimestamp(10002); }, Error);
  });
});
