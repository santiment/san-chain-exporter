import assert from 'assert';
import path from 'path';
import { ERC20Worker } from '../../blockchains/erc20/erc20_worker';
import constants from '../../blockchains/erc20/lib/constants';
import { ContractOverwrite } from '../../blockchains/erc20/lib/contract_overwrite';
import helpers from './helpers';
import { ERC20Transfer } from '../../blockchains/erc20/erc20_types';
import Web3Wrapper from '../../blockchains/eth/lib/web3_wrapper';



class MockWeb3Wrapper extends Web3Wrapper {
    async getBlockNumber() {
        return 1;
    }

    parseNumberToHex() {
    }
}

class MockEthClient {
    request(): Promise<any> {
        return Promise.resolve()
    }

    requestBulk(): Promise<any> {
        return Promise.resolve()
    }

    generateRequest(): any {
        return null;
    }
}

describe('Test ERC20 worker', function () {
    let originalEvent: ERC20Transfer;
    let originalEvent2: ERC20Transfer;
    let originalEventWithPrimaryKey: ERC20Transfer;
    let correctedEvent: ERC20Transfer;
    let correctedEventWithPrimaryKey: ERC20Transfer;
    const CONTRACT_ORIGINAL = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';
    const NOT_OVERWRITTEN_CONTRACT = '0xd022b63ee8576fb46f5e1c5751ca3b9fe0af2a6f';
    const CONTRACT_REPLACE = 'snx_contract';

    beforeEach(function () {

        originalEvent = {
            'contract': CONTRACT_ORIGINAL,
            'blockNumber': 10449853,
            'timestamp': 0,
            'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
            'logIndex': 158,
            'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
            'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
            'value': 1.81e+21,
            'valueExactBase36': 'alzj4rdbzkcq9s'
        };

        originalEvent2 = {
            'contract': NOT_OVERWRITTEN_CONTRACT,
            'blockNumber': 10449854,
            'timestamp': 0,
            'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
            'logIndex': 200,
            'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
            'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
            'value': 1.81e+21,
            'valueExactBase36': 'alzj4rdbzkcq9s'
        };

        correctedEvent = JSON.parse(JSON.stringify(originalEvent));
        correctedEvent.contract = CONTRACT_REPLACE;

        originalEventWithPrimaryKey = JSON.parse(JSON.stringify(originalEvent));
        helpers.setExpectedEventPrimaryKey(originalEventWithPrimaryKey);

        correctedEventWithPrimaryKey = JSON.parse(JSON.stringify(correctedEvent));
        helpers.setExpectedEventPrimaryKey(correctedEventWithPrimaryKey);
    });

    it('test the events returned when in \'vanilla\' mode', async function () {
        // Overwrite variables and methods that the 'work' method would use internally.
        constants.CONTRACT_MODE = 'vanilla';
        const worker = new ERC20Worker(constants);
        worker.web3Wrapper = new MockWeb3Wrapper();
        worker.ethClient = new MockEthClient();
        worker.getPastEventsFun = async function () {
            return [originalEvent];
        };

        await worker.init(undefined);
        worker.lastConfirmedBlock = 1;
        worker.lastExportedBlock = 0;

        const result = await worker.work();

        assert.deepStrictEqual(result, [originalEventWithPrimaryKey]);
    });

    it('test the events returned when in \'extract_exact_overwrite\' mode', async function () {
        // Overwrite variables and methods that the 'work' method would use internally.
        constants.CONTRACT_MODE = 'extract_exact_overwrite';
        constants.CONTRACT_MAPPING_FILE_PATH = path.join(__dirname, 'contract_mapping', 'contract_mapping.json');

        const worker = new ERC20Worker(constants);
        worker.web3Wrapper = new MockWeb3Wrapper();
        worker.ethClient = new MockEthClient();
        worker.getPastEventsFun = async function () {
            return [originalEvent];
        };
        await worker.init(undefined);

        worker.contractsOverwriteArray = [];
        worker.contractsUnmodified = [];
        worker.contractsOverwriteArray.push(new ContractOverwrite(
            {
                'old_contracts': [
                    {
                        'address': '0xc011a72400e58ecd99ee497cf89e3775d4bd732f',
                        'multiplier': 1
                    },
                    {
                        'address': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
                        'multiplier': 1
                    }
                ],
                'new_address': 'snx_contract'
            }
        ));
        worker.lastConfirmedBlock = 1;
        worker.lastExportedBlock = 0;

        const result = await worker.work();

        assert.deepStrictEqual(result, [correctedEventWithPrimaryKey]);
    });

    it('test the events returned when in \'extract_all_append\' mode', async function () {
        // Overwrite variables and methods that the 'work' method would use internally.
        constants.CONTRACT_MODE = 'extract_all_append';
        constants.CONTRACT_MAPPING_FILE_PATH = path.join(__dirname, 'contract_mapping', 'contract_mapping.json');

        const worker = new ERC20Worker(constants);
        worker.web3Wrapper = new MockWeb3Wrapper();
        worker.ethClient = new MockEthClient();
        worker.getPastEventsFun = async function () {
            return [originalEvent];
        };
        await worker.init(undefined);

        worker.contractsOverwriteArray = [];
        worker.contractsOverwriteArray.push(new ContractOverwrite(
            {
                'old_contracts': [
                    {
                        'address': '0xc011a72400e58ecd99ee497cf89e3775d4bd732f',
                        'multiplier': 1
                    },
                    {
                        'address': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
                        'multiplier': 1
                    }
                ],
                'new_address': 'snx_contract'
            }
        ));
        worker.lastConfirmedBlock = 1;
        worker.lastExportedBlock = 0;

        // In this mode the primary key is 1 more than the 'original' event
        assert(correctedEventWithPrimaryKey.primaryKey !== undefined)
        correctedEventWithPrimaryKey.primaryKey += 1;
        const result = await worker.work();

        assert.deepStrictEqual(result, [originalEvent, correctedEventWithPrimaryKey]);
    });

    it('test multiple events returned when in \'extract_all_append\' mode', async function () {
        // Test that the overwritten event would be correctly ordered in between two original events
        constants.CONTRACT_MODE = 'extract_all_append';
        constants.CONTRACT_MAPPING_FILE_PATH = path.join(__dirname, 'contract_mapping', 'contract_mapping.json');

        const worker = new ERC20Worker(constants);
        worker.web3Wrapper = new MockWeb3Wrapper();
        worker.ethClient = new MockEthClient();
        worker.getPastEventsFun = async function () {
            return [originalEvent, originalEvent2];
        };
        await worker.init(undefined);

        worker.contractsOverwriteArray = [];
        worker.contractsOverwriteArray.push(new ContractOverwrite(
            {
                'old_contracts': [
                    {
                        'address': '0xc011a72400e58ecd99ee497cf89e3775d4bd732f',
                        'multiplier': 1
                    },
                    {
                        'address': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
                        'multiplier': 1
                    }
                ],
                'new_address': 'snx_contract'
            }
        ));
        worker.lastConfirmedBlock = 1;
        worker.lastExportedBlock = 0;

        // In this mode the primary key is 1 more than the 'original' event
        assert(correctedEventWithPrimaryKey.primaryKey !== undefined)
        correctedEventWithPrimaryKey.primaryKey += 1;
        const result = await worker.work();

        assert.deepStrictEqual(result, [originalEvent, correctedEventWithPrimaryKey, originalEvent2]);
    });

    it('test getBlocksListInterval when ZK position not defined', async function () {
        constants.EXPORT_BLOCKS_LIST = true;
        const worker = new ERC20Worker(constants);
        worker.blocksList = [[1, 10], [11, 20], [21, 30]];
        worker.lastExportedBlock = -1;

        const result = worker.getBlocksListInterval();

        assert.deepStrictEqual(result, { success: true, fromBlock: 1, toBlock: 10 });
        assert.deepStrictEqual(worker.blocksList, [[1, 10], [11, 20], [21, 30]]);
    });

    it('test getBlocksListInterval when ZK position is defined', async function () {
        constants.EXPORT_BLOCKS_LIST = true;
        const worker = new ERC20Worker(constants);
        worker.blocksList = [[1, 10], [11, 20], [21, 30]];
        worker.lastExportedBlock = 20;

        const result = worker.getBlocksListInterval();

        assert.deepStrictEqual(result, { success: true, fromBlock: 21, toBlock: 30 });
        assert.deepStrictEqual(worker.blocksList, [[21, 30]]);
    });

    it('test getBlocksListInterval new iteration', async function () {
        constants.EXPORT_BLOCKS_LIST = true;
        const worker = new ERC20Worker(constants);
        worker.blocksList = [[5, 10], [11, 20], [21, 30]];
        worker.lastExportedBlock = 10;

        const result = worker.getBlocksListInterval();

        assert.deepStrictEqual(result, { success: true, fromBlock: 11, toBlock: 20 });
        assert.deepStrictEqual(worker.blocksList, [[11, 20], [21, 30]]);
    });

    it('test getBlocksListInterval ZK defined, no more blocks', async function () {
        constants.EXPORT_BLOCKS_LIST = true;
        const worker = new ERC20Worker(constants);
        worker.blocksList = [[5, 10], [11, 20], [21, 30]];
        worker.lastExportedBlock = 30;

        const result = worker.getBlocksListInterval();

        assert.deepStrictEqual(result, { success: false });
        assert.deepStrictEqual(worker.blocksList, []);
    });

    it('test getBlocksListInterval new iteration, no more blocks', async function () {
        constants.EXPORT_BLOCKS_LIST = true;
        const worker = new ERC20Worker(constants);
        worker.blocksList = [[21, 30]];
        worker.lastExportedBlock = 30;

        const result = worker.getBlocksListInterval();

        assert.deepStrictEqual(result, { success: false });
        assert.deepStrictEqual(worker.blocksList, []);
    });

});
