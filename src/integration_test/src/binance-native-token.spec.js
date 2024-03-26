const assert = require('assert');
const TaskManager = require('../../lib/task_manager');
const worker = require('../../blockchains/eth/eth_worker');
const { nextIntervalCalculator } = require('../../blockchains/eth/lib/next_interval_calculator');


describe('BSC worker test', function () {
  it('BSC worker should extract blocks from 20000000 to 20000249 including', async function () {
    this.timeout(120000);
    const expectedData = require('../testdata/binance_native_token_block_20000000_to_20000999.json');

    // Make sure we've read the comparison data correctly
    assert(expectedData.length === 50735);

    const settings = {
      NODE_URL: 'https://binance.santiment.net',
      CONFIRMATIONS: 3,
      EXPORT_BLOCKS_LIST: false,
      BLOCK_INTERVAL: 50,
      RECEIPTS_API_METHOD: 'eth_getBlockReceipts',
      MAX_CONCURRENT_REQUESTS: 5,
      IS_ETH: 0,
    };
    const bscWorker = new worker.worker(settings);
    await bscWorker.init();
    const taskManager = await TaskManager.create(settings.MAX_CONCURRENT_REQUESTS);
    bscWorker.lastQueuedBlock = 19999999;

    const intervals = [];
    for (let i = 0; i < 5; ++i) {
      const interval = nextIntervalCalculator(
        bscWorker.lastQueuedBlock,
        bscWorker.lastConfirmedBlock,
        settings.BLOCK_INTERVAL);
      bscWorker.lastQueuedBlock = interval.toBlock;
      intervals.push(interval);
    }
    for (let i = 0; i < 5; ++i) {
      const metadata = {
        interval: intervals[i],
        lambda: (interval) => bscWorker.work(interval)
      };
      taskManager.pushToQueue(metadata);
    }

    let expectedDataPosition = 0;
    await taskManager.queue.onIdle();
    const events = taskManager.retrieveCompleted()[1];
    for (const event of events) {
      assert.deepEqual(event, expectedData[expectedDataPosition]);
      ++expectedDataPosition;
    }
  });
});
