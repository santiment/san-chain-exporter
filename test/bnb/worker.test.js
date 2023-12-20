/*jshint esversion: 6 */
const assert = require('assert');
const constants = require('../../blockchains/bnb/lib/constants');

const bnb_worker = require('../../blockchains/bnb/bnb_worker');

const END_INTERVAL = 1599699350979;
const BLOCK_HEIGHT = 112581035;
const INTERVAL_RANGE_MSEC = 1000;
/** The transaction summary as it is returned when fetching time intervals. */
const txWithoutChild1 = {
  'blockHeight': BLOCK_HEIGHT - 1,
  'code': 0,
  'confirmBlocks': 0,
  'fromAddr': 'bnb1lm7kn7e3uq6sev04qnqayhrl6g0s4gyms5753g',
  'hasChildren': 0,
  'log': 'Msg 0: ',
  'memo': '',
  'source': 0,
  'timeStamp': 1599699350972,
  'txAge': 392571,
  'txFee': 0.0,
  'txHash': 'DD766B5578FF55F069C600115B5344DA29513271022D24B86F72B8360C0650C3',
  'txType': 'CANCEL_ORDER'
};

const txWithoutChild2 = {
  'blockHeight': BLOCK_HEIGHT,
  'code': 0,
  'confirmBlocks': 0,
  'fromAddr': 'bnb1lm7kn7e3uq6sev04qnqayhrl6g0s4gyms5753g',
  'hasChildren': 0,
  'log': 'Msg 0: ',
  'memo': '',
  'source': 0,
  'timeStamp': 1599699350975,
  'txAge': 392571,
  'txFee': 0.0,
  'txHash': 'C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961',
  'txType': 'TRANSFER'
};

class MockTransactionsFetcher1 {
  /**
   * @override
   */
  async tryFetchTransactionsNextRange() {
    // It is important to match the order of how the API returns transactions - reverse order.
    return [txWithoutChild2, txWithoutChild1];
  }

  /**
   * @override
   */
  getIntervalFetchEnd() {
    return END_INTERVAL;
  }

  /**
   * @override
   */
  getMsecInFetchRange() {
    return INTERVAL_RANGE_MSEC;
  }
}

describe('workLoopSimpleTest', function () {
  it('Checking that position is being updated', async function () {
    const worker = new bnb_worker.worker(constants);
    worker.init();
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher1();

    await worker.work();
    const lastProcessedPosition = worker.getLastProcessedPosition();

    assert.deepEqual(
      lastProcessedPosition,
      {
        timestampReached: END_INTERVAL,
        blockNumber: BLOCK_HEIGHT,
        fetchRangeMsec: INTERVAL_RANGE_MSEC
      }
    );

  });

  it('Checking that two transactions without children are passing through the work loop without modifications', async function () {
    const worker = new bnb_worker.worker(constants);
    worker.init();
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher1();

    const result = await worker.work();
    assert.deepEqual(
      result,
      [txWithoutChild1, txWithoutChild2]);
  });
});

class MockTransactionsFetcher2 {
  async tryFetchTransactionsNextRange() {
    // It is important to match the order of how the API returns transactions - reverse order.
    return [txWithoutChild2, txWithoutChild1, txWithoutChild1];
  }
}
describe('workLoopRepeatedTest', function () {
  it('Checking that a repeated transaction would be removed', async function () {
    const worker = new bnb_worker.worker(constants);
    worker.init();
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher2();

    const result = await worker.work();

    assert.deepEqual(
      result,
      [txWithoutChild1, txWithoutChild2]);
  });
});

class MockTransactionsFetcher3 {
  constructor() {
    this.isUpToDateWithBlockchain = true;
  }

  async tryFetchTransactionsNextRange() {
    // It is important to match the order of how the API returns transactions - reverse order.
    return [];
  }
}

describe('workLoopRepeatedTest', function () {
  it('Checking that correct sleep timeout is set', async function () {
    const worker = new bnb_worker.worker(constants);
    worker.init();
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher3();

    await worker.work();

    assert.deepEqual(
      worker.sleepTimeMsec,
      1000 * constants.LOOP_INTERVAL_CURRENT_MODE_SEC);
  });
});

describe('checkBNBWorkersSetsInitRange', function () {
  it('Checking no previous data would set historic', async function () {
    const worker = new bnb_worker.worker(constants);
    const lastPosition = worker.initPosition();

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC);

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      worker.bnbTransactionsFetcher.getMsecInFetchRange()
    );
  });

  it('Checking small range would be extended to \'current\'', async function () {
    const worker = new bnb_worker.worker(constants);
    const lastPosition = worker.initPosition({ fetchRangeMsec: 1 });

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      constants.FETCH_INTERVAL_CURRENT_MODE_MSEC
    );

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      worker.bnbTransactionsFetcher.getMsecInFetchRange()
    );
  });

  it('Checking value bigger than \'current\' would be preserved', async function () {
    const worker = new bnb_worker.worker(constants);
    const lastPosition = worker.initPosition({ fetchRangeMsec: constants.FETCH_INTERVAL_CURRENT_MODE_MSEC + 1 });

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      constants.FETCH_INTERVAL_CURRENT_MODE_MSEC + 1
    );

    assert.strictEqual(
      lastPosition.fetchRangeMsec,
      worker.bnbTransactionsFetcher.getMsecInFetchRange()
    );
  });
});
