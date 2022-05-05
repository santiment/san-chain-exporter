/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')

const bnb_transactions_fetcher = rewire("../../blockchains/bnb/lib/bnb_transactions_fetcher")
const constants = rewire("../../blockchains/bnb/lib/constants")

const CURRENT_BLOCK_TIMESTAMP = 100000000
const START_TIMESTAMP = 80000000

let intervalStartResult = -1
let intervalEndResult = -1


describe('intervalStartIsNotModified', function() {
  beforeEach(function(done) {
    intervalStartResult = -1;
    intervalEndResult = -1;

    bnb_transactions_fetcher.__set__("getLastBlockTimestamp", function () {
      return CURRENT_BLOCK_TIMESTAMP;
    })

    bnb_transactions_fetcher.__set__("fetchTimeInterval", function (queue, intervalFetchStart, intervalFetchEnd) {
      intervalStartResult = intervalFetchStart
      intervalEndResult = intervalFetchEnd

      return true;
    })

    done()
  })

  it("Checking that the start interval for fetching transactions will not be modified.", async function() {
    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(START_TIMESTAMP)

    // The loop is only triggered here. The result would be saved in by the callback function.
    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    assert.deepStrictEqual(intervalStartResult, START_TIMESTAMP + 1)
  })

  it("Checking that the end will be modified to stay into the present.", async function() {
    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // Assert that the end interval is about to go into the future before corrections.
    assert(
      bnbTransactionsFetcher.intervalFetchEnd + constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC >
      bnb_transactions_fetcher.__get__("getLastBlockTimestamp")()
    )

    // Assert that the end interval does not go into the future but is not modified.
    assert.strictEqual(
      bnbTransactionsFetcher.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    // Also assert 'fetchTimeInterval' was never called.
    assert.strictEqual(intervalEndResult, -1)

  })

  it("Checking that there would always be a range between the start and end intervals",
  async function() {

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    // Provide a start interval which matches the currently possible end interval. This can happen if the
    // blockchain has not moved forward between two calls and the previous call reached the blockchain head.
    // Example:
    // Call 1:  1 - 100
    // Call 2:  100 - ?
    // If the blockchain head is still at 100 we should not update the end interval.
    // Note: When we say 'head' we mean what the Node returns subtracted with a safety margin.
    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // Check that since intervalFetchEnd can not be moved forward it would not be updated.
    assert.strictEqual(
      bnbTransactionsFetcher.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )
  })

  it("Checking that up to date with blockchain flag is set",
  async function() {

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // Check that since intervalFetchEnd can not be moved forward it would not be updated.
    assert.strictEqual(
      bnbTransactionsFetcher.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    // Check correct flag is set
    assert.strictEqual(
      bnbTransactionsFetcher.isUpToDateWithBlockchain,
      true
    )
  })


  it("Checking that the end interval would not slip into the past if the Node reports a previous block for head.",
  async function() {
    // Choose a start timestamp such, that only one interval is possible
    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC - constants.FETCH_INTERVAL_HISTORIC_MODE_MSEC - 1
    )
    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // End timestamp is the last one possible
    assert.strictEqual(
      bnbTransactionsFetcher.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )

    // Now modify the time that the Node returns so that it is less than what it has last returned
    bnb_transactions_fetcher.__set__("getLastBlockTimestamp", function () {
      return CURRENT_BLOCK_TIMESTAMP - 1
    })

    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // We expect the timestamp to not progress
    assert.strictEqual(
      bnbTransactionsFetcher.intervalFetchEnd,
      CURRENT_BLOCK_TIMESTAMP - constants.SAFETY_BLOCK_WAIT_MSEC
    )
  })

  it("Checking interval does not progress on fetch error.",
  async function() {
    bnb_transactions_fetcher.__set__("fetchTimeInterval", function (queue, intervalFetchStart, intervalFetchEnd) {
      intervalStartResult = intervalFetchStart
      intervalEndResult = intervalFetchEnd

      return false;
    })

    const bnbTransactionsFetcher = new bnb_transactions_fetcher.BNBTransactionsFetcher(START_TIMESTAMP)

    // Assert that the next interval is possible
    const nextInterval = await bnbTransactionsFetcher.tryGetNextIntervalWithNode()
    assert.strictEqual(
      nextInterval.result,
      true
    )

    await bnbTransactionsFetcher.tryFetchTransactionsNextRange()

    // Even though the next interval is possible, we have not progressed due to the fetch error
    assert.strictEqual(bnbTransactionsFetcher.intervalFetchEnd, START_TIMESTAMP)
  })

})
