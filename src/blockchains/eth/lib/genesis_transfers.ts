import fs from 'fs';
import path from 'path';
import { ETHTransfer } from '../eth_types';
import { Web3Interface } from './web3_wrapper';

const GENESIS_TRANSFERS = fs.readFileSync(path.resolve(__dirname) + '/ethereum_genesis.csv', { encoding: 'utf8' })
  .split('\n')
  .slice(0, -1)
  .map((line) => line.split(',').map((element) => element.trim()));

const GENESIS_TIMESTAMP = 1438269973;

export function getGenesisTransfers(web3Wrapper: Web3Interface): ETHTransfer[] {
  const result: ETHTransfer[] = [];

  const txHashMap: Map<string, number> = new Map();

  GENESIS_TRANSFERS.forEach((transfer) => {
    const [id, from, to, amount] = transfer;
    const wei = web3Wrapper.etherToWei(amount);

    // Used to construct incrementing internal transaction numbers
    const currentCount = txHashMap.get(from) || 0;


    result.push({
      from: 'GENESIS',
      to: to,
      value: wei,
      valueExactBase36: BigInt(wei).toString(36),
      blockNumber: 0,
      timestamp: GENESIS_TIMESTAMP,
      transactionHash: from,
      transactionPosition: currentCount,
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
    type: 'reward'
  });

  return result;
};


