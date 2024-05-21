import { Web3 } from 'web3';
import Web3HttpProvider, { HttpProviderOptions } from 'web3-providers-http';
import jayson from 'jayson/promise';
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { buildHttpOptions } from '../../lib/build_http_options';
import { BaseWorker } from '../../lib/worker_base';
import Web3Wrapper from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { fetchBlocks } from '../eth/lib/fetch_data';
import { Block } from '../eth/eth_types';


class ETHBlocksWorker extends BaseWorker {
  private web3Wrapper: Web3Wrapper;
  private ethClient: jayson.HttpClient | jayson.HttpsClient;

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    const authCredentials = settings.RPC_USERNAME + ':' + settings.RPC_PASSWORD;
    const httpProviderOptions: HttpProviderOptions = buildHttpOptions(authCredentials);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3HttpProvider(settings.NODE_URL, httpProviderOptions)));
    this.ethClient = constructRPCClient(settings.NODE_URL, {
      method: 'POST',
      auth: authCredentials,
      timeout: settings.DEFAULT_TIMEOUT,
      version: 2
    });

  }

  decodeBlock(block: Block): string {
    const decodedBlock: any = {
      hash: block["hash"],
      miner: block["miner"],
      difficulty: this.web3Wrapper.parseHexToNumberString(block["difficulty"]),
      totalDifficulty: this.web3Wrapper.parseHexToNumberString(block["totalDifficulty"]),
      timestamp: this.web3Wrapper.parseHexToNumberString(block["timestamp"]),
      size: this.web3Wrapper.parseHexToNumber(block["size"]),
      gasLimit: this.web3Wrapper.parseHexToNumberString(block["gasLimit"]),
      gasUsed: this.web3Wrapper.parseHexToNumberString(block["gasUsed"]),
      number: this.web3Wrapper.parseHexToNumber(block["number"])
    }

    if (block["minGasPrice"] !== undefined) {
      decodedBlock["minGasPrice"] = this.web3Wrapper.parseHexToNumberString(block["minGasPrice"])
    }

    return JSON.stringify(decodedBlock);
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
    const blocks = await fetchBlocks(this.ethClient, this.web3Wrapper, fromBlock, toBlock);
    const events = Array.from(blocks).map(([key, block]) => this.decodeBlock(block));

    this.lastExportedBlock = toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHBlocksWorker
};
