import assert from 'assert';
import { ERC20Worker } from '../../src/blockchains/erc20/erc20_worker';
import { RPC_USERNAME, RPC_PASSWORD } from '../../src/lib/constants';


describe('Optimism worker test', function () {
  it('Optimism worker should extract blocks from 100000000 to 100000999 including', async function () {
    this.timeout(20000);
    const expectedData = require('../testdata/optimism_erc20_block_100000000_to_100000999.json');

    // Make sure we've read the comparison data correctly
    assert(expectedData.length === 1708);

    const settings = {
      NODE_URL: 'https://optimism.santiment.net',
      CONFIRMATIONS: 3,
      EXPORT_BLOCKS_LIST: false,
      BLOCK_INTERVAL: 100,
      CONTRACT_MODE: 'vanilla',
      RPC_USERNAME: RPC_USERNAME,
      RPC_PASSWORD: RPC_PASSWORD
    };
    const erc20Worker = new ERC20Worker(settings);
    await erc20Worker.init();
    erc20Worker.lastExportedBlock = 99999999;

    let expectedDataPosition = 0;
    for (let i = 0; i < 10; ++i) {
      const events = await erc20Worker.work();
      for (const event of events) {
        assert.deepEqual(event, expectedData[expectedDataPosition]);
        ++expectedDataPosition;
      }
    }


  });

});
