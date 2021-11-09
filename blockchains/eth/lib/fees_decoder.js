const { computeGasExpense, computeGasExpenseBase36 } = require('./util')
const constants = require('./constants')

class FeesDecoder {
  constructor(web3, web3Wrapper) {
    this.web3 = web3
    this.web3Wrapper = web3Wrapper
  }

  getPreLondonForkFees(transaction, block, receipts) {
    return [{
      from: transaction.from,
      to: block.miner,
      value: computeGasExpense(this.web3Wrapper, transaction.gasPrice, receipts[transaction.hash].gasUsed),
      valueExactBase36: computeGasExpenseBase36(this.web3, transaction.gasPrice, receipts[transaction.hash].gasUsed),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: "fee"
    }]
  }

  getPostLondonForkFees(transaction, block, receipts) {
    const result = []
    const maxPriorityFeePerGas = transaction['maxPriorityFeePerGas']

    if (this.web3Wrapper.parseValue(maxPriorityFeePerGas) > 0) {
      result.push({
        from: transaction.from,
        to: block.miner,
        value: computeGasExpense(this.web3Wrapper, maxPriorityFeePerGas, receipts[transaction.hash].gasUsed),
        valueExactBase36: computeGasExpenseBase36(this.web3, maxPriorityFeePerGas,
          receipts[transaction.hash].gasUsed),
        blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
        timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
        transactionHash: transaction.hash,
        type: "fee"
      })
    }

    result.push({
      from: transaction.from,
      to: constants.BURN_ADDRESS,
      value: computeGasExpense(this.web3Wrapper, block.baseFeePerGas, receipts[transaction.hash].gasUsed),
      valueExactBase36: computeGasExpenseBase36(this.web3, block.baseFeePerGas,
        receipts[transaction.hash].gasUsed),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: "fee_burnt"
    })

    return result
  }

  getFeesFromTransactionsInBlock(block, receipts) {
    const result = []
    block.transactions.forEach((transaction) => {
      const feeTransfers =
        this.web3Wrapper.parseHexToNumber(transaction.type) == 2 ?
        this.getPostLondonForkFees(transaction, block, receipts) :
        this.getPreLondonForkFees(transaction, block, receipts)

      result.push(...feeTransfers)
    })
    return result
  }
}

module.exports = {
  FeesDecoder
}