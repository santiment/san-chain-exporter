import { Web3Static } from './web3_wrapper';
import { Trace, ETHTransfer } from '../eth_types';
import { logger } from '../../../lib/logger';
import { assertIsDefined } from '../../../lib/utils';

// Constructs an ETHTransfer from already-extracted fields.
// Each trace type (reward, create, suicide, call) extracts different fields from the trace,
// but they all produce the same ETHTransfer shape. This builder eliminates that duplication.
export function buildTraceTransfer(
  from: string,
  to: string,
  hexValue: string,
  blockNumber: number,
  timestamp: number,
  transactionHash: string,
  transactionPosition: number,
  type: string
): ETHTransfer {
  return {
    from,
    to,
    value: Number(Web3Static.parseHexToNumber(hexValue)),
    valueExactBase36: Web3Static.parseHexToBase36String(hexValue),
    blockNumber,
    timestamp,
    transactionHash,
    transactionPosition,
    internalTxPosition: 0,
    type,
  };
}

export function decodeTransferTrace(trace: Trace, timestamp: number): ETHTransfer {
  // Block & uncle rewards
  if (trace['type'] === 'reward') {
    assertIsDefined(trace['action']['author'], "'author' field is expected in trace action on 'reward' type");
    assertIsDefined(trace['action']['value'], "'value' field is expected in trace action on 'reward' type");

    return buildTraceTransfer(
      `mining_${trace['action']['rewardType']}`,
      trace['action']['author'],
      trace['action']['value'],
      trace['blockNumber'],
      timestamp,
      trace['transactionHash'] ? trace['transactionHash'] : `mining_${trace['action']['rewardType']}`,
      trace['transactionPosition'] ? trace['transactionPosition'] : 0,
      trace['type']
    );
  }

  // Contract creation
  if (trace['type'] === 'create') {
    assertIsDefined(trace['action']['from'], "'from' field is expected in trace action on 'create' type");
    assertIsDefined(trace['action']['value'], "'value' field is expected in trace action on 'create' type");
    assertIsDefined(trace['result'], "'result' field is expected in trace on 'create' type");
    assertIsDefined(trace['result']['address'], "'address' field is expected in trace result on 'create' type");
    assertIsDefined(trace['transactionHash'], "'transactionHash' field is expected in trace on 'create' type");
    assertIsDefined(trace['transactionPosition'], "'transactionPosition' field is expected in trace on 'create' type");

    return buildTraceTransfer(
      trace['action']['from'],
      trace['result']['address'],
      trace['action']['value'],
      trace['blockNumber'],
      timestamp,
      trace['transactionHash'],
      trace['transactionPosition'],
      trace['type']
    );
  }

  if (trace['type'] === 'suicide') {
    assertIsDefined(trace['action']['refundAddress'], "'refundAddress' field is expected in trace action on 'suicide' type");
    assertIsDefined(trace['action']['address'], "'address' field is expected in trace action on 'suicide' type");
    assertIsDefined(trace['action']['balance'], "'balance' field is expected in trace action on 'suicide' type")
    assertIsDefined(trace['transactionHash'], "'transactionHash' field is expected in trace on 'suicide' type");
    assertIsDefined(trace['transactionPosition'], "'transactionPosition' field is expected in trace on 'suicide' type");

    return buildTraceTransfer(
      trace['action']['address'],
      trace['action']['refundAddress'],
      trace['action']['balance'],
      trace['blockNumber'],
      timestamp,
      trace['transactionHash'],
      trace['transactionPosition'],
      trace['type']
    );
  }

  if (trace['type'] !== 'call') {
    logger.warn('Unknown trace type: ' + JSON.stringify(trace));
  }

  assertIsDefined(trace['action']['from'], `'from' field is expected in trace action on ${trace['type']} type`);
  assertIsDefined(trace['action']['value'], `'value' field is expected in trace action on ${trace['type']} type`);
  assertIsDefined(trace['action']['to'], `'to' field is expected in trace action on ${trace['type']} type`);
  assertIsDefined(trace['transactionHash'], `'transactionHash' field is expected in trace on ${trace['type']} type`);
  assertIsDefined(trace['transactionPosition'], `'transactionPosition' field is expected in trace on ${trace['type']} type`);

  return buildTraceTransfer(
    trace['action']['from'],
    trace['action']['to'],
    trace['action']['value'],
    trace['blockNumber'],
    timestamp,
    trace['transactionHash'],
    trace['transactionPosition'],
    trace['type']
  );
}
