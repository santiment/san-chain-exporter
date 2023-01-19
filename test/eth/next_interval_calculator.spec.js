const eth_worker = require('../../blockchains/eth/eth_worker');
const constants = require('../../blockchains/eth/lib/constants');
const { nextIntervalCalculator } = require('../../blockchains/eth/lib/next_interval_calculator');
const assert = require('assert');


describe('Check interval not going backwards', function () {
    const mockWeb3 = { eth: {} };

    it('Fetched interval should not go backwards even if Node reports old block numbers', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return 100; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;
        const result = await nextIntervalCalculator(worker);

        assert.deepStrictEqual(result.success, true);
        assert.deepStrictEqual(result.fromBlock, 0);
        assert.deepStrictEqual(result.toBlock, 100 - constants.CONFIRMATIONS);

        // Modify the last exported block as if we have consumed this interval
        worker.lastExportedBlock = result.toBlock;

        // Mock the Node to report an old number
        mockWeb3.eth.getBlockNumber = (function () { return 90; });
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

        const resultThird = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultThird.success, false);
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

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    });
});

describe('Check logic when Node is ahead', function () {
    const mockWeb3 = { eth: {} };

    it('Exporter should not wait for full BLOCK_INTERVAL', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL - 1; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, true);
        assert.deepStrictEqual(resultSecond.fromBlock, 0);
        assert.deepStrictEqual(resultSecond.toBlock, constants.BLOCK_INTERVAL - 1 - constants.CONFIRMATIONS);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
    });

    it('Exporter would not exceed BLOCK_INTERVAL', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return constants.CONFIRMATIONS + 10; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, true);
        assert.deepStrictEqual(resultSecond.fromBlock, 0);
        assert.deepStrictEqual(resultSecond.toBlock, 10);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
    });

    it('Interval is correct if Node is ahead', async function () {
        const worker = new eth_worker.worker();

        worker.lastExportedBlock = 1;
        worker.lastConfirmedBlock = 2;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, true);
        assert.deepStrictEqual(resultSecond.fromBlock, 2);
        assert.deepStrictEqual(resultSecond.toBlock, 2);
    });

    it('No sleep time if Node is ahead', async function () {
        const worker = new eth_worker.worker();

        worker.lastExportedBlock = 1;
        worker.lastConfirmedBlock = 2;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, true);
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

        worker.lastExportedBlock = 1;
        worker.lastConfirmedBlock = constants.BLOCK_INTERVAL + constants.CONFIRMATIONS + 10;

        const result = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(result.success, true);
        assert.deepStrictEqual(result.fromBlock, 2);
        assert.deepStrictEqual(result.toBlock, 1 + constants.BLOCK_INTERVAL);
    });

});

describe('Check logic when Node is not ahead', function () {
    const mockWeb3 = { eth: {} };

    it('Check interval is correct if Node is behind', async function () {
        const worker = new eth_worker.worker();
        mockWeb3.eth.getBlockNumber = (function () { return constants.CONFIRMATIONS + 10; });
        worker.web3 = mockWeb3;

        worker.lastExportedBlock = 2;
        worker.lastConfirmedBlock = 1;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, true);
        assert.deepStrictEqual(resultSecond.fromBlock, 3);
        assert.deepStrictEqual(resultSecond.toBlock, 10);
    });

    it('Sleep time set if Node is not ahead', async function () {
        const worker = new eth_worker.worker();
        mockWeb3.eth.getBlockNumber = (function () { return constants.CONFIRMATIONS + 10; });
        worker.web3 = mockWeb3;

        worker.lastExportedBlock = 1;
        worker.lastConfirmedBlock = 1;

        await nextIntervalCalculator(worker);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
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

        const result = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(result.success, true);
        assert.deepStrictEqual(result.fromBlock, 0);
        assert.deepStrictEqual(result.toBlock, constants.BLOCK_INTERVAL - 1);
    });

});

