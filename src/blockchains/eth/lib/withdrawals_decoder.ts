import * as constants from './constants';
import { Web3Interface } from './web3_wrapper';
import { ETHTransfer, BeaconChainWithdrawal } from '../eth_types';

export class WithdrawalsDecoder {
  private web3Wrapper: Web3Interface;

  constructor(web3Wrapper: Web3Interface) {
    this.web3Wrapper = web3Wrapper;
  }

  getBeaconChainWithdrawals(withdrawals: BeaconChainWithdrawal[], blockNumber: number, blockTimestamp: number): ETHTransfer[] {
    return withdrawals.map((withdrawal, index) => {
      const gweiAmount = this.web3Wrapper.gweiToWei(withdrawal.amount);
      return {
        from: constants.ETH_WITHDRAWAL,
        to: withdrawal.address,
        value: Number(gweiAmount),
        valueExactBase36: gweiAmount.toString(36),
        blockNumber: blockNumber,
        timestamp: blockTimestamp,
        transactionHash: `WITHDRAWAL_${blockNumber}`,
        transactionPosition: 0,
        internalTxPosition: index,
        type: 'beacon_withdrawal'
      };
    });
  }
}


