const constants = require('./constants');

class WithdrawalsDecoder {
  constructor(web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
  }

  getBeaconChainWithdrawals(withdrawals, blockNumber, blockTimestamp) {
    return withdrawals.map((withdrawal) => {
      const gweiAmount = BigInt(this.web3Wrapper.gweiToWei(withdrawal.amount));
      return {
        from: constants.ETH_WITHDRAWAL,
        to: withdrawal.address,
        value: Number(gweiAmount),
        valueExactBase36: gweiAmount.toString(36),
        blockNumber: blockNumber,
        timestamp: blockTimestamp,
        transactionHash: `WITHDRAWAL_${blockNumber}`,
        type: 'beacon_withdrawal'
      };
    });
  }
}

module.exports = {
  WithdrawalsDecoder
};
