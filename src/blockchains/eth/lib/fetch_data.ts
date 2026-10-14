import { z } from "zod"
import { logger } from '../../../lib/logger';
import { filterErrors } from './filter_errors';
import { Web3Interface, Web3Static } from './web3_wrapper';
import { Trace, TraceSchema, ETHBlock, ETHReceiptsMap, ETHReceipt } from '../eth_types';
import { HTTPClientInterface } from '../../../types'

// Reth's JSON-RPC error code for a response exceeding --rpc.max-response-size.
export const RESPONSE_TOO_BIG_CODE = -32008;

export class ResponseTooBigError extends Error { }

export function parseEthInternalTrx(traceFilterResult: any[], isETH: boolean, theMergeBlockNumber: number): Trace[] {
  const traces = filterErrors(traceFilterResult).map(t => {
    try {
      return TraceSchema.parse(t)
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Validation failed:\n', error.toString())
        logger.error('Trying to parse object:\n', JSON.stringify(t));
      } else {
        logger.error('An unexpected error occurred:', error);
      }
      throw error
    }
  })

  return traces
    .filter((trace: Trace) =>
      trace['action']['value'] !== '0x0' &&
      trace['action']['balance'] !== '0x0' &&
      !(trace['type'] === 'call' && trace['action']['callType'] !== 'call') &&
      (trace['type'] !== 'reward' || !isETH || trace.blockNumber < theMergeBlockNumber)
    );
}

export function fetchEthInternalTrx(ethClient: HTTPClientInterface, web3Wrapper: Web3Interface, fromBlock: number,
  toBlock: number, isETH: boolean, theMergeBlockNumber: number): Promise<Trace[]> {
  const filterParams = {
    fromBlock: Web3Static.parseNumberToHex(fromBlock),
    toBlock: Web3Static.parseNumberToHex(toBlock)
  };
  return ethClient.request('trace_filter', [filterParams]).then((data: any) => {
    if (data['error']) {
      const message = `trace_filter for interval ${fromBlock}:${toBlock} failed: ${JSON.stringify(data['error'])}`;
      if (data['error']['code'] === RESPONSE_TOO_BIG_CODE) {
        throw new ResponseTooBigError(message);
      }
      throw new Error(message);
    }
    return parseEthInternalTrx(data['result'], isETH, theMergeBlockNumber);
  });
}

export async function fetchBlocks(ethClient: HTTPClientInterface, fromBlock: number, toBlock: number,
  getTransactionDetails: boolean): Promise<Map<number, ETHBlock>> {
  const blockRequests: any[] = [];
  for (let i = fromBlock; i <= toBlock; i++) {
    blockRequests.push(
      ethClient.generateRequest(
        'eth_getBlockByNumber',
        [Web3Static.parseNumberToHex(i), getTransactionDetails]
      )
    );
  }

  const responses = await ethClient.requestBulk(blockRequests);
  const result = new Map();
  responses.forEach((response: any, index: number) => {
    result.set(fromBlock + index, response.result)
  });
  return result;
}

export async function fetchReceipts(ethClient: HTTPClientInterface,
  web3Wrapper: Web3Interface, receiptsAPIMethod: string, fromBlock: number, toBlock: number): Promise<ETHReceiptsMap> {
  const batch: any[] = [];
  for (let currBlock = fromBlock; currBlock <= toBlock; currBlock++) {
    batch.push(
      ethClient.generateRequest(
        receiptsAPIMethod,
        [Web3Static.parseNumberToHex(currBlock)]
      )
    );
  }
  const finishedRequests = await ethClient.requestBulk(batch);
  const result: ETHReceiptsMap = {};

  finishedRequests.forEach((response: any) => {
    if (response.result) {
      response.result.forEach((receipt: ETHReceipt) => {
        result[receipt.transactionHash] = receipt;
      });
    }
    else {
      throw new Error(JSON.stringify(response));
    }
  });

  return result;
}

