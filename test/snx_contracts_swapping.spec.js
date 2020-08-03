/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')
const Web3 = require('web3')

const fetch_events = rewire("../lib/fetch_events")
const web3 = new Web3()

const SNXContractLegacy = '0xc011a72400e58ecd99ee497cf89e3775d4bd732f'
const SNXContractNew = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f'
const SNXContractReplacer = 'snx_contract'
const sUSDContractLegacy = '0x57ab1e02fee23774580c119740129eac7081e9d3'
const sUSDContractNew = '0x57ab1ec28d129707052df4df418d58a2d46d5f51'
const sUSDContractReplacer = 'susd_contract'

const rawEventNotSNX = {
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

const rawEventSNXLegacy = {
  address: SNXContractLegacy,
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

const rawEventSNXNew = {
  address: SNXContractNew,
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

const rawEventSUSDLegacy = {
  address: sUSDContractLegacy,
  blockHash: '0x786ba1a27c47213b5ff2f954d36017c40ea32130a7c4d04711fa9ed44dbdbf6c',
  blockNumber: 9153186,
  data: '0x000000000000000000000000000000000000000000000001384232e1bf071e4c',
  logIndex: 58,
  removed: false,
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000e4221d3907bb0f2a9498d5193bc99d1cf693183d',
    '0x000000000000000000000000787f7461546452c1423022e532b2422c22ca3393'
  ],
  transactionHash: '0x703945f9d518d02b47f7afdebe81532880d30d519081cce82f99fc6e1464156f',
  transactionIndex: 69,
  transactionLogIndex: '0x0',
  type: 'mined',
  id: 'log_bf353493'

}

const rawEventSUSDNew = {
  address: sUSDContractNew,
  blockHash: '0xc3b918836ab21bb9e1ac435d080861bc63c0024674bb13c07a4c1c8b0be0752d',
  blockNumber: 10450283,
  data: '0x0000000000000000000000000000000000000000000000000000000000000007',
  logIndex: 108,
  removed: false,
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x0000000000000000000000009f6aef5abe4f5963f3c0919814f0e691a1d6de6d',
    '0x000000000000000000000000c00ac4de5bbe235135e67ba58bde41d4d863f6b8'
  ],
  transactionHash: '0x4a7ba2f0053dfdcd7e6025592e9e8bb3f861d9f34042b9e064d28d18fde6c174',
  transactionIndex: 116,
  transactionLogIndex: '0x0',
  type: 'mined',
  id: 'log_5c12b168'

}

const decodedEventNotSNX = {
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

const decodedEventSNXLegacy = {
  "contract": SNXContractReplacer,
  "blockNumber": 9785855,
  "timestamp": 0,
  "transactionHash": "0xfe79891a2150c8acecf0789ef4a20310686651cf0edc2819da7e1e6305bae030",
  "logIndex": 70,
  "to": "0xe5379a734c4e6d505634ddefc3f9d0ff8d7bb171",
  "from": "0x20312e96b1a0568ac31c6630844a962383cc66c2",
  "value": 103604731090000000000,
  "valueExactBase36": "lv51o1db8270g"
}

const decodedEventSNXNew = {
  "contract": SNXContractReplacer,
  "blockNumber": 10449853,
  "timestamp": 0,
  "transactionHash": "0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb",
  "logIndex": 158,
  "to": "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
  "from": "0xea5f6f8167a60f671cc02b074b6ac581153472c9",
  "value": 1.81e+21,
  "valueExactBase36": "alzj4rdbzkcq9s"
}

const decodedEventSUSDLegacy = {
  "contract": sUSDContractReplacer,
  "blockNumber": 9153186,
  "timestamp": 0,
  "transactionHash": "0x703945f9d518d02b47f7afdebe81532880d30d519081cce82f99fc6e1464156f",
  "logIndex": 58,
  "to": "0x787f7461546452c1423022e532b2422c22ca3393",
  "from": "0xe4221d3907bb0f2a9498d5193bc99d1cf693183d",
  "value": 22500602633450365000,
  "valueExactBase36": "4qy5xyexo6c0c"
}

const decodedEventSUSDNew = {
  "contract": sUSDContractReplacer,
  "blockNumber": 10450283,
  "timestamp": 0,
  "transactionHash": "0x4a7ba2f0053dfdcd7e6025592e9e8bb3f861d9f34042b9e064d28d18fde6c174",
  "logIndex": 108,
  "to": "0xc00ac4de5bbe235135e67ba58bde41d4d863f6b8",
  "from": "0x9f6aef5abe4f5963f3c0919814f0e691a1d6de6d",
  "value": 7,
  "valueExactBase36": "7"
}

fetch_events.__set__("getBlockTimestamp", async function (web3, blockNumber) {
  return 0
})

fetch_events.__set__("getRawEvents", async function (web3, fromBlock, toBlock, contractAddresses) {
  let result = []
  for (const rawEvent of [rawEventNotSNX, rawEventSNXLegacy, rawEventSNXNew, rawEventSUSDLegacy, rawEventSUSDNew]) {

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
        [rawEventNotSNX,
          rawEventSNXLegacy,
          rawEventSNXNew,
          rawEventSUSDLegacy,
          rawEventSUSDNew
        ])

    const fixContractAddresses = fetch_events.__get__('changeContractAddresses')
    await fixContractAddresses(decodedEvents, [SNXContractLegacy, SNXContractNew], SNXContractReplacer)
    await fixContractAddresses(decodedEvents, [sUSDContractLegacy, sUSDContractNew], sUSDContractReplacer)
    assert.deepEqual(
        decodedEvents,
        [decodedEventNotSNX, decodedEventSNXLegacy, decodedEventSNXNew, decodedEventSUSDLegacy, decodedEventSUSDNew]
    )
  })

  it("fetches, parses events and fixes contracts from the ethereum node", async function() {
    const getPastEventsExactContracts = fetch_events.__get__('getPastEventsExactContracts')
    const result = await getPastEventsExactContracts(web3, 0, 0)
    assert.deepEqual(
        result,
        [decodedEventSNXLegacy, decodedEventSNXNew, decodedEventSUSDLegacy, decodedEventSUSDNew]
    )
  })
})
