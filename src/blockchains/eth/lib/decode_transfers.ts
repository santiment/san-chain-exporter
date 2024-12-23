import { Web3Interface } from './web3_wrapper';
import { Trace, ETHTransfer } from '../eth_types';
import { logger } from '../../../lib/logger';
import { assertIsDefined } from '../../../lib/utils';

export function decodeTransferTrace(trace: Trace, timestamp: number, web3Wrapper: Web3Interface): ETHTransfer {
  // Block & uncle rewards
  if (trace['type'] === 'reward') {
    assertIsDefined(trace['action']['author'], "'author' field is expected in trace action on 'reward' type");
    assertIsDefined(trace['action']['value'], "'value' field is expected in trace action on 'reward' type");

    return {
      from: `mining_${trace['action']['rewardType']}`,
      to: trace['action']['author'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      internalTxPosition: 0,
      type: trace['type']
    };
  }

  // Contract creation
  if (trace['type'] === 'create') {
    assertIsDefined(trace['action']['from'], "'from' field is expected in trace action on 'create' type");
    assertIsDefined(trace['action']['value'], "'value' field is expected in trace action on 'create' type");
    assertIsDefined(trace['result']['address'], "'address' field is expected in trace result on 'create' type");

    return {
      from: trace['action']['from'],
      to: trace['result']['address'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      internalTxPosition: 0,
      type: trace['type']
    };
  }

  if (trace['type'] === 'suicide') {
    assertIsDefined(trace['action']['refundAddress'], "'refundAddress' field is expected in trace action on 'suicide' type");
    assertIsDefined(trace['action']['address'], "'address' field is expected in trace action on 'suicide' type");
    assertIsDefined(trace['action']['balance'], "'balance' field is expected in trace action on 'suicide' type")

    return {
      from: trace['action']['address'],
      to: trace['action']['refundAddress'],
      value: Number(web3Wrapper.parseHexToNumber(trace['action']['balance'])),
      valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['balance']),
      blockNumber: trace['blockNumber'],
      timestamp: timestamp,
      transactionHash: trace['transactionHash'],
      transactionPosition: trace['transactionPosition'],
      internalTxPosition: 0,
      type: trace['type']
    };
  }

  if (trace['type'] !== 'call') {
    logger.warn('Unknown trace type: ' + JSON.stringify(trace));
  }

  assertIsDefined(trace['action']['from'], `'from' field is expected in trace action on ${trace['type']} type`);
  assertIsDefined(trace['action']['value'], `'value' field is expected in trace action on ${trace['type']} type`);
  assertIsDefined(trace['action']['to'], `'to' field is expected in trace action on ${trace['type']} type`);

  return {
    from: trace['action']['from'],
    to: trace['action']['to'],
    value: Number(web3Wrapper.parseHexToNumber(trace['action']['value'])),
    valueExactBase36: web3Wrapper.parseHexToBase36String(trace['action']['value']),
    blockNumber: trace['blockNumber'],
    timestamp: timestamp,
    transactionHash: trace['transactionHash'],
    transactionPosition: trace['transactionPosition'],
    internalTxPosition: 0,
    type: trace['type']
  };
}
