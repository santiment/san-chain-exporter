/*jshint esversion: 6 */
const assert = require("assert")
const edit_transactions = require("../../blockchains/bnb/lib/edit_transactions")

/** The transaction summary as it is returned when fetching time intervals. */
const tx1 = {
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

const tx2 = {
  "blockHeight": 112581034,
  "code": 0,
  "confirmBlocks": 0,
  "fromAddr": "bnb1lm7kn7e3uq6sev04qnqayhrl6g0s4gyms5753g",
  "hasChildren": 0,
  "log": "Msg 0: ",
  "memo": "",
  "source": 0,
  "timeStamp": 1599699350972,
  "txAge": 392572,
  "txFee": 0.0,
  "txHash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
  "txType": "TRANSFER"
}


describe('checkReordering and key generation', function() {
  it("Checking that the transactions are being correctly ordered before stored to Kafka.", async function() {
    // The loop is only triggered here. The result would be saved in 'testResult' by the callback function.
    const result = edit_transactions.getTransactionsWithKeys([tx2, tx1])

    // Add the keys to the objects as should be doing the tested function.
    tx1.primaryKey = "112581034-0"
    tx2.primaryKey = "112581034-1"

    // Expect the correct order and set keys.
    assert.deepEqual(
      result,
      [tx1, tx2])
  })
})

