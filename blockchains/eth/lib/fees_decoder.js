const { computeGasExpense, computeGasExpenseBase36 } = require('./util');
const constants = require('./constants');

class FeesDecoder {
  constructor(web3, web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
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
      type: 'fee'
    }];
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
      type: 'fee_burnt'
    });
  }

  /**
   * We depend on:
   * "Block validity is defined in the reference implementation below. The GASPRICE (0x3a) opcode MUST return the
   * effective_gas_price as defined in the reference implementation below."
   *
   * 'gasPrice' would be set to gas price paid by the signer of the transaction no matter if the transaction is
   * 'type 0, 1 or 2.
   *
   * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1559.md
   **/
  pushMinerFee(transaction, block, receipts, result) {
    const tipMinerPerGas = transaction.gasPrice - block.baseFeePerGas;
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
          type: 'fee'
        });
      }
  }

  getPostLondonForkFees(transaction, block, receipts) {
    const result = [];
    this.pushBurntFee(transaction, block, receipts, result);
    this.pushMinerFee(transaction, block, receipts, result);

    return result;
  }

  getFeesFromTransactionsInBlock(block, receipts) {
    const result = [];
    block.transactions.forEach((transaction) => {
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      const feeTransfers =
        blockNumber >= constants.LONDON_FORK_BLOCK ?
        this.getPostLondonForkFees(transaction, block, receipts) :
        this.getPreLondonForkFees(transaction, block, receipts);

      result.push(...feeTransfers);
    });
    return result;
  }
}

module.exports = {
  FeesDecoder
};