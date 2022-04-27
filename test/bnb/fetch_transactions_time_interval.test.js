/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')

const fetch_transactions = rewire("../../blockchains/bnb/lib/fetch_transactions")

let intervalStartResult
let intervalEndResult
fetch_transactions.__set__("fetchTimeInterval", function (queue, intervalFetchStart, intervalFetchEnd) {
  intervalStartResult = intervalFetchStart
  intervalEndResult = intervalFetchEnd

  return true;
})

const CURRENT_BLOCK_TIMESTAMP = 1000000
const START_TIMESTAMP = 900000

fetch_transactions.__set__("utils.getLastBlockTimestamp", function () {
  return CURRENT_BLOCK_TIMESTAMP;
})

describe('startIntervalIsNotModified', function() {
  it("Checking that the start interval for fetching transactions will not be modified.", async function() {
    const queue = "";
    let lastProcessedPosition = {
      timestampReached: START_TIMESTAMP - 1,
      blockNumber: 900
    };

    // The loop is only triggered here. The result would be saved in by the callback function.
    await fetch_transactions.fetchTransactions(queue, lastProcessedPosition)

    assert.deepStrictEqual(
      START_TIMESTAMP,
      intervalStartResult)
  })
})

describe('endIntervalIsEditedNotToGoIntoFuture', function() {
  it("Checking that the end start will be modified to stay into the present.", async function() {
    const queue = "";
    let lastProcessedPosition = {
      timestampReached: START_TIMESTAMP - 1,
      blockNumber: 900
    };

    const result = await fetch_transactions.fetchTransactions(queue, lastProcessedPosition)

    // Assert that the end interval is about to go into the future before corrections.
    assert(
      START_TIMESTAMP + fetch_transactions.__get__("FETCH_INTERVAL_HISTORIC_MODE_MSEC") > CURRENT_BLOCK_TIMESTAMP
    )

    // Assert that the end interval does not go into the future but is reduced accordingly to current block timestamp.
    assert.strictEqual(
      result.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - fetch_transactions.__get__("SAFETY_BLOCK_WAIT_MSEC")
    )

    // Also assert this is the same value being used internally by the function.
    assert.strictEqual(
      intervalEndResult,
      CURRENT_BLOCK_TIMESTAMP - fetch_transactions.__get__("SAFETY_BLOCK_WAIT_MSEC")
    )

  })
})
