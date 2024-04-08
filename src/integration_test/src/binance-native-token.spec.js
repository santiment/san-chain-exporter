const {logger} = require('../../lib/logger');

const { Web3 } = require('web3');

const Web3Wrapper = require('../../blockchains/eth/lib/web3_wrapper');
const { constructRPCClient } = require('../../lib/http_client');

const assert = require('assert');
const TaskManager = require('../../lib/task_manager');
const worker = require('../../blockchains/eth/eth_worker');
const { nextIntervalCalculator } = require('../../blockchains/eth/lib/next_interval_calculator');


describe('BSC worker test', function () {

  it("trace_filter is not stable", async function() {
    let web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider('https://binance.santiment.net')));
    let fromBlock = 20000000
    let toBlock = fromBlock + 50
    let arr = [...Array(6).keys()] // range 0,1,2...
    let blocks_fetch = arr.map(iter => constructRPCClient('https://binance.santiment.net').request('trace_filter', [{
      fromBlock: web3Wrapper.parseNumberToHex(fromBlock + iter * 100),
      toBlock: web3Wrapper.parseNumberToHex(toBlock + iter * 100)
    }]).then((data) => {
      let blocks = new Set(data.result.map((element) => element.blockNumber))
      let blocksArr = [...blocks.keys()]
      logger.info(`${iter}, ${blocks.size} ${Math.min.apply(Math, blocksArr)} ${Math.max.apply(Math, blocksArr)}`)
      return blocks.size
    })
    )
    let result = await Promise.all(blocks_fetch)
    logger.info(result)    
    result.forEach(element => assert.equal(element, 51))
  }, 90000)

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
