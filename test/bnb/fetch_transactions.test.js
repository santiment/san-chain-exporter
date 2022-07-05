/*jshint esversion: 6 */
const assert = require("assert")
const rewire = require('rewire')

const fetch_transactions = rewire("../../blockchains/bnb/lib/fetch_transactions")

const TX_HASH = "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961";

/** The transaction summary as it is returned when fetching time intervals. */
const txWithChildSummary = {
  "blockHeight": 112571691,
  "code": 0,
  "confirmBlocks": 0,
  "hasChildren": 1,
  "log": "Msg 0: ",
  "memo": "STAKE:BNB.BNB",
  "source": 0,
  "timeStamp": 1599695285856,
  "txAge": 126285,
  "txFee": 0.0006,
  "txHash": TX_HASH,
  "txType": "TRANSFER"
}

const txWithoutChild = {
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

/** The complete transaction as returned when fetching with exact tx id. */
const txWithChildFull = {
  "blockHeight": 112571691,
  "code": 0,
  "confirmBlocks": 316555,
  "hasChildren": 1,
  "log": "Msg 0: ",
  "memo": "STAKE:BNB.BNB",
  "sequence": 698,
  "source": 0,
  "subTxsDto": {
    "pageSize": 15,
    "subTxDtoList": [
      {
        "asset": "BNB",
        "fee": 0.0006,
        "fromAddr": "bnb1nt08gyeqpaq23wwt70652q7qxsc7ue6mgphdav",
        "hash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
        "height": 112571691,
        "toAddr": "bnb1n99c3gg2l0w4crqyedzrcfxt5phmdry9lgpcxt",
        "type": "TRANSFER",
        "value": 82.04094816
      },
      {
        "asset": "RUNE-B1A",
        "fee": null,
        "fromAddr": "bnb1nt08gyeqpaq23wwt70652q7qxsc7ue6mgphdav",
        "hash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
        "height": 112571691,
        "toAddr": "bnb1n99c3gg2l0w4crqyedzrcfxt5phmdry9lgpcxt",
        "type": "TRANSFER",
        "value": 2800.5588432
      }
    ],
    "totalNum": 2
  },
  "timeStamp": 1599695285856,
  "txAge": 136140,
  "txFee": 0.0006,
  "txHash": TX_HASH,
  "txType": "TRANSFER"
}

// In the expected result, we expect only the children
const expectedResult = [
  txWithoutChild,
  {
    "blockHeight": 112571691,
    "txAsset": "BNB",
    "txFee": 0.0006,
    "timeStamp": 1599695285856,
    "fromAddr": "bnb1nt08gyeqpaq23wwt70652q7qxsc7ue6mgphdav",
    "txHash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
    "toAddr": "bnb1n99c3gg2l0w4crqyedzrcfxt5phmdry9lgpcxt",
    "txType": "TRANSFER",
    "value": 82.04094816,
    "hasChildren": 0
  },
  {
    "blockHeight": 112571691,
    "txAsset": "RUNE-B1A",
    "txFee": null,
    "timeStamp": 1599695285856,
    "fromAddr": "bnb1nt08gyeqpaq23wwt70652q7qxsc7ue6mgphdav",
    "txHash": "C6BC7846E27F52B1EC18302AB7A4A346CB29DA59CDDE1171FB9B01AE94E49961",
    "toAddr": "bnb1n99c3gg2l0w4crqyedzrcfxt5phmdry9lgpcxt",
    "txType": "TRANSFER",
    "value": 2800.5588432,
    "hasChildren": 0
  }

]

fetch_transactions.__set__("sendTrxQuery", async function (parentTrxID) {
  if (parentTrxID == TX_HASH) {
    return txWithChildFull;
  }
})

describe('subTxMerged', function () {
  it("Checking that a trx having children will be merged correctly with its child", async function () {
    const queue = "";
    // The loop is only triggered here. The result would be saved in 'testResult' by the callback function.
    const result = await fetch_transactions.replaceParentTransactionsWithChildren(queue, [txWithoutChild, txWithChildSummary])

    assert.deepEqual(
      result,
      expectedResult)
  })

})

const tx1 = {
  "txHash": "9373C96652A81CA777C4623D4C5205A070CFC89C7067DC8AB0B0C4F6BD098168",
  "blockHeight": 251746779
}

const tx2 =
{
  "txHash": "9415045541E182F508ED9D397F60621600DB594A43139FEE94BA99E20F11D832",
  "blockHeight": 251746779
}

const tx3 = {
  "txHash": "6859E65B7C905298F8351F6D595A7EDE1F1961F69C3D51DC90F5460746F3A3BB",
  "blockHeight": 251746779
}

// Not relevant transaction fields are removed.
const txList = [tx2, tx1, tx3, tx2, tx1]


describe('filterRepeatedTransactions', function () {
  it("Filter out identical transactions returned on different pages", async function () {

    fetch_transactions.filterRepeatedTransactions(txList)

    assert.deepEqual(
      txList,
      [tx3, tx2, tx1])
  })

})
