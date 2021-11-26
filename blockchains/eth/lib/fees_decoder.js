const { computeGasExpense, computeGasExpenseBase36 } = require('./util')
const constants = require('./constants')

class FeesDecoder {
  constructor(web3, web3Wrapper) {
    this.web3Wrapper = web3Wrapper
  }

  getPreLondonForkFees(transaction, block, receipts) {
    return [{
      from: transaction.from,
      to: block.miner,
      value: computeGasExpense(this.web3Wrapper, transaction.gasPrice, receipts[transaction.hash].gasUsed),
      valueExactBase36: computeGasExpenseBase36(this.web3Wrapper, transaction.gasPrice, receipts[transaction.hash].gasUsed),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: "fee"
    }]
  }

  pushBurntFee(transaction, block, receipts, result) {
    result.push({
      from: transaction.from,
      to: constants.BURN_ADDRESS,
      value: computeGasExpense(this.web3Wrapper, block.baseFeePerGas, receipts[transaction.hash].gasUsed),
      valueExactBase36: computeGasExpenseBase36(this.web3Wrapper, block.baseFeePerGas,
        receipts[transaction.hash].gasUsed),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: "fee_burnt"
    })
  }

  pushType2MinerFee(transaction, block, receipts, result) {
    /***
     * An EIP1559 transaction always pays the base fee of the block it’s included in, and it pays a priority fee
     * as priced by maxPriorityFeePerGas or, if the base fee per gas + maxPriorityFeePerGas exceeds maxFeePerGas,
     * it pays a priority fee as priced by maxFeePerGas minus the base fee per gas.
     *
     * EIP1559 transactions must specify both maxPriorityFeePerGas and maxFeePerGas. They must not specify gasPrice.
     *
     * https://besu.hyperledger.org/en/stable/Concepts/Transactions/Transaction-Types/
     */
    const maxPriorityFeePerGas = this.web3Wrapper.parseValueToBN(transaction['maxPriorityFeePerGas'])
    const maxFeePerGas = this.web3Wrapper.parseValueToBN(transaction['maxFeePerGas'])
    const baseFeePerGas = this.web3Wrapper.parseValueToBN(block.baseFeePerGas)

    const minerFeePerGas = baseFeePerGas.add(maxPriorityFeePerGas).gt(maxFeePerGas) ?
    maxFeePerGas.sub(baseFeePerGas) : maxPriorityFeePerGas

    if (minerFeePerGas > 0) {
      result.push({
        from: transaction.from,
        to: block.miner,
        value: computeGasExpense(this.web3Wrapper, minerFeePerGas, receipts[transaction.hash].gasUsed),
        valueExactBase36: computeGasExpenseBase36(this.web3Wrapper, minerFeePerGas, receipts[transaction.hash].gasUsed),
        blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
        timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
        transactionHash: transaction.hash,
        type: "fee"
      })
    }
  }

/**
 * Legacy Ethereum transactions will still work and be included in blocks, but they will not benefit directly
 * from the new pricing system. This is due to the fact that upgrading from legacy transactions to new transactions
 * results in the legacy transaction's gas_price entirely being consumed either by the base_fee_per_gas and the
 * priority_fee_per_gas.
 *
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md
 **/
  pushPreType2MinerFeePostLondon(transaction, block, receipts, result) {
    const tipMinerPerGas = transaction.gasPrice - block.baseFeePerGas
      if (tipMinerPerGas > 0) {
        result.push({
          from: transaction.from,
          to: block.miner,
          value: computeGasExpense(this.web3Wrapper, tipMinerPerGas, receipts[transaction.hash].gasUsed),
          valueExactBase36: computeGasExpenseBase36(this.web3Wrapper, tipMinerPerGas,
            receipts[transaction.hash].gasUsed),
          blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
          timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
          transactionHash: transaction.hash,
          type: "fee"
        })
      }
  }

  pushFeeMinerPostLondon(transaction, block, receipts, result) {
    if (this.web3Wrapper.parseHexToNumber(transaction.type) >= 2) {
      this.pushType2MinerFee(transaction, block, receipts, result)
    }
    else {
      this.pushPreType2MinerFeePostLondon(transaction, block, receipts, result)
    }
  }

  getPostLondonForkFees(transaction, block, receipts) {
    /**
     * Determining the fees is a three-step process:
     *
     * 1. The base fee is deducted from the max fee, and is burned.
     * 2. If there’s ETH left after the deduction, it is used to pay a tip to the miner, up to a maximum of the max priority fee decided by the user.
     * 3. If there’s still ETH left after the tip, it is refunded to the transaction’s sender.
     */
    const result = []
    this.pushBurntFee(transaction, block, receipts, result)
    this.pushFeeMinerPostLondon(transaction, block, receipts, result)

    return result
  }

  getFeesFromTransactionsInBlock(block, receipts) {
    const result = []
    block.transactions.forEach((transaction) => {
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number)
      const feeTransfers =
        blockNumber >= constants.LONDON_FORK_BLOCK ?
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