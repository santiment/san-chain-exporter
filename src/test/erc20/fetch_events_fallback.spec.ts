import assert from 'assert';
const rewire = require('rewire');

const fetch_events = rewire('../../blockchains/erc20/lib/fetch_events');
const getRawEvents = fetch_events.__get__('getRawEvents');

const TOO_MANY_LOGS_ERROR = 'Returned error: query returns too many logs, narrow your filter: 20000';

function makeLog(blockNumber: number, logIndex: number, address = '0x1111111111111111111111111111111111111111') {
  return {
    address,
    blockNumber,
    logIndex,
    data: '0x0',
    topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']
  };
}

// A node mock where the block `hugeBlock` has too many logs to be served by eth_getLogs
// and has to be fetched through eth_getBlockReceipts instead.
class Web3WrapperMock {
  hugeBlock: number;
  receipts: any[];
  getPastLogsCalls: Array<[number, number]> = [];
  getBlockReceiptsCalls: number[] = [];

  constructor(hugeBlock: number, receipts: any[]) {
    this.hugeBlock = hugeBlock;
    this.receipts = receipts;
  }

  async getPastLogs(queryObject: any): Promise<any> {
    const fromBlock = parseInt(queryObject.fromBlock, 16);
    const toBlock = parseInt(queryObject.toBlock, 16);
    this.getPastLogsCalls.push([fromBlock, toBlock]);

    if (fromBlock <= this.hugeBlock && this.hugeBlock <= toBlock) {
      throw new Error(TOO_MANY_LOGS_ERROR);
    }

    const result = [];
    for (let block = fromBlock; block <= toBlock; block++) {
      result.push(makeLog(block, 0));
    }
    return result;
  }

  async getBlockReceipts(blockNumber: number): Promise<any[]> {
    this.getBlockReceiptsCalls.push(blockNumber);
    return this.receipts;
  }
}

describe('getRawEvents fallback on too many logs', function () {
  it('splits the interval and fetches the oversized block through receipts', async function () {
    const receiptsLogs = [makeLog(104, 0), makeLog(104, 1), makeLog(104, 2)];
    const web3Wrapper = new Web3WrapperMock(104, [
      { logs: [receiptsLogs[0], receiptsLogs[1]] },
      { logs: [receiptsLogs[2]] }
    ]);

    const result = await getRawEvents(web3Wrapper, 100, 107, null);

    const expected = [
      makeLog(100, 0), makeLog(101, 0), makeLog(102, 0), makeLog(103, 0),
      ...receiptsLogs,
      makeLog(105, 0), makeLog(106, 0), makeLog(107, 0)
    ];
    assert.deepStrictEqual(result, expected);
    assert.deepStrictEqual(web3Wrapper.getBlockReceiptsCalls, [104]);
  });

  it('falls back to receipts when a single-block interval is oversized', async function () {
    const web3Wrapper = new Web3WrapperMock(104, [{ logs: [makeLog(104, 0)] }]);

    const result = await getRawEvents(web3Wrapper, 104, 104, null);

    assert.deepStrictEqual(result, [makeLog(104, 0)]);
    assert.deepStrictEqual(web3Wrapper.getPastLogsCalls, [[104, 104]]);
    assert.deepStrictEqual(web3Wrapper.getBlockReceiptsCalls, [104]);
  });

  it('filters receipts logs by contract address on the fallback path', async function () {
    const trackedLog = makeLog(104, 0, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const otherLog = makeLog(104, 1, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const web3Wrapper = new Web3WrapperMock(104, [{ logs: [trackedLog, otherLog] }]);

    const result = await getRawEvents(web3Wrapper, 104, 104,
      '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

    assert.deepStrictEqual(result, [trackedLog]);
  });

  it('rethrows errors which are not about the logs limit', async function () {
    const web3Wrapper = new Web3WrapperMock(104, []);
    web3Wrapper.getPastLogs = async () => { throw new Error('connection refused'); };

    await assert.rejects(
      () => getRawEvents(web3Wrapper, 100, 107, null),
      /connection refused/
    );
    assert.deepStrictEqual(web3Wrapper.getBlockReceiptsCalls, []);
  });
});
