const assert = require("assert")
const Web3 = require('web3')
const Web3Wrapper = require('../../blockchains/eth/lib/web3_wrapper')
const {FeesDecoder} = require('../../blockchains/eth/lib/fees_decoder')
const constants = require('../../blockchains/eth/lib/constants')

/**
 * A transaction for which there is zero 'maxPriorityFeePerGas' and also 'maxFeePerGas' - 'baseFeePerGas' = 0.
 * This should produce no miner fee transfer.
 */
const block_json_post_london_zero_priority = {
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
    "maxFeePerGas": "0xba37423df",
    "hash": "0xc8bebc11bbe703cdfb2a1a9599221baf4f19a1e20808866346791799d2dac7a9",
    "to": "0x48ee18b6dd7d10214be35ba540b606b3a2c44d7c",
    "transactionIndex": "0x0",
    "value": "0x4290f39ca406a4",
    "type": "0x2"
    }]
}

/**
 * A transaction for which the miner fee is reduced by the value of 'maxFeePerGas'.
 */
 const block_json_post_london_fee_reduced_by_maxFeePerGas = {
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
    "maxFeePerGas": "0xBA43B7400",
    "hash": "0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98",
    "to": "0x2f102e69cbce4938cf7fb27adb40fad097a13668",
    "transactionIndex": "0xa4",
    "value": "0x0",
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

const block_json_post_london_old_tx_type = {
  "baseFeePerGas": "0xf6e9b0a7f",
  "hash": "0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a",
  "miner": "0xea674fdde714fd979de3edf0f56aa9716b898ec8",
  "number": "0xcb3928",
  "timestamp": "0x6153e50a",
  "transactions": [{
    "blockHash": "0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a",
    "blockNumber": "0xcb3928",
    "from": "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",
    "gas": "0x5208",
    "gasPrice": "0xfe5d09e7f",
    "maxPriorityFeePerGas": "0x77359400",
    "maxFeePerGas": "0x1e80355e00",
    "hash": "0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c",
    "input": "0x",
    "nonce": "0x1f9ac2",
    "to": "0x9fae918aeb96e876e25ee6975bcc2976cf48f595",
    "transactionIndex": "0x61",
    "value": "0x765ae822ac7f2000",
    "type": "0x2",
    "chainId": "0x1",
    "v": "0x0",
    "r": "0xeb6780fe250ffa23c04435a80c2a65bcc8a4255d099fc13bcf613d904c7e4546",
    "s": "0x3f64aaa4de82769c74d30c4f8facba39b61555eb667e9211122ae9ca320df39c"
  }]
}

const receipts_json_post_london_old_tx_type = [{
  "blockHash": "0xc66d31320e1b56947efc0b3014950a1211063cd8cbf12399ebbc905d54bca00a",
  "blockNumber": "0xcb3928",
  "contractAddress": null,
  "cumulativeGasUsed": "0x3880ad",
  "effectiveGasPrice": "0xfe5d09e7f",
  "from": "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",
  "gasUsed": "0x5208",
  "logs": [],
  "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "status": "0x1",
  "to": "0x9fae918aeb96e876e25ee6975bcc2976cf48f595",
  "transactionHash": "0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c",
  "transactionIndex": "0x61",
  "type": "0x2"
}]

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
      web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL))
      web3Wrapper = new Web3Wrapper(web3)
      feesDecoder = new FeesDecoder(web3, web3Wrapper)
    })

    it("test fees post London zero priority", async function () {
        const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_zero_priority,
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
          blockNumber: 13447057,
          from: "0x8ae57a027c63fca8070d1bf38622321de8004c67",
          timestamp: 1634631172,
          to: "burn",
          transactionHash: "0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98",
          type: "fee_burnt",
          value: 3653345337731778,
          valueExactBase36: "zz03ofi5du"
        },
        {
          from: '0x8ae57a027c63fca8070d1bf38622321de8004c67',
          to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          value: 73086000000000,
          valueExactBase36: 'pwn8tdiio',
          blockNumber: 13447057,
          timestamp: 1634631172,
          transactionHash: '0x1e53bf3951f6cb70461df500ec75ed5d88d73bd44d88ca7faabaa4b1e65aec98',
          type: 'fee'
        }
      ]

      assert.deepStrictEqual(postLondonFees, expected)
    })

    it("test old type fees post London", async function () {
      const postLondonFees = feesDecoder.getFeesFromTransactionsInBlock(block_json_post_london_old_tx_type,
        turnReceiptsToMap(receipts_json_post_london_old_tx_type))

      const expected =  [{
          blockNumber: 13318440 ,
          from: "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",
          timestamp: 1632888074,
          to: "burn",
          transactionHash: "0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c",
          type: "fee_burnt",
          value:  1391883443307000,
          valueExactBase36: "dpdqfcs260"
        },
        {
          from: '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740',
          to: '0xea674fdde714fd979de3edf0f56aa9716b898ec8',
          value: 42000000000000,
          valueExactBase36: 'evyj7lbeo',
          blockNumber: 13318440,
          timestamp: 1632888074,
          transactionHash: '0xec5b5841e0a425bf69553a0ccecfa58b053a63e30f5fbdd9ecbdee5e9fb0666c',
          type: 'fee'
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
