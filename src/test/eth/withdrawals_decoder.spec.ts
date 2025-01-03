import assert from 'assert';

import { WithdrawalsDecoder } from '../../blockchains/eth/lib/withdrawals_decoder';
import { NODE_URL, ETH_WITHDRAWAL } from '../../blockchains/eth/lib/constants';
import { Web3Interface, constructWeb3WrapperNoCredentials } from '../../blockchains/eth/lib/web3_wrapper';
import { ETHTransfer } from '../../blockchains/eth/eth_types';

const web3Wrapper: Web3Interface = constructWeb3WrapperNoCredentials(NODE_URL);

describe('withdrawals decoder test', function () {
  it('basic test', async function () {
    const decoder = new WithdrawalsDecoder(web3Wrapper);

    const withdrawal = {
      index: '0x1a0ce76',
      validatorIndex: '0x2fb8e',
      address: '0x5d386420dcf9afe6b6bf2a9887e5d6abcaf688cc',
      amount: '0x10ac320'
    };

    const result = decoder.getBeaconChainWithdrawals([withdrawal], 18742200, 1702046471);

    const expected: ETHTransfer[] = [{
      from: ETH_WITHDRAWAL,
      to: withdrawal.address,
      value: 17482528000000000,
      valueExactBase36: '4s51ehlpbls',
      blockNumber: 18742200,
      timestamp: 1702046471,
      transactionHash: 'WITHDRAWAL_18742200',
      transactionPosition: 0,
      internalTxPosition: 0,
      type: 'beacon_withdrawal'
    }];

    assert.deepStrictEqual(result, expected);
  });
});
