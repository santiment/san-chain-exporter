import Web3Wrapper from './web3_wrapper';
import { Trace, ETHTransfer } from '../eth_types';

const { logger } = require('../../../lib/logger');

export function decodeTransferTrace(trace: Trace, timestamp: number, web3Wrapper: Web3Wrapper): ETHTransfer {
  // Block & uncle rewards
  if (trace['type'] === 'reward') {
    return {
      from: `mining_${trace['action']['rewardType']}`,
      to: trace['action']['author'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      type: trace['type']
    };
  }

  // Contract creation
  if (trace['type'] === 'create') {
    return {
      from: trace['action']['from'],
      to: trace['result']['address'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      type: trace['type']
    };
  }

  if (trace['type'] === 'suicide') {
    return {
      from: trace['action']['address'],
      to: trace['action']['refundAddress'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['balance'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['balance']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      type: trace['type']
    };
  }

  if (trace['type'] !== 'call') {
    logger.warn('Unknown trace type: ' + JSON.stringify(trace));
  }

  return {
    from: trace['action']['from'],
    to: trace['action']['to'],
    value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
    valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
    blockNumber: trace['blockNumber'],
    timestamp: timestamp,
    transactionHash: trace['transactionHash'],
    transactionPosition: trace['transactionPosition'],
    type: trace['type']
  };
}

module.exports = {
  decodeTransferTrace
};
