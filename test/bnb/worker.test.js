/*jshint esversion: 6 */
const assert = require("assert")

const bnb_worker = require("../../blockchains/bnb/bnb_worker")

/** The transaction summary as it is returned when fetching time intervals. */
const txWithoutChild1 = {
    "blockHeight": 112581034,
    "code": 0,
    "confirmBlocks": 0,
    "fromAddr": "bnb1lm7kn7e3uq6sev04qnqayhrl6g0s4gyms5753g",
    "hasChildren": 0,
    "log": "Msg 0: ",
    "memo": "",
    "source": 0,
    "timeStamp": 1599699350972,
    "txAge": 392571,
    "txFee": 0.0,
    "txHash": "DD766B5578FF55F069C600115B5344DA29513271022D24B86F72B8360C0650C3",
    "txType": "CANCEL_ORDER"
}

const txWithoutChild2 = {
  "blockHeight": 112581035,
  "code": 0,
  "confirmBlocks": 0,
  "fromAddr": "bnb1lm7kn7e3uq6sev04qnqayhrl6g0s4gyms5753g",
  "hasChildren": 0,
  "log": "Msg 0: ",
  "memo": "",
  "source": 0,
  "timeStamp": 1599699350975,
  "txAge": 392571,
  "txFee": 0.0,
  "txHash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
  "txType": "TRANSFER"
}

const END_INTERVAL = 1599699350979;
class MockTransactionsFetcher1 {
  async fetchTransactions() {
    // It is important to match the order of how the API returns transactions - reverse order.
    return { "transactions": [txWithoutChild2, txWithoutChild1], "intervalFetchEnd": END_INTERVAL, "success": true, "historic": true };
  }
}

describe('workLoopSimpleTest', function() {
  it("Checking that position is being updated", async function() {
    const worker = new bnb_worker.worker()
    worker.init()
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher1()

    await worker.work()
    const lastProcessedPosition = worker.getLastProcessedPosition()

    assert.deepEqual(lastProcessedPosition, { timestampReached: END_INTERVAL, blockNumber: 112581035 })

  })

  it("Checking that two transactions without children are passing through the work loop without modifications", async function() {
    const worker = new bnb_worker.worker()
    worker.init()
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher1()

    const result = await worker.work()
    assert.deepEqual(
      result,
      [txWithoutChild1, txWithoutChild2])
  })
})

class MockTransactionsFetcher2 {
  async fetchTransactions() {
    // It is important to match the order of how the API returns transactions - reverse order.
    return { "transactions": [txWithoutChild2, txWithoutChild1, txWithoutChild1], "intervalFetchEnd": END_INTERVAL, "success": true, "historic": true };
  }
}
describe('workLoopRepeatedTest', function() {
  it("Checking that a repeated transaction would be removed", async function() {
    const worker = new bnb_worker.worker()
    worker.init()
    worker.bnbTransactionsFetcher = new MockTransactionsFetcher2()

    const result = await worker.work()

    assert.deepEqual(
      result,
      [txWithoutChild1, txWithoutChild2])
  })
})
