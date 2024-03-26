const assert = require('assert');
const worker = require('../../blockchains/eth/eth_worker');


describe('ETH worker test', function () {
  it('BEP20 worker should extract blocks from 20000000 to 20000999 including', async function () {
    this.timeout(20000);
    const expectedData = require('../testdata/binance_native_token_block_20000000_to_20000999.json');

    // Make sure we've read the comparison data correctly
    assert(expectedData.length === 15062);

    const settings = {
      NODE_URL: 'https://binance.santiment.net',
      CONFIRMATIONS: 3,
      EXPORT_BLOCKS_LIST: false,
      BLOCK_INTERVAL: 200,
      RECEIPTS_API_METHOD: 'eth_getBlockReceipts'
    };
    const bep20Worker = new worker.worker(settings);
    await bep20Worker.init();
    bep20Worker.lastExportedBlock = 19999999;

    let expectedDataPosition = 0;
    for (let i = 0; i < 5; ++i) {
      const events = await bep20Worker.work();
      for (const event of events) {
        assert.deepEqual(event, expectedData[expectedDataPosition]);
        ++expectedDataPosition;
      }
    }
  });
});
