'use strict';
/*import helper from './lib/helper';
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper } from '../eth/lib/web3_wrapper';
import { HTTPClientInterface } from '../../types';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';


export class ReceiptsWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private client: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.client = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }

  async fetchBlockTimestamps(fromBlock: number, toBlock: number) {
    const batch = [];
    for (let i = fromBlock; i < toBlock + 1; i++) {
      batch.push(
        this.client.generateRequest(
          this.settings.GET_BLOCK_ENDPOINT,
          [this.web3Wrapper.parseNumberToHex(i),
            true]
        )
      );
    }

    return this.client.requestBulk(batch).then((responses) => helper.parseBlocks(responses));
  }

  async fetchReceiptsFromTransaction(blocks: any[]) {
    var batch = [];
    for (let block = 0; block < blocks.length; block++) {
      var transactions = blocks[block]['transactions'];
      if (transactions.length === 0) continue;
      for (let trx = 0; trx < transactions.length; trx++) {
        var transactionHash = transactions[trx]['hash'];
        batch.push(
          this.client.generateRequest(
            this.settings.GET_RECEIPTS_ENDPOINT,
            [transactionHash]
          )
        );
      }
    }
    return (!batch.length) ? [] : this.client.requestBulk(batch).then((responses) => helper.parseTransactionReceipts(responses));
  }

  async getReceiptsForBlocks(fromBlock: number, toBlock: number) {
    logger.info(`Fetching blocks ${fromBlock}:${toBlock}`);
    const blocks = await this.fetchBlockTimestamps(fromBlock, toBlock);
    let receipts;

    if (!this.settings.TRANSACTION) {
      receipts = await this.fetchReceipts(fromBlock, toBlock);
    }
    else {
      receipts = await this.fetchReceiptsFromTransaction(blocks);
    }
    const decodedReceipts = receipts.map((receipt: any) => helper.decodeReceipt(receipt, this.web3Wrapper));
    const decodedBlocks = blocks.map((block: any) => helper.decodeBlock(block, this.web3Wrapper));
    const timestamps = helper.prepareBlockTimestampsObject(decodedBlocks);

    return helper.setReceiptsTimestamp(decodedReceipts, timestamps);
  }

  async fetchReceipts(fromBlock: number, toBlock: number) {
    const batch = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      batch.push(
        this.client.generateRequest(
          this.settings.GET_RECEIPTS_ENDPOINT,
          [this.web3Wrapper.parseNumberToHex(i)]
        )
      );
    }
    return this.client.requestBulk(batch).then((responses) => helper.parseReceipts(responses));
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching receipts for interval ${fromBlock}:${toBlock}`);
    const receipts = await this.getReceiptsForBlocks(fromBlock, toBlock);

    this.lastExportedBlock = toBlock;

    return receipts;
  }
}


*/