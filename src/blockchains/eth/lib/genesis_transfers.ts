import fs from 'fs';
import path from 'path';
import { ETHTransfer } from '../eth_types';
import { Web3Static } from './web3_wrapper';

const GENESIS_TRANSFERS = fs.readFileSync(path.resolve(__dirname) + '/ethereum_genesis.csv', { encoding: 'utf8' })
  .split('\n')
  .slice(0, -1)
  .map((line) => line.split(',').map((element) => element.trim()));

const GENESIS_TIMESTAMP = 1438269973;

export function getGenesisTransfers(): ETHTransfer[] {
  const result: ETHTransfer[] = [];
  GENESIS_TRANSFERS.forEach((transfer) => {
    const [id, from, to, amount] = transfer;
    const wei = Web3Static.etherToWei(amount);

    result.push({
      from: 'GENESIS',
      to: to,
      value: wei,
      valueExactBase36: BigInt(wei).toString(36),
      blockNumber: 0,
      timestamp: GENESIS_TIMESTAMP,
      transactionHash: from,
      transactionPosition: 0,
      internalTxPosition: 0,
      type: 'genesis'
    });
  });

  result.push({
    from: 'mining_block',
    to: '0x0000000000000000000000000000000000000000',
    value: 5000000000000000000,
    valueExactBase36: BigInt('5000000000000000000').toString(36),
    blockNumber: 0,
    timestamp: GENESIS_TIMESTAMP,
    transactionHash: 'GENESIS_mining_tx',
    transactionPosition: 0,
    internalTxPosition: 0,
    type: 'reward'
  });

  return result;
};


