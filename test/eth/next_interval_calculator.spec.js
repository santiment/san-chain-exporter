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

        // Modify the last exported block as we have consumed this interval
        worker.lastExportedBlock = result.toBlock;

        // Mock the Node to report an old number
        mockWeb3.eth.getBlockNumber = (function () { return 90; });
        worker.web3 = mockWeb3;

        const resultSecond = await nextIntervalCalculator(worker);
        assert.deepStrictEqual(resultSecond.success, false);

    });
});