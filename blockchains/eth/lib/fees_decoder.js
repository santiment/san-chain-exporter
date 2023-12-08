const constants = require('./constants');

class FeesDecoder {
  constructor(web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
  }

  getPreLondonForkFees(transaction, block, receipts) {
    const gasExpense = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    return [{
      from: transaction.from,
      to: block.miner,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
      blockNumber: this.web3Wrapper.parseHexToNumber(transaction.blockNumber),
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: transaction.hash,
      type: 'fee'
    }];
  }

  pushBurntFee(transaction, block, receipts, result) {
    const gasExpense = BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas)) * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    result.push({
      from: transaction.from,
      to: constants.BURN_ADDRESS,
      value: Number(gasExpense),
      valueExactBase36: gasExpense.toString(36),
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
    const tipMinerPerGas = BigInt(this.web3Wrapper.parseHexToNumber(transaction.gasPrice)) - BigInt(this.web3Wrapper.parseHexToNumber(block.baseFeePerGas));
    const gasExpense = tipMinerPerGas * BigInt(this.web3Wrapper.parseHexToNumber(receipts[transaction.hash].gasUsed));
    if (tipMinerPerGas > 0) {
      result.push({
        from: transaction.from,
        to: block.miner,
        value: Number(gasExpense),
        valueExactBase36: gasExpense.toString(36),
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

  getFeesFromTransactionsInBlock(block, blockNumber, receipts) {
    const result = [];
    block.transactions.forEach((transaction) => {
      const feeTransfers =
        constants.IS_ETH && blockNumber >= constants.LONDON_FORK_BLOCK ?
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