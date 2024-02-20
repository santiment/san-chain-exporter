'use strict';
import jayson from 'jayson/promise';
import {logger} from '../../lib/logger';
import {constructRPCClient} from '../../lib/http_client';
import BaseWorker from '../../lib/worker_base';
import { Exporter } from '../../lib/kafka_storage';


class UtxoWorker extends BaseWorker {
  private readonly NODE_URL: string;
  private readonly MAX_RETRIES: number;
  private readonly RPC_USERNAME: string;
  private readonly RPC_PASSWORD: string;
  private readonly CONFIRMATIONS: number;
  private readonly DEFAULT_TIMEOUT: number;
  private readonly MAX_CONCURRENT_REQUESTS: number;
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private client: jayson.HttpClient | jayson.HttpsClient;

  constructor(settings) {
    super(settings);

    this.NODE_URL = settings.NODE_URL;
    this.MAX_RETRIES = settings.MAX_RETRIES;
    this.RPC_PASSWORD = settings.RPC_PASSWORD;
    this.RPC_USERNAME = settings.RPC_USERNAME;
    this.CONFIRMATIONS = settings.CONFIRMATIONS;
    this.DEFAULT_TIMEOUT = settings.DEFAULT_TIMEOUT;
    this.MAX_CONCURRENT_REQUESTS = settings.MAX_CONCURRENT_REQUESTS;
    this.LOOP_INTERVAL_CURRENT_MODE_SEC = settings.LOOP_INTERVAL_CURRENT_MODE_SEC;

    logger.info(`Connecting to the node ${this.NODE_URL}`);
    this.client = constructRPCClient(this.NODE_URL, {
      method: 'POST',
      auth: this.RPC_USERNAME + ':' + this.RPC_PASSWORD,
      timeout: this.DEFAULT_TIMEOUT,
      version: 1
    });
  }

  async init(exporter: Exporter) {
    const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
    this.lastConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
    await exporter.initPartitioner((event) => event['height']);
  }

  async sendRequest(method, params) {
    return this.client.request(method, params).then(({ result, error }) => {
      if (error) {
        return Promise.reject(error);
      }

      return result;
    });
  }

  async sendRequestWithRetry(method, params) {
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
      } catch (err) {
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

  async decodeTransaction(transaction_bytecode) {
    return await this.sendRequestWithRetry('decoderawtransaction', [transaction_bytecode]);
  }

  async getTransactionData(transaction_hashes) {
    const decodedTransactions = [];
    for (const transaction_hash of transaction_hashes) {
      const transactionBytecode = await this.sendRequestWithRetry('getrawtransaction', [transaction_hash]);
      const decodedTransaction = await this.decodeTransaction(transactionBytecode);
      decodedTransactions.push(decodedTransaction);
    }

    return decodedTransactions;
  }

  async fetchBlock(block_index) {
    const blockHash = await this.sendRequestWithRetry('getblockhash', [block_index]);
    return await this.sendRequestWithRetry('getblock', [blockHash, 2]);
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;

      const blockchainInfo = await this.sendRequestWithRetry('getblockchaininfo', []);
      const newConfirmedBlock = blockchainInfo.blocks - this.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    }
    else {
      this.sleepTimeMsec = 0;
    }

    const numConcurrentRequests = Math.min(this.MAX_CONCURRENT_REQUESTS, this.lastConfirmedBlock - this.lastExportedBlock);
    const requests = Array.from({ length: numConcurrentRequests }, (_, i) => this.fetchBlock(this.lastExportedBlock + 1 + i));
    const blocks = await Promise.all(requests);
    this.lastExportedBlock += blocks.length;
    return blocks;
  }
}

module.exports = {
  worker: UtxoWorker
};
