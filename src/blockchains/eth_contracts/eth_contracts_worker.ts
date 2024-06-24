const { groupBy } = require('lodash');
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { fetchEthInternalTrx } from '../eth/lib/fetch_data';
import { ETHBlock, Trace } from '../eth/eth_types';
import { HTTPClientInterface } from '../../types';
import { TimestampsCache } from '../erc20/lib/timestamps_cache';
import { assertIsDefined } from '../../lib/utils';


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

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
    const createFilter = { traceTypes: ['create'] }
    const traces: Trace[] = await fetchEthInternalTrx(this.ethClient, this.web3Wrapper, fromBlock, toBlock, createFilter);
    const groupedTraces = groupBy(traces, (tx: Trace) => tx.transactionHash);
    const timestampsCache = new TimestampsCache(this.ethClient, this.web3Wrapper, fromBlock, toBlock);
    const events = selectTracesWithCreateTrace(groupedTraces, timestampsCache)

    this.lastExportedBlock = toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

type ContractCreationTrace = {
  address: string,
  address_fabric?: string
  address_creator: string,
  bytecode: string,
  transaction_hash: string,
  block_number: number,
  block_created_at_timestamp: number
}

type ContractCreationTracePerTx = {
  [key: string]: ContractCreationTrace[]
}

function selectTracesWithCreateTrace(groupedTraces: { [key: string]: Trace[] }, blockTimes: TimestampsCache):
  ContractCreationTrace[] {
  const txsWithCreateTrace: ContractCreationTracePerTx = {};

  for (const [tx, traces] of Object.entries(groupedTraces)) {
    const traceTypes = traces.map(trace => trace.type);

    const createTraceIndexes = traceTypes.flatMap((type, index) => type === 'create' ? [index] : []);

    if (createTraceIndexes.length > 0) {
      if (!txsWithCreateTrace.hasOwnProperty(tx)) {
        txsWithCreateTrace[tx] = [];
      }

      for (const index of createTraceIndexes) {
        const createTrace: Trace = traces[index];

        assertIsDefined(createTrace.result.address, "'address' field is expected in trace result on 'create' type")
        assertIsDefined(traces[0]['action']['from'], "'from' field shoud be set for first trace per tx")
        assertIsDefined((createTrace.result as any).code, "'code' field should be set on create trace")


        const record: ContractCreationTrace = {
          address: createTrace.result.address,
          address_creator: traces[0]['action']['from'],
          bytecode: (createTrace.result as any).code,
          transaction_hash: createTrace.transactionHash,
          block_number: createTrace.blockNumber,
          block_created_at_timestamp: blockTimes.getBlockTimestamp(createTrace.blockNumber)
        };

        if (createTrace.traceAddress.length > 0) {
          record.address_fabric = traces[createTraceIndexes[createTraceIndexes.length - 1]].action.from;
        }

        txsWithCreateTrace[tx].push(record);
      }
    }
  }

  return Object.values(txsWithCreateTrace).flat();
}

