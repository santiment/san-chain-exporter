const assert = require("assert")
const Web3 = require('web3')
const Web3Wrapper = require('../../blockchains/eth/lib/web3_wrapper')
const {FeesDecoder} = require('../../blockchains/eth/lib/fees_decoder')
const constants = require('../../blockchains/eth/lib/constants')

const block_json_post_london_no_priority = {
  "baseFeePerGas": "0xba37423df",
  "gasLimit": "0x1caa85f",
  "gasUsed": "0x9041b5",
  "hash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
  "miner": "0xea674fdde714fd979de3edf0f56aa9716b898ec8",
  "number": "0xcd2f91",
  "timestamp": "0x616e7e04",
  "totalDifficulty": "0x6ec3c4e96a280cc26b8",
  "transactions": [{
    "blockHash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
    "blockNumber": "0xcd2f91",
    "from": "0xea674fdde714fd979de3edf0f56aa9716b898ec8",
    "gas": "0x3d090",
    "gasPrice": "0xba37423df",
    "maxPriorityFeePerGas": "0x0",
    "maxFeePerGas": "0x1a0a7c1eda",
    "hash": "0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9",
    "to": "0x48ee18b6dd7d10214be35ba540b606b3a2c44d7c",
    "transactionIndex": "0x0",
    "value": "0x4290f39ca406a4",
    "type": "0x2"
    }]
}

const block_json_post_london_with_priority = {
  "baseFeePerGas": "0xba37423df",
  "gasLimit": "0x1caa85f",
  "gasUsed": "0x9041b5",
  "hash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
  "miner": "0xea674fdde714fd979de3edf0f56aa9716b898ec8",
  "number": "0xcd2f91",
  "timestamp": "0x616e7e04",
  "totalDifficulty": "0x6ec3c4e96a280cc26b8",
  "transactions": [
  {
    "blockHash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
    "blockNumber": "0xcd2f91",
    "from": "0x8ae57a027c63fca8070d1bf38622321de8004c67",
    "gas": "0x2a6af",
    "gasPrice": "0xbdf0eeddf",
    "maxPriorityFeePerGas": "0x3b9aca00",
    "maxFeePerGas": "0x19284a2404",
    "hash": "0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98",
    "to": "0x2f102e69cbce4938cf7fb27adb40fad097a13668",
    "transactionIndex": "0xa4",
    "value": "0x0",
    "type": "0x2"
  }
]}

const receipts_json_post_london_no_priority = [{
  "blockHash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
  "blockNumber": "0xcd2f91",
  "cumulativeGasUsed": "0x5208",
  "effectiveGasPrice": "0xba37423df",
  "from": "0xea674fdde714fd979de3edf0f56aa9716b898ec8",
  "gasUsed": "0x5208",
  "logs": [],
  "to": "0x48ee18b6dd7d10214be35ba540b606b3a2c44d7c",
  "transactionHash": "0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9",
  "transactionIndex": "0x0",
  "type": "0x2"
}]

const receipts_json_post_london_with_priority = [{
  "blockHash": "0x6b029d5ebe5ca9bc568cd8630bd0af3d6b2b7ebed39fb7a6127a9169017010bd",
  "blockNumber": "0xcd2f91",
  "cumulativeGasUsed": "0x9041b5",
  "effectiveGasPrice": "0xbdf0eeddf",
  "from": "0x8ae57a027c63fca8070d1bf38622321de8004c67",
  "gasUsed": "0x11d7e",
  "status": "0x1",
  "to": "0x2f102e69cbce4938cf7fb27adb40fad097a13668",
  "transactionHash": "0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98",
  "transactionIndex": "0xa4",
  "type": "0x2"
}]

const block_json_pre_london = {
  "gasLimit": "0x2fefd8",
  "gasUsed": "0xc444",
  "hash": "0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e",
  "miner": "0x2a65aca4d5fc5b5c859090a6c34d164135398226",
  "number": "0xf4240",
  "timestamp": "0x56bfb415",
  "transactions": [{
    "blockHash": "0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e",
    "blockNumber": "0xf4240",
    "from": "0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3",
    "gas": "0x1f8dc",
    "gasPrice": "0x12bfb19e60",
    "hash": "0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f",
    "input": "0x",
    "nonce": "0x15",
    "to": "0xc083e9947cf02b8ffc7d3090ae9aea72df98fd47",
    "transactionIndex": "0x0",
    "value": "0x56bc75e2d63100000"
}]}

const receipts_json_pre_london = [{
  "blockHash": "0x8e38b4dbf6b11fcc3b9dee84fb7986e29ca0a02cecd8977c161ff7333329681e",
  "blockNumber": "0xf4240",
  "contractAddress": null,
  "cumulativeGasUsed": "0x723c",
  "effectiveGasPrice": "0x12bfb19e60",
  "from": "0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3",
  "gasUsed": "0x723c",
  "to": "0xc083e9947cf02b8ffc7d3090ae9aea72df98fd47",
  "transactionHash": "0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f",
  "transactionIndex": "0x0"
}]


function turnReceiptsToMap(receipts) {
  const result = {}
  receipts.forEach(receipt => {
    result[receipt.transactionHash] = receipt
  })

  return result
}

describe('Fees decoder test', function() {
    let feesDecoder = null
    let web3 = null
    let web3Wrapper = null

    beforeEach(function() {
      web3 = new Web3(new Web3.providers.HttpProvider(constants.PARITY_NODE))
      web3Wrapper = new Web3Wrapper(web3)
      feesDecoder = new FeesDecoder(web3, web3Wrapper)
    })

    it("test fees post London no priority", async function () {
        const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_no_priority,
          turnReceiptsToMap(receipts_json_post_london_no_priority))

        const expected =  [{
            from: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
            to: constants.BURN_ADDRESS,
            value: 1049725694283000,
            valueExactBase36: 'ac3hbr9fco',
            blockNumber: 13447057,
            timestamp: 1634631172,
            transactionHash: '0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9',
            type: 'fee_burnt'
          }
        ]

        assert.deepStrictEqual(postLondonFees, expected)
    })

    it("test fees post London with priority", async function () {
      const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_with_priority,
        turnReceiptsToMap(receipts_json_post_london_with_priority))

      const expected =  [{
          from: '0x8ae57a027c63fca8070d1bf38622321de8004c67',
          to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          value: 73086000000000,
          valueExactBase36: 'pwn8tdiio',
          blockNumber: 13447057,
          timestamp: 1634631172,
          transactionHash: '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
          type: 'fee'
        },
        {
          blockNumber: 13447057,
          from: "0x8ae57a027c63fca8070d1bf38622321de8004c67",
          timestamp: 1634631172,
          to: "burn",
          transactionHash: "0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98",
          type: "fee_burnt",
          value: 3653345337731778,
          valueExactBase36: "zz03ofi5du"
        }
      ]

      assert.deepStrictEqual(postLondonFees, expected)
  })

    it("test fees pre London", async function () {
      const preLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_pre_london,
        turnReceiptsToMap(receipts_json_pre_london))

      const expected =  [{
          from: '0x39fa8c5f2793459d6622857e7d9fbb4bd91766d3',
          to: '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
          value: 2354887722000000,
          valueExactBase36: 'n6qkhga2dc',
          blockNumber: 1000000,
          timestamp: 1455404053,
          transactionHash: '0xea1093d492a1dcb1bef708f771a99a96ff05dcab81ca76c31940300177fcf49f',
          type: 'fee'
      }]

      assert.deepStrictEqual(preLondonFees, expected)
  })

})