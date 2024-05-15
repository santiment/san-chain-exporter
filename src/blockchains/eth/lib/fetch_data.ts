import jayson from 'jayson/promise';
import { filterErrors } from './filter_errors';
import Web3Wrapper from './web3_wrapper';
import { Trace, Block } from '../eth_types';


export function parseEthInternalTrx(result: Trace[]) {
  const traces = filterErrors(result);

  return traces
    .filter((trace: Trace) =>
      trace['action']['value'] !== '0x0' &&
      trace['action']['balance'] !== '0x0' &&
      !(trace['type'] === 'call' && trace['action']['callType'] !== 'call')
    );
}

export function fetchEthInternalTrx(ethClient: jayson.HttpClient | jayson.HttpsClient,
  web3Wrapper: Web3Wrapper, fromBlock: number, toBlock: number) {
  return ethClient.request('trace_filter', [{
    fromBlock: web3Wrapper.parseNumberToHex(fromBlock),
    toBlock: web3Wrapper.parseNumberToHex(toBlock)
  }]).then((data: any) => parseEthInternalTrx(data['result']));
}

export async function fetchBlocks(ethClient: jayson.HttpClient | jayson.HttpsClient,
  web3Wrapper: Web3Wrapper, fromBlock: number, toBlock: number): Promise<Map<number, Block>> {
  const blockRequests = [];
  for (let i = fromBlock; i <= toBlock; i++) {
    blockRequests.push(
      ethClient.request(
        'eth_getBlockByNumber',
        [web3Wrapper.parseNumberToHex(i), true],
        undefined,
        false
      )
    );
  }

  const responses = await ethClient.request(blockRequests);
  const result = new Map();
  responses.forEach((response: any, index: number) => result.set(fromBlock + index, response.result));
  return result;
}

export async function fetchReceipts(ethClient: jayson.HttpClient | jayson.HttpsClient,
  web3Wrapper: Web3Wrapper, receiptsAPIMethod: string, fromBlock: number, toBlock: number) {
  const batch = [];
  for (let currBlock = fromBlock; currBlock <= toBlock; currBlock++) {
    batch.push(
      ethClient.request(
        receiptsAPIMethod,
        [web3Wrapper.parseNumberToHex(currBlock)],
        undefined,
        false
      )
    );
  }
  const finishedRequests = await ethClient.request(batch);
  const result: any = {};

  finishedRequests.forEach((response: any) => {
    if (response.result) {
      response.result.forEach((receipt: any) => {
        result[receipt.transactionHash] = receipt;
      });
    }
    else {
      throw new Error(JSON.stringify(response));
    }
  });

  return result;
}

