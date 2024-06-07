import assert from 'assert';
import { MaticWorker } from '../../src/blockchains/matic/matic_worker';
import { RPC_USERNAME, RPC_PASSWORD } from '../../src/lib/constants';


describe('Matic worker test', function () {
  it('Matic worker should extract blocks from 50000000 to 50000200 including', async function () {
    this.timeout(30000);
    const expectedData = require('../testdata/matic_block_50000000_to_50000200.json');

    // Make sure we've read the comparison data correctly
    assert(expectedData.length === 6965);

    const settings = {
      NODE_URL: 'https://polygon.santiment.net',
      CONFIRMATIONS: 3,
      EXPORT_BLOCKS_LIST: false,
      BLOCK_INTERVAL: 50,
      RPC_USERNAME: RPC_USERNAME,
      RPC_PASSWORD: RPC_PASSWORD
    };
    const maticWorker = new MaticWorker(settings);
    await maticWorker.init();
    maticWorker.lastExportedBlock = 49999999;

    let expectedDataPosition = 0;
    for (let i = 0; i < 4; ++i) {
      const events = await maticWorker.work();
      for (const event of events) {
        assert.deepEqual(event, expectedData[expectedDataPosition]);
        ++expectedDataPosition;
      }
    }


  });

});
