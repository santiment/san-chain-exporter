/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')
const Web3 = require('web3')

const fetch_events = rewire("../lib/fetch_events")
const contract_overwrite = rewire("../lib/contract_overwrite")
const web3 = new Web3()

const USDCContractLegacy = '0x2c5dcd12141c56fbea08e95f54f12c8b22d492eb'
const LEGACY_USDC_DECIMAL_MULTIPLIER = Math.pow(10, -12)
const USDCContractNew = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDCContractReplacer = 'usdc_contract'


const rawEventNotUSDC = {
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  blockHash: '0x5df3aa774b85a9513d261cc5bd778725e3e0d0944da747dc2f245fecf1e58b63',
  blockNumber: 10449812,
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
}

const rawEventUSDCLegacy = {
  address: USDCContractLegacy,
  blockHash: '0x81c2b371f402764a916d34f8f6ef8c9d60123b1b3e67d2ceabfa45fdc55c45cb',
  blockNumber: 9785855,
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
}


const rawEventUSDCNew = {
  address: USDCContractNew,
  blockHash: '0x22f94f61168af2e451d9e6e55dda66eb2546c117becaf717a6564278cc0532aa',
  blockNumber: 10449853,
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
}


const decodedEventNotUSDC = {
  "contract": "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "blockNumber": 10449812,
  "timestamp": 0,
  "transactionHash": "0x0bdd08bd9af129373d2b8011775d3d8b0588e30f45b0f3c1b7d85d689d05c42b",
  "logIndex": 122,
  "to": "0xd49e06c1ed4925af893a503bfcb9cff947e7679e",
  "from": "0x5a5d5d0cde67e18f00e5d08ad7890858a6ee62bc",
  "value": 103000000,
  "valueExactBase36": "1pbnb4"
}

const decodedEventUSDCLegacy = {
  "contract": USDCContractReplacer,
  "blockNumber": 9785855,
  "timestamp": 0,
  "transactionHash": "0xfe79891a2150c8acecf0789ef4a20310686651cf0edc2819da7e1e6305bae030",
  "logIndex": 70,
  "to": "0xe5379a734c4e6d505634ddefc3f9d0ff8d7bb171",
  "from": "0x20312e96b1a0568ac31c6630844a962383cc66c2",
  "value": Math.floor(103604731090000000000 * LEGACY_USDC_DECIMAL_MULTIPLIER),
  "valueExactBase36": "1polx7"
}

const decodedEventUSDCNew = {
  "contract": USDCContractReplacer,
  "blockNumber": 10449853,
  "timestamp": 0,
  "transactionHash": "0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb",
  "logIndex": 158,
  "to": "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
  "from": "0xea5f6f8167a60f671cc02b074b6ac581153472c9",
  "value": 1.81e+21,
  "valueExactBase36": "alzj4rdbzkcq9s"
}

fetch_events.__set__("getBlockTimestamp", async function (web3, blockNumber) {
  return 0
})

fetch_events.__set__("getRawEvents", async function (web3, fromBlock, toBlock, contractAddresses) {
  let result = []
  for (const rawEvent of [rawEventNotUSDC, rawEventUSDCLegacy, rawEventUSDCNew]) {

    if (contractAddresses.includes(rawEvent.address)) {
      result.push(rawEvent);
    }
  }
  return result;
})

describe('snxContractsSwapping', function() {
  it("checks fixContractAddresses on different logs", async function() {
    const decodeEvents = fetch_events.__get__('decodeEvents')
    const decodedEvents = await decodeEvents(web3,
        [rawEventNotUSDC,
          rawEventUSDCLegacy,
          rawEventUSDCNew
        ])

    const fixContractAddresses = contract_overwrite.__get__('changeContractAddresses')
    console.log(decodedEvents);
    await fixContractAddresses(decodedEvents)

    assert.deepEqual(
      decodedEvents,
        [decodedEventNotUSDC, decodedEventUSDCLegacy, decodedEventUSDCNew]
    )
  })

  it("fetches, parses events and fixes contracts from the ethereum node", async function() {
    // This is needed so that we use the rewired dependency
    contract_overwrite.__set__('getPastEvents', fetch_events.__get__('getPastEvents'))

    const getPastEventsExactContracts = contract_overwrite.__get__('getPastEventsExactContracts')
    const result = await getPastEventsExactContracts(web3, 0, 0)
    assert.deepEqual(
        result,
        [decodedEventUSDCLegacy, decodedEventUSDCNew]
    )
  })
})
