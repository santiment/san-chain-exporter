import { Trace } from '../../eth/eth_types';
import { assertIsDefined } from '../../../lib/utils';
import { ContractCreationTrace } from './output_validator';
import { validateContractCreationTrace } from './output_validator';


export type ParentTraceActionToCreateTraces = {
  [key: string]: Trace[]
}


export function getCreationOutput(traces: Trace[], blockTime: number): ContractCreationTrace[] {
  const createTraces = traces.filter((trace: Trace) => trace.type === 'create')

  if (createTraces.length > 0) {
    assertIsDefined(traces[0]['action']['from'], "'from' field shoud be set for first trace per tx")
    const outputRecordsPerTx = constructCreationOutput(traces[0].action.from, createTraces, blockTime)
    outputRecordsPerTx.forEach(record => validateContractCreationTrace(record));
    return outputRecordsPerTx
  }
  else {
    return []
  }
}

function constructCreationOutput(parentAddress: string, createTraces: Trace[], blockTime: number):
  ContractCreationTrace[] {

  const result: ContractCreationTrace[] = createTraces.map(trace => {
    assertIsDefined(trace.result.address, "'address' field is expected in trace result on 'create' type")

    const record: ContractCreationTrace = {
      address: trace.result.address,
      address_creator: parentAddress,
      transaction_hash: trace.transactionHash,
      block_number: trace.blockNumber,
      block_created_at_timestamp: blockTime
    }

    if (trace.traceAddress.length > 0) {
      // Note:
      // The code we migrate away from did some more complicated steps at this point:
      // https://github.com/santiment/eth-contracts-exporter/blob/master/main.py#L175
      // It assigned the fabirc to be the 'action.from' of the last create trace for this transaction.
      // I could not figure out what the logic is behind this. I think it should be the 'action.from' of the
      // current trace.
      record.address_fabric = trace.action.from;
    }

    return record;
  });

  return result;
}

