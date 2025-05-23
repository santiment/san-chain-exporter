'use strict';
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Exporter } from '../../lib/kafka_storage';
import { HTTPClientInterface } from '../../types';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';


export class UTXOWorker extends BaseWorker {
  private readonly NODE_URL: string;
  private readonly MAX_RETRIES: number;
  private readonly RPC_USERNAME: string;
  private readonly RPC_PASSWORD: string;
  private readonly CONFIRMATIONS: number;
  private readonly DEFAULT_TIMEOUT: number;
  private readonly MAX_CONCURRENT_REQUESTS: number;
  private client: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    this.NODE_URL = settings.NODE_URL;
    this.MAX_RETRIES = settings.MAX_RETRIES;
    this.RPC_PASSWORD = settings.RPC_PASSWORD;
    this.RPC_USERNAME = settings.RPC_USERNAME;
    this.CONFIRMATIONS = settings.CONFIRMATIONS;
    this.DEFAULT_TIMEOUT = settings.DEFAULT_TIMEOUT;
    this.MAX_CONCURRENT_REQUESTS = settings.MAX_CONCURRENT_REQUESTS;

    logger.info(`Connecting to the node ${this.NODE_URL}`);
    this.client = constructRPCClient(this.NODE_URL, this.RPC_USERNAME, this.RPC_PASSWORD, this.DEFAULT_TIMEOUT);
  }

  async init(exporter: Exporter) {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
    await exporter.initPartitioner((event: any) => event['height']);
  }

  async sendRequest(method: string, params: any) {
    return this.client.request(method, params).then(({ result, error }) => {
      if (error) {
        return Promise.reject(error);
      }

      return result;
    });
  }

  async sendRequestWithRetry(method: string, params: object) {
    let retries = 0;
    let retryIntervalMs = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        const response = await this.sendRequest(method, params).catch(err => Promise.reject(err));
        if (response.error || response.result === null) {
          retries++;
          retryIntervalMs += (2000 * retries);
          logger.error(`sendRequest with ${method} failed. Reason: ${response.error}. Retrying for ${retries} time`);
          await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
          continue;
        }
        return response;
      } catch (err: any) {
        retries++;
        retryIntervalMs += (2000 * retries);
        logger.error(
          `Try block in sendRequest for ${method} failed. Reason: ${err.toString()}. Waiting ${retryIntervalMs} and retrying for ${retries} time`
        );
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return Promise.reject(`sendRequest for ${method} failed after ${this.MAX_RETRIES} retries`);
  }

  async fetchBlock(block_index: number) {
    const blockHash = await this.sendRequestWithRetry('getblockhash', [block_index]);
    return await this.sendRequestWithRetry('getblock', [blockHash, 2]);
  }

  getLastNodeBlock = async (): Promise<number> => {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    return blockchainInfo.blocks
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this, this.getLastNodeBlock);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this)

    const numConcurrentRequests = Math.min(this.MAX_CONCURRENT_REQUESTS, toBlock - fromBlock + 1);
    const requests = Array.from({ length: numConcurrentRequests }, (_, i) => this.fetchBlock(this.lastExportedBlock + 1 + i));
    const blocks = await Promise.all(requests);
    this.lastExportedBlock += blocks.length;
    return blocks;
  }
}

