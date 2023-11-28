const assert = require('assert');
const constants = require('../../blockchains/eth/lib/constants');
const eth_worker = require('../../blockchains/eth/eth_worker');
const { nextIntervalCalculator } = require('../../blockchains/eth/lib/next_interval_calculator');


describe('Check interval not going backwards', function () {
  const mockWeb3 = { eth: {} };

  it('Fetched interval should not go backwards even if Node reports old block numbers', async function () {
    constants.BLOCK_INTERVAL = 50;
    constants.MAX_CONCURRENT_REQUESTS = 2;

    mockWeb3.eth.getBlockNumber = (function () { return 100; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;
    const firstCall = await nextIntervalCalculator(worker);

    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
    
    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [
      { fromBlock: 0, toBlock: 49},
      { fromBlock: 50, toBlock: 100 - constants.CONFIRMATIONS}
    ]);
    // Modify the last exported block as if we have consumed this interval
    worker.lastExportedBlock = secondCall[secondCall.length - 1].toBlock;
    
    mockWeb3.eth.getBlockNumber = (function () { return 90; });
    worker.web3 = mockWeb3;

    const thirdCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(thirdCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    const fourthCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(fourthCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });

  it('Fetched interval should not go backwards even if saved state is invalid', async function () {
    mockWeb3.eth.getBlockNumber = (function () { return 4; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;

    // Setup a situation where the exported block has exceeded the Node block
    // Test is similar to the above but test that we already saved an old lastConfirmedBlock
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 5;

    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });
});

describe('Check logic when Node is ahead', function () {
  const mockWeb3 = { eth: {} };

  it('Exporter should not wait for full BLOCK_INTERVAL to generate an interval', async function () {
    mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL - 1; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;

    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [{ fromBlock: 0, toBlock: constants.BLOCK_INTERVAL - 1 - constants.CONFIRMATIONS}]);
  });

  it('Exporter should not wait for full BLOCK_INTERVAL to generate multiple intervals', async function () {
    mockWeb3.eth.getBlockNumber = (function () { return 4 * constants.BLOCK_INTERVAL - 5; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;

    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    constants.MAX_CONCURRENT_REQUESTS = 4;

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [
      { fromBlock: 0, toBlock: constants.BLOCK_INTERVAL - 1 },
      { fromBlock: constants.BLOCK_INTERVAL, toBlock: 2 * constants.BLOCK_INTERVAL - 1 },
      { fromBlock: 2 * constants.BLOCK_INTERVAL, toBlock: 3 * constants.BLOCK_INTERVAL - 1},
      { fromBlock: 3 * constants.BLOCK_INTERVAL, toBlock: 4 * constants.BLOCK_INTERVAL - 5 - constants.CONFIRMATIONS }
    ]);
    constants.MAX_CONCURRENT_REQUESTS = 2;
  });

  it('Exporter would not exceed BLOCK_INTERVAL', async function () {
    mockWeb3.eth.getBlockNumber = (function () { return constants.CONFIRMATIONS + 10; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;

    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [
      { fromBlock: 0, toBlock: 10}]);
  });

  it('Interval is correct if Node is ahead, no sleep time', async function () {
    const worker = new eth_worker.worker();

    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 2;

    const result = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(result, [{ fromBlock: 2, toBlock: 2}]);
    assert.deepStrictEqual(worker.sleepTimeMsec, 0);
  });

  it('Node not called if Node is ahead', async function () {
    let nodeCalled = false;
    mockWeb3.eth.getBlockNumber = (function () { nodeCalled = true; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;

    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 2;

    await nextIntervalCalculator(worker);
    assert.deepStrictEqual(nodeCalled, false);
  });

  it('Block interval is not exceeded', async function () {
    const worker = new eth_worker.worker();

    worker.lastExportedBlock = 0;
    worker.lastConfirmedBlock = constants.BLOCK_INTERVAL + constants.CONFIRMATIONS + 10;
    constants.MAX_CONCURRENT_REQUESTS = 1;

    const result = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(result, [{ fromBlock: 1, toBlock: constants.BLOCK_INTERVAL }]);
  });
});

describe('Check logic when Node is not ahead', function () {
  const mockWeb3 = { eth: {} };

  it('Check interval is correct if Node is behind', async function () {
    const worker = new eth_worker.worker();
    mockWeb3.eth.getBlockNumber = (function () { return 10 + constants.CONFIRMATIONS; });
    worker.web3 = mockWeb3;

    worker.lastExportedBlock = 2;
    worker.lastConfirmedBlock = 1;

    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
    assert.deepStrictEqual(worker.lastConfirmedBlock, 10);

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [{ fromBlock: 3, toBlock: 10 }]);
  });

  it('Sleep time set if Node is not ahead', async function () {
    const worker = new eth_worker.worker();
    mockWeb3.eth.getBlockNumber = (function () { return constants.CONFIRMATIONS + 10; });
    worker.web3 = mockWeb3;

    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 1;

    await nextIntervalCalculator(worker);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
    assert.deepStrictEqual(worker.lastConfirmedBlock, 10);
  });

  it('Node gets called if Node is not ahead', async function () {
    let nodeCalled = false;
    mockWeb3.eth.getBlockNumber = (function () { nodeCalled = true; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;
  
    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 1;
  
    await nextIntervalCalculator(worker);
    assert.deepStrictEqual(nodeCalled, true);
  });

  it('Block interval is not exceeded', async function () {
    mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL + constants.CONFIRMATIONS + 10; });
    const worker = new eth_worker.worker();
    worker.web3 = mockWeb3;
  
    const firstCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(firstCall, []);
    assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    const secondCall = await nextIntervalCalculator(worker);
    assert.deepStrictEqual(secondCall, [{ fromBlock: 0, toBlock: constants.BLOCK_INTERVAL - 1 }]);
  });
});
