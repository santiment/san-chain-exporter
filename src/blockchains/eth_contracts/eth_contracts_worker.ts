const { groupBy } = require('lodash');
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper, Web3Static } from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { Trace } from '../eth/eth_types';
import { HTTPClientInterface } from '../../types';
import { TimestampsCache } from '../erc20/lib/timestamps_cache';
import { filterErrors } from '../eth/lib/filter_errors';
import { getCreationOutput } from './lib/transform_create_traces';


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

  async fetchTraces(fromBlock: number, toBlock: number): Promise<Trace[]> {
    const filterParams = {
      fromBlock: Web3Static.parseNumberToHex(fromBlock),
      toBlock: Web3Static.parseNumberToHex(toBlock)
    };

    return await this.ethClient.request('trace_filter', [filterParams]).then((data: any) => filterErrors(data['result']));
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
    const traces: Trace[] = await this.fetchTraces(fromBlock, toBlock);
    const groupedTraces: { [key: string]: Trace[] } = groupBy(traces, (tx: Trace) => tx.transactionHash);
    const timestampsCache = new TimestampsCache(this.ethClient, fromBlock, toBlock);
    await timestampsCache.waitResponse();
    const outputRecords = Object.values(groupedTraces).flatMap((traces: Trace[]) => {
      return getCreationOutput(traces, timestampsCache.getBlockTimestamp(traces[0].blockNumber))
    })

    this.lastExportedBlock = toBlock;

    return outputRecords;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}





