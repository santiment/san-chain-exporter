const eth_worker = require('../../blockchains/eth/eth_worker');
const constants = require('../../blockchains/eth/lib/constants');
const { nextIntervalCalculator } = require('../../blockchains/eth/lib/next_interval_calculator');
const assert = require('assert');



describe('Check interval not going backwards', function () {
    const mockWeb3 = { eth: {} };

    it('Fetched interval should not go backwards even if Node reports old block numbers', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL + constants.CONFIRMATIONS; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;
        const result = await nextIntervalCalculator(worker);

        assert.deepStrictEqual(result.success, true);
        assert.deepStrictEqual(result.fromBlock, 0);
        assert.deepStrictEqual(result.toBlock, constants.BLOCK_INTERVAL - 1);

        // Modify the last exported block as if we have consumed this interval
        worker.lastExportedBlock = result.toBlock;

        // Mock the Node to report an old number
        mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL - 1; });
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

        const resultThird = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultThird.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    });

    it('Fetched interval should not go backwards even if Node reports old block numbers', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL + constants.CONFIRMATIONS; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;

        // Setup a situation where the exported block has exceeded the Node block
        worker.lastExportedBlock = 10;
        worker.lastConfirmedBlock = 5;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    });

    it('Exporter should wait for full BLOCK_INTERVAL even if Node has some progress', async function () {
        mockWeb3.eth.getBlockNumber = (function () { return constants.BLOCK_INTERVAL - 1; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    });

    it('Node should be asked for latest block while we are waiting for BLOCK_INTERVAL of new blocks', async function () {
        let nodeAskedCount = 0;
        mockWeb3.eth.getBlockNumber = (function () { nodeAskedCount += 1; });
        const worker = new eth_worker.worker();
        worker.web3 = mockWeb3;

        // Last confirmed block is bigger than last exported one, however the difference is less than BLOCK_INTERVAL
        worker.lastExportedBlock = 5;
        worker.lastConfirmedBlock = 6;

        const resultSecond = await nextIntervalCalculator(worker);

        assert.deepStrictEqual(nodeAskedCount, 1);
        assert.deepStrictEqual(resultSecond.success, false);
        assert.deepStrictEqual(worker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);

    });
});