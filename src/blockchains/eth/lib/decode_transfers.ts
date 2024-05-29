import { Web3Interface } from './web3_wrapper';
import { Trace, ETHTransfer } from '../eth_types';
import { logger } from '../../../lib/logger';

export function decodeTransferTrace(trace: Trace, timestamp: number, web3Wrapper: Web3Interface): ETHTransfer {
  // Block & uncle rewards
  if (trace['type'] === 'reward') {
    if (trace['action']['author'] === undefined) {
      throw Error("'author' field is expected in trace action on 'reward' type")
    }
    if (trace['action']['value'] === undefined) {
      throw Error("'value' field is expected in trace action on 'reward' type")
    }
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
    if (trace['action']['from'] === undefined) {
      throw Error("'from' field is expected in trace action on 'create' type")
    }
    if (trace['action']['value'] === undefined) {
      throw Error("'value' field is expected in trace action on 'create' type")
    }
    if (trace['result']['address'] === undefined) {
      throw Error("'address' field is expected in trace result on 'create' type")
    }
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
    if (trace['action']['refundAddress'] === undefined) {
      throw Error("'refundAddress' field is expected in trace action on 'suicide' type")
    }
    if (trace['action']['address'] === undefined) {
      throw Error("'address' field is expected in trace action on 'suicide' type")
    }
    if (trace['action']['balance'] === undefined) {
      throw Error("'balance' field is expected in trace action on 'suicide' type")
    }
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

  if (trace['action']['from'] === undefined) {
    throw Error(`'from' field is expected in trace action on ${trace['type']} type`)
  }
  if (trace['action']['value'] === undefined) {
    throw Error(`'value' field is expected in trace action on ${trace['type']} type`)
  }
  if (trace['action']['to'] === undefined) {
    throw Error(`'to' field is expected in trace action on ${trace['type']} type`)
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
