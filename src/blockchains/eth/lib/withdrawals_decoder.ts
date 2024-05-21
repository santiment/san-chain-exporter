const constants = require('./constants');
import Web3Wrapper from './web3_wrapper';
import { ETHTransfer, BeaconChainWithdrawal } from '../eth_types';

export class WithdrawalsDecoder {
  private web3Wrapper: Web3Wrapper;

  constructor(web3Wrapper: Web3Wrapper) {
    this.web3Wrapper = web3Wrapper;
  }

  getBeaconChainWithdrawals(withdrawals: BeaconChainWithdrawal[], blockNumber: number, blockTimestamp: number): ETHTransfer[] {
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
