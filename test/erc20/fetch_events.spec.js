const assert = require("assert")
const rewire = require('rewire')
const Web3 = require('web3')

const fetch_events = rewire("../../blockchains/erc20/lib/fetch_events")
const web3 = new Web3()

const blockTimestamps = {
  "3798720": 1496241767,
  "3978360": 1499265391,
  "5987277": 1531930765,
  "7011054": 1546639212,
  "7207279": 1549899997
}

const rawEvents = [
  // bat mint
  { address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
    blockHash: '0x5e8eac3696797200b5ee04f3dc34b407c5921442686794eafcaf5076b837d7d4',
    blockNumber: 3798720,
    data: '0x000000000000000000000000000000000000000000000002b178b3e9acd86000',
    logIndex: 8,
    removed: false,
    topics:
     [ '0xb33527d2e0d30b7aece2c5e82927985866c1b75173d671c14f4457bf67aa6910',
       '0x000000000000000000000000fbfa258b9028c7d4fc52ce28031469214d10daeb' ],
    transactionHash: '0x62901c72c13cc56efe3180b1bc02b02c108ae0a68a76d594161c9a41d0ebcceb',
    transactionIndex: 143,
    transactionLogIndex: '0x0',
    type: 'mined',
    id: 'log_ff113a78' },
  // bnb freeze
  { address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    blockHash: '0xde18db2a41c7250412ff1297ad983173ccce8281c1d19498427a765e73cf9b98',
    blockNumber: 3978360,
    data: '0x00000000000000000000000000000000000000000034f086f3b33b6840000000',
    logIndex: 31,
    removed: false,
    topics:
     [ '0xf97a274face0b5517365ad396b1fdba6f68bd3135ef603e44272adba3af5a1e0',
       '0x00000000000000000000000000c5e04176d95a286fcce0e68c683ca0bfec8454' ],
    transactionHash: '0x72af0f55b97b033af3b6e6162463681730c6429d0bc9c6c6ae9ad595aa2fbc57',
    transactionIndex: 70,
    transactionLogIndex: '0x0',
    type: 'mined',
    id: 'log_caef200c' },
  // bnb unfreeze
  { address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    blockHash: '0x37dada95b3bf37bc9f9e2029c2af291e8e099348ffadd270f1fc897573964671',
    blockNumber: 5987277,
    data: '0x0000000000000000000000000000000000000000000d3c21bcecceda10000000',
    logIndex: 78,
    removed: false,
    topics:
     [ '0x2cfce4af01bcb9d6cf6c84ee1b7c491100b8695368264146a94d71e10a63083f',
       '0x00000000000000000000000000c5e04176d95a286fcce0e68c683ca0bfec8454' ],
    transactionHash: '0x20b2be5acb83856e56c64429b096c8d0852e1b810356c8fcea9d278aeee094a6',
    transactionIndex: 129,
    transactionLogIndex: '0x0',
    type: 'mined',
    id: 'log_a5581f5a' },
  // transfer
  { address: '0xaAAf91D9b90dF800Df4F55c205fd6989c977E73a',
    blockHash: '0xa25d37e4807e1ae30d95d0a600c8adc01b26fbc4bc55e219c92befbf323605e0',
    blockNumber: 7011054,
    data: '0x00000000000000000000000000000000000000000000000000000003c3b87e3b',
    logIndex: 0,
    removed: false,
    topics:
     [ '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
       '0x0000000000000000000000005e575279bf9f4acf0a130c186861454247394c06',
       '0x000000000000000000000000fd247ccdeb4229aea8f302993eaa80ab52050264' ],
    transactionHash: '0x115947f1d988696f49cc56f3b405284db879729bae0365ae49997a8b32ed5131',
    transactionIndex: 13,
    transactionLogIndex: '0x0',
    type: 'mined',
    id: 'log_06fec081' },
  // not tracked event
  { address: '0x0000000000075EfBeE23fe2de1bd0b7690883cc9',
    blockHash: '0xa25d37e4807e1ae30d95d0a600c8adc01b26fbc4bc55e219c92befbf323605e0',
    blockNumber: 7011054,
    data: '0x',
    logIndex: 38,
    removed: false,
    topics:
     [ '0x86cc1a29a55449d1229bb301da3d61fcd5490843635df9a79e5a4df4724773d2',
       '0x000000000000000000000000000000000000000000000000000000000000000a',
       '0x000000000000000000000000efc703e9bc7eab2950841eef50b6108e422ec7e9' ],
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    transactionIndex: 53,
    transactionLogIndex: '0x0',
    type: 'mined',
    id: 'log_2fd2250c' },
  // mint
  { address: '0x0000000000085d4780B73119b644AE5ecd22b376',
    blockHash: '0xa25d37e4807e1ae30d95d0a600c8adc01b26fbc4bc55e219c92befbf323605e0',
    blockNumber: 7011054,
    data: '0x0000000000000000000000000000000000000000000174b1ca8ab05a8c000000',
    logIndex: 39,
    removed: false,
    topics:
     [ '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885',
       '0x000000000000000000000000fbd95709188b3681fd4d07f25f8d64c3ffa5bf97' ],
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    transactionIndex: 53,
    transactionLogIndex: '0x1',
    type: 'mined',
    id: 'log_fb51d0cc' },
  // transfer which duplicates the mint above
  { address: '0x0000000000085d4780B73119b644AE5ecd22b376',
    blockHash: '0xa25d37e4807e1ae30d95d0a600c8adc01b26fbc4bc55e219c92befbf323605e0',
    blockNumber: 7011054,
    data: '0x0000000000000000000000000000000000000000000174b1ca8ab05a8c000000',
    logIndex: 40,
    removed: false,
    topics:
     [ '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
       '0x0000000000000000000000000000000000000000000000000000000000000000',
       '0x000000000000000000000000fbd95709188b3681fd4d07f25f8d64c3ffa5bf97' ],
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    transactionIndex: 53,
    transactionLogIndex: '0x2',
    type: 'mined',
    id: 'log_678f7e7e' },
  // burn
  { address: '0x0000000000085d4780B73119b644AE5ecd22b376',
    blockHash: '0xd2008c8aa459bdf0fa5c5c8a69cd3400ad2ada5cb8fa71cfcb01649739591151',
    blockNumber: 7207279,
    data: '0x0000000000000000000000000000000000000000000006318c2cb172ac530000',
    logIndex: 11,
    removed: false,
    topics:
    [ '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5',
      '0x000000000000000000000000000000000000000000000000000000000000005d' ],
    transactionHash: '0x33c9e862c220c54cecff48d9eb452db8921fb012695a7c9c2f3d6521e8cec49d',
    transactionIndex: 18,
    transactionLogIndex: '0x1',
    type: 'mined',
    id: 'log_0812e2ae' },
  // transfer which duplicates the burn above
  { address: '0x0000000000085d4780B73119b644AE5ecd22b376',
    blockHash: '0xd2008c8aa459bdf0fa5c5c8a69cd3400ad2ada5cb8fa71cfcb01649739591151',
    blockNumber: 7207279,
    data: '0x0000000000000000000000000000000000000000000006318c2cb172ac530000',
    logIndex: 12,
    removed: false,
    topics:
    [ '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x000000000000000000000000000000000000000000000000000000000000005d',
      '0x0000000000000000000000000000000000000000000000000000000000000000' ],
    transactionHash: '0x33c9e862c220c54cecff48d9eb452db8921fb012695a7c9c2f3d6521e8cec49d',
    transactionIndex: 18,
    transactionLogIndex: '0x2',
    type: 'mined',
    id: 'log_adcff8b4' }
]

const decodedEvents = [
  // bat mint
  { contract: '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
    blockNumber: 3798720,
    timestamp: 1496241767,
    transactionHash: '0x62901c72c13cc56efe3180b1bc02b02c108ae0a68a76d594161c9a41d0ebcceb',
    logIndex: 8,
    from: 'mint',
    to: '0xfbfa258b9028c7d4fc52ce28031469214d10daeb',
    value: 49681657105546240000,
    valueExactBase36: 'ahghhm93wk1ds' },
  // bnb freeze
  { contract: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
    blockNumber: 3978360,
    timestamp: 1499265391,
    transactionHash: '0x72af0f55b97b033af3b6e6162463681730c6429d0bc9c6c6ae9ad595aa2fbc57',
    logIndex: 31,
    from: '0x00c5e04176d95a286fcce0e68c683ca0bfec8454',
    to: 'freeze',
    value: 6.4e+25,
    valueExactBase36: '81huq41v3rsnftyps' },
  // bnb unfreeze
  { contract: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
    blockNumber: 5987277,
    timestamp: 1531930765,
    transactionHash: '0x20b2be5acb83856e56c64429b096c8d0852e1b810356c8fcea9d278aeee094a6',
    logIndex: 78,
    from: 'freeze',
    to: '0x00c5e04176d95a286fcce0e68c683ca0bfec8454',
    value: 1.6e+25,
    valueExactBase36: '20dgoj0grxy5uyhog' },
  // transfer
  { contract: '0xaaaf91d9b90df800df4f55c205fd6989c977e73a',
    blockNumber: 7011054,
    timestamp: 1546639212,
    transactionHash: '0x115947f1d988696f49cc56f3b405284db879729bae0365ae49997a8b32ed5131',
    logIndex: 0,
    from: '0x5e575279bf9f4acf0a130c186861454247394c06',
    to: '0xfd247ccdeb4229aea8f302993eaa80ab52050264',
    value: 16168549947,
    valueExactBase36: '7fec4zf' },
  // mint
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7011054,
    timestamp: 1546639212,
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    logIndex: 39,
    from: 'mint',
    to: '0xfbd95709188b3681fd4d07f25f8d64c3ffa5bf97',
    value: 1.76e+24,
    valueExactBase36: '7ylmuw3a9ura8u0w' },
  // transfer which duplicates the mint above
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7011054,
    timestamp: 1546639212,
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    logIndex: 40,
    from: '0x0000000000000000000000000000000000000000',
    to: '0xfbd95709188b3681fd4d07f25f8d64c3ffa5bf97',
    value: 1.76e+24,
    valueExactBase36: '7ylmuw3a9ura8u0w' },
  // burn
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7207279,
    timestamp: 1549899997,
    transactionHash: '0x33c9e862c220c54cecff48d9eb452db8921fb012695a7c9c2f3d6521e8cec49d',
    logIndex: 11,
    from: '0x000000000000000000000000000000000000005d',
    to: 'burn',
    value: 2.924819e+22,
    valueExactBase36: '4rgm1aauy6roni8' },
  // transfer which duplicates the burn above
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7207279,
    timestamp: 1549899997,
    transactionHash: '0x33c9e862c220c54cecff48d9eb452db8921fb012695a7c9c2f3d6521e8cec49d',
    logIndex: 12,
    from: '0x000000000000000000000000000000000000005d',
    to: '0x0000000000000000000000000000000000000000',
    value: 2.924819e+22,
    valueExactBase36: '4rgm1aauy6roni8' }
]

const filteredEvents = [
  // bat mint
  { contract: '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
    blockNumber: 3798720,
    timestamp: 1496241767,
    transactionHash: '0x62901c72c13cc56efe3180b1bc02b02c108ae0a68a76d594161c9a41d0ebcceb',
    logIndex: 8,
    from: 'mint',
    to: '0xfbfa258b9028c7d4fc52ce28031469214d10daeb',
    value: 49681657105546240000,
    valueExactBase36: 'ahghhm93wk1ds' },
  // bnb freeze
  { contract: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
    blockNumber: 3978360,
    timestamp: 1499265391,
    transactionHash: '0x72af0f55b97b033af3b6e6162463681730c6429d0bc9c6c6ae9ad595aa2fbc57',
    logIndex: 31,
    from: '0x00c5e04176d95a286fcce0e68c683ca0bfec8454',
    to: 'freeze',
    value: 6.4e+25,
    valueExactBase36: '81huq41v3rsnftyps' },
  // bnb unfreeze
  { contract: '0xb8c77482e45f1f44de1745f52c74426c631bdd52',
    blockNumber: 5987277,
    timestamp: 1531930765,
    transactionHash: '0x20b2be5acb83856e56c64429b096c8d0852e1b810356c8fcea9d278aeee094a6',
    logIndex: 78,
    from: 'freeze',
    to: '0x00c5e04176d95a286fcce0e68c683ca0bfec8454',
    value: 1.6e+25,
    valueExactBase36: '20dgoj0grxy5uyhog' },
  // transfer
  { contract: '0xaaaf91d9b90df800df4f55c205fd6989c977e73a',
    blockNumber: 7011054,
    timestamp: 1546639212,
    transactionHash: '0x115947f1d988696f49cc56f3b405284db879729bae0365ae49997a8b32ed5131',
    logIndex: 0,
    from: '0x5e575279bf9f4acf0a130c186861454247394c06',
    to: '0xfd247ccdeb4229aea8f302993eaa80ab52050264',
    value: 16168549947,
    valueExactBase36: '7fec4zf' },
  // mint
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7011054,
    timestamp: 1546639212,
    transactionHash: '0xc99489f18de3bf01e1d50d95d1c77073080dac832c4d93695c284423dece286d',
    logIndex: 39,
    from: 'mint',
    to: '0xfbd95709188b3681fd4d07f25f8d64c3ffa5bf97',
    value: 1.76e+24,
    valueExactBase36: '7ylmuw3a9ura8u0w' },
  // burn
  { contract: '0x0000000000085d4780b73119b644ae5ecd22b376',
    blockNumber: 7207279,
    timestamp: 1549899997,
    transactionHash: '0x33c9e862c220c54cecff48d9eb452db8921fb012695a7c9c2f3d6521e8cec49d',
    logIndex: 11,
    from: '0x000000000000000000000000000000000000005d',
    to: 'burn',
    value: 2.924819e+22,
    valueExactBase36: '4rgm1aauy6roni8' }
]

fetch_events.__set__("getRawEvents", async function (web3, fromBlock, toBlock) {
  return rawEvents
})

fetch_events.__set__("getBlockTimestamp", async function (web3, blockNumber) {
  return blockTimestamps[blockNumber.toString()]
})

describe('decodeEvents', function() {
  it("decodes the events fetched from the ethereum node", async function() {
    const decodeEvents = fetch_events.__get__('decodeEvents')
    const result = await decodeEvents(web3, rawEvents)
    assert.deepEqual(
      result,
      decodedEvents
    )
  })
})

describe('filterEvents', function() {
  it("filters out the unneeded events", async function() {
    const filterEvents = fetch_events.__get__('filterEvents')
    const result = await filterEvents(decodedEvents)
    assert.deepEqual(
      result,
      filteredEvents
    )
  })
})

describe('getPastEvents', function() {
  it("fetches and parses events from the ethereum node", async function() {
    const getPastEvents = fetch_events.__get__('getPastEvents')
    const result = await getPastEvents(web3, 0, 0)
    assert.deepEqual(
      result,
      filteredEvents
    )
  })
})
