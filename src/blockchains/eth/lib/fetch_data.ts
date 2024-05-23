import { filterErrors } from './filter_errors';
import { Web3Interface } from './web3_wrapper';
import { Trace, ETHBlock, ETHReceiptsMap, ETHReceipt } from '../eth_types';
import { HTTPClientInterface } from '../../../types'


export function parseEthInternalTrx(result: Trace[]): Trace[] {
  const traces = filterErrors(result);

  return traces
    .filter((trace: Trace) =>
      trace['action']['value'] !== '0x0' &&
      trace['action']['balance'] !== '0x0' &&
      !(trace['type'] === 'call' && trace['action']['callType'] !== 'call')
    );
}

export function fetchEthInternalTrx(ethClient: HTTPClientInterface,
  web3Wrapper: Web3Interface, fromBlock: number, toBlock: number): Promise<Trace[]> {
  return ethClient.request('trace_filter', [{
    fromBlock: web3Wrapper.parseNumberToHex(fromBlock),
    toBlock: web3Wrapper.parseNumberToHex(toBlock)
  }]).then((data: any) => parseEthInternalTrx(data['result']));
}

export async function fetchBlocks(ethClient: HTTPClientInterface,
  web3Wrapper: Web3Interface, fromBlock: number, toBlock: number): Promise<Map<number, ETHBlock>> {
  const blockRequests: any[] = [];
  for (let i = fromBlock; i <= toBlock; i++) {
    blockRequests.push(
      ethClient.generateRequest(
        'eth_getBlockByNumber',
        [web3Wrapper.parseNumberToHex(i), true]
      )
    );
  }

  const responses = await ethClient.requestBulk(blockRequests);
  const result = new Map();
  responses.forEach((response: any, index: number) => result.set(fromBlock + index, response.result));
  return result;
}

export async function fetchReceipts(ethClient: HTTPClientInterface,
  web3Wrapper: Web3Interface, receiptsAPIMethod: string, fromBlock: number, toBlock: number): Promise<ETHReceiptsMap> {
  const batch: any[] = [];
  for (let currBlock = fromBlock; currBlock <= toBlock; currBlock++) {
    batch.push(
      ethClient.generateRequest(
        receiptsAPIMethod,
        [web3Wrapper.parseNumberToHex(currBlock)]
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

