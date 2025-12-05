'use strict';
import { logger } from '../../lib/logger';
import { Exporter } from '../../lib/kafka_storage';
import { constructRPCClient } from '../../lib/http_client';
import { extendEventsWithPrimaryKey } from './lib/extend_events_key';
import { ContractOverwrite, changeContractAddresses, extractChangedContractAddresses } from './lib/contract_overwrite';
import { stableSort, readJsonFile } from './lib/util';
import { BaseWorker } from '../../lib/worker_base';
import { nextIntervalCalculator, setWorkerSleepTime, analyzeWorkerContext, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { Web3Interface, Web3Wrapper, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { TimestampsCache, TimestampsCacheInterface } from './lib/timestamps_cache';
import { getPastEvents } from './lib/fetch_events';
import { initBlocksList } from '../../lib/fetch_blocks_list';
import { HTTPClientInterface } from '../../types';
import { ERC20Transfer } from './erc20_types';
import { extendTransfersWithBalances } from './lib/add_balances'
import { buildInclusiveChunks } from './lib/chunk_utils';


/**
 * A simple non cryptographic hash function similar to Java's 'hashCode'
 * @param {string} input A string input
 * @returns {number} A 32 bit positive integer
 */
function simpleHash(input: string): number {
  var hash = 0, i, chr;

  if (input.length === 0) return hash;

  for (i = 0; i < input.length; i++) {
    chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

type RequestRecorder = (count: number) => void;

class TrackingHttpClient implements HTTPClientInterface {
  private client: HTTPClientInterface;
  private recordRequest: RequestRecorder;

  constructor(client: HTTPClientInterface, recordRequest: RequestRecorder) {
    this.client = client;
    this.recordRequest = recordRequest;
  }

  request(method: string, params: any[], id?: string | number): Promise<any> {
    this.recordRequest(1);
    return this.client.request(method, params, id);
  }

  requestBulk(requests: any[]): Promise<any> {
    const batchSize = Array.isArray(requests) ? requests.length : 1;
    this.recordRequest(batchSize);
    return this.client.requestBulk(requests);
  }

  generateRequest(method: string, params: any[]): any {
    return this.client.generateRequest(method, params);
  }
}

export class ERC20Worker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;
  private getPastEventsFun: (web3Wrapper: Web3Interface, from: number, to: number, contractAddresses: string | string[] | null,
    timestampsCache: TimestampsCacheInterface) => Promise<ERC20Transfer[]> = getPastEvents;
  private contractsOverwriteArray: ContractOverwrite[];
  private contractsUnmodified: string[];
  // This field is heavily tested in unit tests. Most probably we should change this and instead assert only the
  // overall logic, not the state of member variables.
  public blocksList: [number, number][];

  private allOldContracts: string[];
  private requestsSinceLastReport: number;


  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.requestsSinceLastReport = 0;
    this.web3Wrapper = this.attachWeb3RequestTracker(
      constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD)
    );
    const rawEthClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);
    this.ethClient = new TrackingHttpClient(rawEthClient, (count: number) => this.recordNodeRequests(count));
    this.contractsOverwriteArray = [];
    this.contractsUnmodified = [];
    this.allOldContracts = [];
    this.blocksList = [];
  }

  async init(exporter?: Exporter) {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;

    if (this.settings.EXPORT_BLOCKS_LIST) {
      this.blocksList = initBlocksList();
    }

    if (this.settings.CONTRACT_MODE !== 'vanilla') {
      const parsedContracts = await readJsonFile(this.settings.CONTRACT_MAPPING_FILE_PATH);

      if (parsedContracts.modified_contracts) {
        this.contractsOverwriteArray = parsedContracts.modified_contracts.map((contract: any) => new ContractOverwrite(contract));
        this.allOldContracts = this.contractsOverwriteArray.flatMap((obj: any) => obj.oldAddresses);
      }
      if (parsedContracts.unmodified_contracts) {
        this.contractsUnmodified = parsedContracts.unmodified_contracts.map((contract: any) => contract.toLowerCase());
      }

      logger.info(`Running in '${this.settings.CONTRACT_MODE}' contracts mode', ` +
        `${this.contractsOverwriteArray.length + this.contractsUnmodified.length} contracts will be monitored.`);
      logger.info(`Overwritten contracts are: ${JSON.stringify(this.contractsOverwriteArray)}`);
      logger.info(`Extracted unmodified contracts are: ${JSON.stringify(this.contractsUnmodified)}`);
    }

    if (this.settings.EVENTS_IN_SAME_PARTITION) {
      if (exporter === undefined) {
        throw Error('Exporter reference need to be provided for events in same partition')
      }
      await exporter.initPartitioner((event: object) => simpleHash((event as ERC20Transfer).contract));
    }

    this.resetNodeRequestsCounter();
  }

  getBlocksListInterval(): { success: true; fromBlock: number; toBlock: number } | { success: false } {
    if (this.lastExportedBlock === -1 && this.blocksList.length > 0) {
      return {
        success: true,
        fromBlock: this.blocksList[0][0],
        toBlock: this.blocksList[0][1]
      };
    }
    while (this.blocksList.length > 0 && this.lastExportedBlock >= this.blocksList[0][1]) {
      this.blocksList.shift();
    }
    if (this.blocksList.length === 0) {
      return { success: false };
    }
    return {
      success: true,
      fromBlock: this.blocksList[0][0],
      toBlock: this.blocksList[0][1]
    };
  }

  async work(): Promise<ERC20Transfer[]> {
    const workerContext = await analyzeWorkerContext(this, () => this.web3Wrapper.getBlockNumber());
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    let interval: { fromBlock: number; toBlock: number };
    if (this.settings.EXPORT_BLOCKS_LIST) {
      const blocksListInterval = this.getBlocksListInterval();
      if (!blocksListInterval.success) {
        return [];
      }
      interval = {
        fromBlock: blocksListInterval.fromBlock,
        toBlock: blocksListInterval.toBlock
      };
    }
    else {
      interval = nextIntervalCalculator(this.lastExportedBlock, this.settings.BLOCK_INTERVAL, this.lastConfirmedBlock);
    }

    logger.info(`Fetching transfer events for interval ${interval.fromBlock}:${interval.toBlock}`);

    let events: ERC20Transfer[] = [];
    let overwritten_events: ERC20Transfer[] = [];
    const timestampsCache = new TimestampsCache(this.ethClient, interval.fromBlock, interval.toBlock);
    const shouldExtendWithBalances = this.settings.EXTEND_TRANSFERS_WITH_BALANCES
      && interval.fromBlock > this.settings.MULTICALL_DEPLOY_BLOCK;
    if ('extract_exact_overwrite' === this.settings.CONTRACT_MODE) {
      const oldContractsPromise = this.allOldContracts.length > 0
        ? (async () => {
          const oldEvents = await this.fetchPastEvents(
            interval.fromBlock,
            interval.toBlock,
            this.allOldContracts,
            timestampsCache
          );
          if (shouldExtendWithBalances) {
            await extendTransfersWithBalances(
              (this.web3Wrapper as Web3Wrapper).getWeb3(),
              oldEvents,
              this.settings.MULTICALL_BATCH_SIZE,
              this.settings.MAX_CONNECTION_CONCURRENCY,
              this.settings.MULTICALL_ADDRESS
            );
          }
          changeContractAddresses(oldEvents, this.contractsOverwriteArray);
          return oldEvents;
        })()
        : Promise.resolve<ERC20Transfer[]>([]);

      const unmodifiedContractsPromise = this.contractsUnmodified.length > 0
        ? (async () => {
          const rawEvents = await this.fetchPastEvents(
            interval.fromBlock,
            interval.toBlock,
            this.contractsUnmodified,
            timestampsCache
          );
          if (shouldExtendWithBalances) {
            await extendTransfersWithBalances(
              (this.web3Wrapper as Web3Wrapper).getWeb3(),
              rawEvents,
              this.settings.MULTICALL_BATCH_SIZE,
              this.settings.MAX_CONNECTION_CONCURRENCY,
              this.settings.MULTICALL_ADDRESS
            );
          }
          return rawEvents;
        })()
        : Promise.resolve<ERC20Transfer[]>([]);

      const [oldEvents, unmodifiedEvents] = await Promise.all([oldContractsPromise, unmodifiedContractsPromise]);
      events = oldEvents.concat(unmodifiedEvents);
    }
    else {
      events = await this.fetchPastEvents(interval.fromBlock, interval.toBlock, null, timestampsCache);
      if (shouldExtendWithBalances) {
        await extendTransfersWithBalances((this.web3Wrapper as Web3Wrapper).getWeb3(), events,
          this.settings.MULTICALL_BATCH_SIZE, this.settings.MAX_CONNECTION_CONCURRENCY,
          this.settings.MULTICALL_ADDRESS);
      }
      if ('extract_all_append' === this.settings.CONTRACT_MODE) {
        overwritten_events = extractChangedContractAddresses(events, this.contractsOverwriteArray);
      }
    }

    if (events.length > 0) {
      extendEventsWithPrimaryKey(events, overwritten_events);
      logger.info(`Setting primary keys ${events.length} messages for blocks ${interval.fromBlock}:${interval.toBlock}`);
      const lastPrimaryKey = events[events.length - 1].primaryKey;
      if (typeof lastPrimaryKey !== 'number') {
        throw new Error('Primary keys should be set to number before event');
      }
      this.lastPrimaryKey = lastPrimaryKey;
    }

    this.lastExportedBlock = interval.toBlock;
    const resultEvents = events.concat(overwritten_events);

    // If overwritten events have been generated, they need to be merged into the original events
    if (overwritten_events.length > 0) {
      stableSort(resultEvents, function primaryKeyOrder(a: ERC20Transfer, b: ERC20Transfer) {
        const blockDif = a.blockNumber - b.blockNumber;
        if (blockDif !== 0) {
          return blockDif;
        }
        else if (a.logIndex !== b.logIndex) {
          return a.logIndex - b.logIndex;
        }
        if (typeof a.primaryKey !== 'number' || typeof b.primaryKey !== 'number') {
          throw Error('Primary keys should be set to number before event')
        }
        return a.primaryKey - b.primaryKey;
      });
    }

    return resultEvents;
  }

  getNewRequestsCount(): number {
    const requests = this.requestsSinceLastReport;
    this.requestsSinceLastReport = 0;
    return requests;
  }

  private async fetchPastEvents(fromBlock: number, toBlock: number, contractAddresses: string | string[] | null,
    timestampsCache: TimestampsCacheInterface): Promise<ERC20Transfer[]> {
    if (Array.isArray(contractAddresses) && contractAddresses.length === 0) {
      return [];
    }

    if (fromBlock > toBlock) {
      return [];
    }

    const totalRange = toBlock - fromBlock + 1;
    if (totalRange <= 0) {
      return [];
    }
    const concurrencyLimit = this.settings.MAX_CONNECTION_CONCURRENCY;

    const chunkCount = Math.min(concurrencyLimit, totalRange);
    const chunkSize = Math.ceil(totalRange / chunkCount);
    const blockChunks = buildInclusiveChunks(fromBlock, toBlock, chunkSize);

    const chunkPromises = blockChunks.map(([chunkFrom, chunkTo]) =>
      this.getPastEventsFun(this.web3Wrapper, chunkFrom, chunkTo, contractAddresses, timestampsCache)
    );

    const results = await Promise.all(chunkPromises);
    return results.flat();
  }

  private attachWeb3RequestTracker(web3Wrapper: Web3Interface): Web3Interface {
    const candidate = web3Wrapper as Web3Wrapper;
    if (typeof candidate.getWeb3 !== 'function') {
      logger.warn('Web3 wrapper does not expose getWeb3(); RPC requests from Web3 may not be tracked.');
      return web3Wrapper;
    }

    const web3 = candidate.getWeb3();
    if (!web3) {
      logger.warn('Web3 instance is missing; RPC requests from Web3 may not be tracked.');
      return web3Wrapper;
    }

    const provider: any = (web3 as any).currentProvider || (web3 as any).provider;
    if (!provider || typeof provider !== 'object') {
      logger.warn('Web3 provider is missing or invalid; RPC requests from Web3 may not be tracked.');
      return web3Wrapper;
    }

    this.patchProviderMethod(provider, 'request');
    this.patchProviderMethod(provider, 'send');
    this.patchProviderMethod(provider, 'sendAsync');

    return web3Wrapper;
  }

  private patchProviderMethod(provider: any, methodName: 'request' | 'send' | 'sendAsync') {
    const current = provider[methodName];
    if (typeof current !== 'function' || current.__sanRequestTrackerPatched) {
      return;
    }

    const boundOriginal = current.bind(provider);
    const worker = this;
    const tracked = function (payload: any, ...args: any[]) {
      const batchSize = Array.isArray(payload) ? payload.length : 1;
      worker.recordNodeRequests(batchSize);
      return boundOriginal(payload, ...args);
    };
    const trackedWithFlag = tracked as any;
    trackedWithFlag.__sanRequestTrackerPatched = true;
    provider[methodName] = trackedWithFlag;
  }

  private recordNodeRequests(count: number) {
    if (count <= 0) {
      logger.error(`Attempted to record non-positive node request count: ${count}`);
      return;
    }
    this.requestsSinceLastReport += count;
  }

  private resetNodeRequestsCounter() {
    this.requestsSinceLastReport = 0;
  }
}
