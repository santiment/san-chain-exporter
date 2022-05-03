/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')

const bnb_transactions_fetcher = rewire("../../blockchains/bnb/lib/bnb_transactions_fetcher")
const constants = rewire("../../blockchains/bnb/lib/constants")

let intervalStartResult
let intervalEndResult
bnb_transactions_fetcher.__set__("fetchTimeInterval", function (queue, intervalFetchStart, intervalFetchEnd) {
  intervalStartResult = intervalFetchStart
  intervalEndResult = intervalFetchEnd

  return true;
})



const CURRENT_BLOCK_TIMESTAMP = 1000000
const START_TIMESTAMP = 800000

bnb_transactions_fetcher.__set__("getLastBlockTimestamp", function () {
  return CURRENT_BLOCK_TIMESTAMP;
})

describe('startIntervalIsNotModified', function() {
  it("Checking that the start interval for fetching transactions will not be modified.", async function() {
    const queue = ""
    const timestampReached = START_TIMESTAMP

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher()

    // The loop is only triggered here. The result would be saved in by the callback function.
    await bnbTransactionsFetcher.fetchTransactions(queue, timestampReached)

    assert.deepStrictEqual(intervalStartResult, START_TIMESTAMP + 1)
  })
})

describe('endIntervalIsEditedNotToGoIntoFuture', function() {
  it("Checking that the end will be modified to stay into the present.", async function() {
    const queue = "";
    const timestampReached = START_TIMESTAMP

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher()

    const result = await bnbTransactionsFetcher.fetchTransactions(queue, timestampReached)

    // Assert that the end interval is about to go into the future before corrections.
    assert(
      timestampReached + constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC >
      bnb_transactions_fetcher.__get__("getLastBlockTimestamp")()
    )

    // Assert that the end interval does not go into the future but is reduced accordingly to current block timestamp.
    assert.strictEqual(
      result.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    // Also assert this is the same value being used internally by the function.
    assert.strictEqual(
      intervalEndResult,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

  })
})

describe('endIntervalDoesNotPrecedeStart', function() {
  it("Checking that there would always be a range between the start and end intervals",
  async function() {

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher()
    // Provide a start interval which matches the currently possible end interval. This can happen if the
    // blockchain has not moved forward between two calls and the previous call reached the blockchain head.
    // Example:
    // Call 1:  1 - 100
    // Call 2:  100 - ?
    // If the blockchain head is still at 100 we should not update the end interval.
    // Note: When we say 'head' we mean what the Node returns subtracted with a safety margin.
    await bnbTransactionsFetcher.updateIntervalFetchEnd(CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC, "")

    // Check that since intervalFetchEnd can not be moved forward it would not be updated.
    assert.strictEqual(
      0,
      bnbTransactionsFetcher.intervalFetchEnd
    )

  })
})

describe('endIntervalHoldsOnBuggyNode', function() {
  it("Checking that the end interval would not slip into the past if the Node reports a previous block for head.",
  async function() {
    const timestampReached = START_TIMESTAMP

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher()
    await bnbTransactionsFetcher.updateIntervalFetchEnd(timestampReached, "")

    assert.strictEqual(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC,
      bnbTransactionsFetcher.intervalFetchEnd
    )

    // Now modify the time that the Node returns so that it is less than what it has last returned
    bnb_transactions_fetcher.__set__("getLastBlockTimestamp", function () {
      return CURRENT_BLOCK_TIMESTAMP - 100
    })

    await bnbTransactionsFetcher.updateIntervalFetchEnd(bnbTransactionsFetcher.intervalFetchEnd + 1, "")

    // We expect the timestamp to not progress
    assert.strictEqual(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC,
      bnbTransactionsFetcher.intervalFetchEnd
    )

  })
})
