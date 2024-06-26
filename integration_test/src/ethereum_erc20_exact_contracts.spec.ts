import assert from 'assert';
import { ERC20Worker } from '../../src/blockchains/erc20/erc20_worker';
import { RPC_USERNAME, RPC_PASSWORD } from '../../src/lib/constants';


describe('ERC20 worker test', function () {
  it('ERC20 worker should extract blocks from 20000000 to 20000999 including', async function () {
    this.timeout(20000);
    const expectedData = require('../testdata/ethereum_exact_contracts_block_10000000_to_10000999.json');

    // Make sure we've read the comparison data correctly
    assert(expectedData.length === 3078);

    const settings = {
      NODE_URL: 'https://ethereum.santiment.net',
      CONFIRMATIONS: 3,
      EXPORT_BLOCKS_LIST: false,
      BLOCK_INTERVAL: 100,
      CONTRACT_MODE: 'extract_exact_overwrite',
      CONTRACT_MAPPING_FILE_PATH: './integration_test/conf/contract_mapping_ethereum.json',
      RPC_USERNAME: RPC_USERNAME,
      RPC_PASSWORD: RPC_PASSWORD
    };
    const erc20Worker = new ERC20Worker(settings);
    await erc20Worker.init();
    erc20Worker.lastExportedBlock = 9999999;

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
