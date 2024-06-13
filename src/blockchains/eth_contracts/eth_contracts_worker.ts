const { groupBy } = require('lodash');
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { fetchEthInternalTrx, fetchBlocks } from '../eth/lib/fetch_data';
import { ETHBlock, Trace } from '../eth/eth_types';
import { HTTPClientInterface } from '../../types';


export class ETHContractsWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);

  }

  decodeBlock(block: ETHBlock): string {
    const decodedBlock: any = {
      hash: block.hash,
      miner: block.miner,
      difficulty: this.web3Wrapper.parseHexToNumberString(block.difficulty),
      totalDifficulty: this.web3Wrapper.parseHexToNumberString(block.totalDifficulty),
      timestamp: this.web3Wrapper.parseHexToNumberString(block.timestamp),
      size: this.web3Wrapper.parseHexToNumber(block.size),
      gasLimit: this.web3Wrapper.parseHexToNumberString(block.gasLimit),
      gasUsed: this.web3Wrapper.parseHexToNumberString(block.gasUsed),
      number: this.web3Wrapper.parseHexToNumber(block.number)
    }

    if (block.minGasPrice !== undefined) {
      decodedBlock.minGasPrice = this.web3Wrapper.parseHexToNumberString(block["minGasPrice"]);
    }

    if (block.difficulty !== undefined) {

    }

    return JSON.stringify(decodedBlock);
  }



// Assuming locate and _address_creator are defined elsewhere
function locate(array, predicate) {
  return array.flatMap((element, index) => predicate(element) ? [index] : []);
}

function addressCreator(traces) {
  // Add your implementation for `_address_creator` here.
  // This is just a placeholder for the equivalent function from the Python code.
  return null;
}

  async work() {
  const workerContext = await analyzeWorkerContext(this);
  setWorkerSleepTime(this, workerContext);
  if (workerContext === NO_WORK_SLEEP) return [];

  const { fromBlock, toBlock } = nextIntervalCalculator(this);
  logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
  const blocks = await fetchBlocks(this.ethClient, this.web3Wrapper, fromBlock, toBlock);
  const createFilter = { traceTypes: ['create'] }
  const traces: Trace[] = await fetchEthInternalTrx(this.ethClient, this.web3Wrapper, fromBlock, toBlock, createFilter);
  const grouped_traces = groupBy(traces, (tx: Trace) => tx.transactionHash);
  grouped_traces = selectTracesWithCreateTrace(grouped_traces, blocks)
  logging.info(f'Fetched {len(traces)} traces of which {len(traces_with_result)} have result')
  const events = Array.from(blocks).map(([key, block]) => this.decodeBlock(block));

  this.lastExportedBlock = toBlock;

  return events;
}

  async init() {
  this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
}
}

type ContractCreation {
  address: string,
  address_fabric: string
  address_creator: string,
  bytecode
}

function selectTracesWithCreateTrace(groupedTraces: { [key: string]: Trace[] }, blockTimes: { [key: number]: number }) {
  const txsWithCreateTrace: { [key: string], { [key: Trace[]], }
} = { };

for (const [tx, traces] of Object.entries(groupedTraces)) {
  const traceTypes = traces.map(trace => trace.type);

  const createTraceIndexes = traceTypes.flatMap((type, index) => type === 'create' ? [index] : []);

  if (createTraceIndexes.length > 0) {
    if (!txsWithCreateTrace.hasOwnProperty(tx)) {
      txsWithCreateTrace[tx] = { traces: traces, records: [] };
    }

    for (const index of createTraceIndexes) {
      const createTrace: Trace = traces[index];
      let addressFabric;

      if (createTrace.traceAddress.length > 0) {
        addressFabric = traces[createTraceIndexes[createTraceIndexes.length - 1]].action.from;
      } else {
        addressFabric = null;
      }

      const record = {
        address: createTrace.result.address,
        address_fabric: addressFabric,
        address_creator: addressCreator(traces),
        bytecode: createTrace.result.code,
        transaction_hash: createTrace.transactionHash,
        block_number: createTrace.blockNumber,
        block_created_at_timestamp: blockTimes[createTrace.blockNumber]
      };

      txsWithCreateTrace[tx].records.push(record);
    }
  }
}

return txsWithCreateTrace;
}

