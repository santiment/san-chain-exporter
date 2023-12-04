const constants = require('./constants');

class WithdrawalsDecoder {
  constructor(web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
  }

  getWithdrawal(withdrawal, block, blockNumber) {
    // Node returns value of withdrawal in gwei (10^-9) so we have to multiply it by 10^9
    const gwei_to_wei = Math.pow(10, 9);
    return [{
      from: constants.ETH_WITHDRAWAL,
      to: withdrawal.address,
      value: this.web3Wrapper.parseHexToNumber(withdrawal.amount) * gwei_to_wei,
      valueExactBase36: this.web3Wrapper.parseValueToBN(withdrawal.amount).mul(this.web3.utils.toBN(gwei_to_wei.toString())).toString(36),
      blockNumber: blockNumber,
      timestamp: this.web3Wrapper.parseHexToNumber(block.timestamp),
      transactionHash: `WITHDRAWAL_${blockNumber}`,
      type: 'beacon_withdrawal'
    }];
  }


  getBeaconChainWithdrawals(block, blockNumber) {
    const result = [];
    block.withdrawals.forEach((withdrawal) => {
      const withdrawalTransfer = this.getWithdrawal(withdrawal, block, blockNumber);
      result.push(...withdrawalTransfer);
    });
    return result;
  }
}

module.exports = {
  WithdrawalsDecoder
};
