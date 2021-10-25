const assert = require("assert")

const {extendEventsWithPrimaryKey} = require("../../blockchains/erc20/lib/extend_events_key")
const constants = require('../../blockchains/erc20/lib/constants')

let inputEvent1 = {}
let inputEvent2 = {}

// The primary key algorithm for non overwritten events
function calculatePrimaryKeyNonOverwrittenEvent(event) {
  return event.blockNumber * constants.PRIMARY_KEY_MULTIPLIER + event.logIndex
}

function setExpectedEventPrimaryKey(event) {
  event.primaryKey = calculatePrimaryKeyNonOverwrittenEvent(event)
}


describe('assignPrimaryKeys', function() {
  beforeEach(function() {
    inputEvent1 = {
      address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
      blockHash: '0x5e8eac3696797200b5ee04f3dc34b407c5921442686794eafcaf5076b837d7d4',
      blockNumber: 3978360,
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
      id: 'log_ff113a78'
    }

    inputEvent2 = {
      address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
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
      id: 'log_caef200c'
    }
  });

  it("assign primary keys, single event", async function() {
    const expectedEvent = JSON.parse(JSON.stringify(inputEvent1))
    extendEventsWithPrimaryKey([inputEvent1], [])

    setExpectedEventPrimaryKey(expectedEvent)

    assert.deepEqual(inputEvent1, expectedEvent)
  })

  it("assign primary keys, event list, overwritten are empty", async function() {
    const expectedEvents = JSON.parse(JSON.stringify([inputEvent1, inputEvent2]))
    extendEventsWithPrimaryKey([inputEvent1, inputEvent2], [])

    setExpectedEventPrimaryKey(expectedEvents[0])
    setExpectedEventPrimaryKey(expectedEvents[1])

    assert.deepEqual([inputEvent1, inputEvent2], expectedEvents)
  })

  it("assign primary keys, event list, overwritten not empty", async function() {
    const copyEvents = JSON.parse(JSON.stringify([inputEvent1, inputEvent2]))
    const expectedEvents = JSON.parse(JSON.stringify([inputEvent1, inputEvent2]))
    extendEventsWithPrimaryKey([inputEvent1, inputEvent2], copyEvents)

    setExpectedEventPrimaryKey(expectedEvents[0])
    setExpectedEventPrimaryKey(expectedEvents[1])

    assert.deepEqual([inputEvent1, inputEvent2], expectedEvents)
  })

  it("assign primary keys, event list, check keys of overwritten", async function() {
    const copyEvents = JSON.parse(JSON.stringify([inputEvent1, inputEvent2]))
    const expectedEvents = JSON.parse(JSON.stringify(copyEvents))
    extendEventsWithPrimaryKey([inputEvent1, inputEvent2], copyEvents)

    const primaryKeyLastNonOverwritten = calculatePrimaryKeyNonOverwrittenEvent(inputEvent2)
    // Primary keys of overwritten contracts start from last non-overwritten and increase by 1
    expectedEvents[0].primaryKey = primaryKeyLastNonOverwritten + 1
    expectedEvents[1].primaryKey = primaryKeyLastNonOverwritten + 2

    assert.deepEqual(copyEvents, expectedEvents)
  })
})

