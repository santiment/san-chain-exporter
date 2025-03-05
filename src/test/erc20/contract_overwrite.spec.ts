/*jshint esversion: 6 */
import assert from 'assert';

import { decodeEvents } from '../../blockchains/erc20/lib/fetch_events';
import { ContractOverwrite, extractChangedContractAddresses, editAddressAndAmount } from '../../blockchains/erc20/lib/contract_overwrite';
import { readJsonFile } from '../../blockchains/erc20/lib/util';
import { TimestampsCacheInterface } from '../../blockchains/erc20/lib/timestamps_cache';
import path from "path";

const SNXContractLegacy = '0xc011a72400e58ecd99ee497cf89e3775d4bd732f';
const SNXContractNew = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';
const SNXContractReplacer = 'snx_contract';


const rawEventNotSNX = {
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  blockHash: '0x5df3aa774b85a9513d261cc5bd778725e3e0d0944da747dc2f245fecf1e58b63',
  blockNumber: 10449812n,
  data: '0x000000000000000000000000000000000000000000000000000000000623a7c0',
  logIndex: 122,
  removed: false,
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x0000000000000000000000005a5d5d0cde67e18f00e5d08ad7890858a6ee62bc',
    '0x000000000000000000000000d49e06c1ed4925af893a503bfcb9cff947e7679e'
  ],
  transactionHash: '0x0bdd08bd9af129373d2b8011775d3d8b0588e30f45b0f3c1b7d85d689d05c42b',
  transactionIndex: 101,
  transactionLogIndex: '0x0',
  type: 'mined',
  id: 'log_5bc3b124'
};

const rawEventSNXLegacy = {
  address: SNXContractLegacy,
  blockHash: '0x81c2b371f402764a916d34f8f6ef8c9d60123b1b3e67d2ceabfa45fdc55c45cb',
  blockNumber: 9785855n,
  data: '0x0000000000000000000000000000000000000000000000059dcdf2014551b400',
  logIndex: 70,
  removed: false,
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x00000000000000000000000020312e96b1a0568ac31c6630844a962383cc66c2',
    '0x000000000000000000000000e5379a734c4e6d505634ddefc3f9d0ff8d7bb171'
  ],
  transactionHash: '0xfe79891a2150c8acecf0789ef4a20310686651cf0edc2819da7e1e6305bae030',
  transactionIndex: 83,
  transactionLogIndex: '0x0',
  type: 'mined',
  id: 'log_d2b36f7f'
};

const rawEventSNXNew = {
  address: SNXContractNew,
  blockHash: '0x22f94f61168af2e451d9e6e55dda66eb2546c117becaf717a6564278cc0532aa',
  blockNumber: 10449853n,
  data: '0x0000000000000000000000000000000000000000000000621ecbc23581080000',
  logIndex: 158,
  removed: false,
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000ea5f6f8167a60f671cc02b074b6ac581153472c9',
    '0x0000000000000000000000003f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be'
  ],
  transactionHash: '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
  transactionIndex: 118,
  transactionLogIndex: '0x0',
  type: 'mined',
  id: 'log_b1dfdac6'
};

const decodedEventNotSNX = {
  'contract': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'blockNumber': 10449812,
  'timestamp': 0,
  'transactionHash': '0x0bdd08bd9af129373d2b8011775d3d8b0588e30f45b0f3c1b7d85d689d05c42b',
  'logIndex': 122,
  'to': '0xd49e06c1ed4925af893a503bfcb9cff947e7679e',
  'from': '0x5a5d5d0cde67e18f00e5d08ad7890858a6ee62bc',
  'value': 103000000,
  'valueExactBase36': '1pbnb4'
};

const decodedEventSNXLegacy = {
  'contract': SNXContractLegacy,
  'blockNumber': 9785855,
  'timestamp': 0,
  'transactionHash': '0xfe79891a2150c8acecf0789ef4a20310686651cf0edc2819da7e1e6305bae030',
  'logIndex': 70,
  'to': '0xe5379a734c4e6d505634ddefc3f9d0ff8d7bb171',
  'from': '0x20312e96b1a0568ac31c6630844a962383cc66c2',
  'value': 103604731090000000000,
  'valueExactBase36': 'lv51o1db8270g'
};

const correctedEventSNXLegacy = JSON.parse(JSON.stringify(decodedEventSNXLegacy));
correctedEventSNXLegacy.contract = SNXContractReplacer;

const decodedEventSNXNew = {
  'contract': SNXContractNew,
  'blockNumber': 10449853,
  'timestamp': 0,
  'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
  'logIndex': 158,
  'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
  'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
  'value': 1.81e+21,
  'valueExactBase36': 'alzj4rdbzkcq9s'
};

const correctedEventSNXNew = JSON.parse(JSON.stringify(decodedEventSNXNew));
correctedEventSNXNew.contract = SNXContractReplacer;

class TimestampsCacheMock implements TimestampsCacheInterface {
  getBlockTimestamp(): number {
    return 0;
  }

  waitResponse(): Promise<void> {
    return Promise.resolve();
  }
}

let contractsOverwriteArray: any = null;

async function singletonContractsOverwrite() {
  if (!contractsOverwriteArray) {
    const parsedContracts = await readJsonFile(path.join(__dirname, 'contract_mapping', 'contract_mapping.json'));
    contractsOverwriteArray = parsedContracts.modified_contracts.map((parsedContract: string) => new ContractOverwrite(parsedContract));
  }

  return contractsOverwriteArray;
}

describe('contract manipulations', function () {
  it('decode contract addresses', async function () {
    const decodedEvents = decodeEvents(
      [rawEventNotSNX,
        rawEventSNXLegacy,
        rawEventSNXNew
      ],
      new TimestampsCacheMock(),);

    assert.deepStrictEqual(
      decodedEvents,
      [decodedEventNotSNX, decodedEventSNXLegacy, decodedEventSNXNew]
    );
  });

  it('change contract addresses deep copy', async function () {
    const inputEvents = [decodedEventNotSNX, decodedEventSNXLegacy, decodedEventSNXNew];
    const editedEvents = extractChangedContractAddresses(inputEvents, await singletonContractsOverwrite());

    assert.deepStrictEqual(
      editedEvents,
      [correctedEventSNXLegacy, correctedEventSNXNew]
    );
  });

  it('change contract addresses shallow copy', async function () {
    const inputEvents = [decodedEventSNXLegacy, decodedEventSNXNew];
    const contractsOverwrite = new ContractOverwrite(
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
    );
    for (const event of inputEvents) {
      editAddressAndAmount(event, contractsOverwrite);
    }

    assert.deepStrictEqual(
      inputEvents,
      [correctedEventSNXLegacy, correctedEventSNXNew]
    );
  });

});
