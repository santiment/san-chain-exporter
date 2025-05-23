import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { HTTPClientInterface } from '../../types';
import { extendEventsWithPrimaryKey } from '../erc20/lib/extend_events_key';
import { getPastEvents } from './lib/fetch_events';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { ERC20Transfer } from '../erc20/erc20_types';
import { assertIsDefined } from '../../lib/utils';


export class MaticWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Polygon node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this, this.web3Wrapper.getBlockNumber);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const result = nextIntervalCalculator(this.lastExportedBlock, this.settings.BLOCK_INTERVAL, this.lastConfirmedBlock);

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);

    const events: ERC20Transfer[] = await getPastEvents(this.ethClient, this.web3Wrapper, result.fromBlock, result.toBlock);

    if (events.length > 0) {
      logger.info(`Setting primary keys ${events.length} messages for blocks ${result.fromBlock}:${result.toBlock}`);
      extendEventsWithPrimaryKey(events);
      const lastPrimaryKey = events[events.length - 1].primaryKey
      assertIsDefined(lastPrimaryKey, 'Primary keys should be set');
      this.lastPrimaryKey = lastPrimaryKey;
    }

    this.lastExportedBlock = result.toBlock;
    return events;

  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}


