import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper, safeCastToNumber } from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { fetchBlocks } from '../eth/lib/fetch_data';
import { ETHBlock } from '../eth/eth_types';
import { ETHBlockStats } from './eth_blocks_types';
import { HTTPClientInterface } from '../../types';
import { validateETHBlocksStats } from './lib/output_validator';


export class ETHBlocksWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT);
  }

  decodeBlock(block: ETHBlock): ETHBlockStats {
    const decodedBlock: ETHBlockStats = {
      hash: block.hash,
      miner: block.miner,
      difficulty: this.web3Wrapper.parseHexToNumberString(block.difficulty),
      totalDifficulty: this.web3Wrapper.parseHexToNumberString(block.totalDifficulty),
      timestamp: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.timestamp)),
      size: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.size)),
      gasLimit: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.gasLimit)),
      gasUsed: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.gasUsed)),
      number: safeCastToNumber(this.web3Wrapper.parseHexToNumber(block.number)),
      transactionCount: block.transactions.length
    }

    if (block.minGasPrice !== undefined) {
      decodedBlock.minGasPrice = this.web3Wrapper.parseHexToNumberString(block["minGasPrice"]);
    }

    return decodedBlock;
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
    const blocks = await fetchBlocks(this.ethClient, this.web3Wrapper, fromBlock, toBlock, false);
    const events = Array.from(blocks).map(([key, block]) => {
      const output = this.decodeBlock(block);
      validateETHBlocksStats(output);
      return JSON.stringify(output);
    });

    this.lastExportedBlock = toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

