import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, Web3Static, constructWeb3Wrapper, safeCastToNumber } from '../eth/lib/web3_wrapper';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from '../eth/lib/next_interval_calculator';
import { fetchBlocks } from '../eth/lib/fetch_data';
import { ETHBlock } from '../eth/eth_types';
import { HTTPClientInterface } from '../../types';
import { validateETHBlocksStats, ETHBlockStats } from './lib/output_validator';


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
      difficulty: Web3Static.parseHexToNumberString(block.difficulty),
      totalDifficulty: Web3Static.parseHexToNumberString(block.totalDifficulty !== undefined ? block.totalDifficulty : '0x0'),
      timestamp: safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp)),
      size: safeCastToNumber(Web3Static.parseHexToNumber(block.size)),
      gasLimit: safeCastToNumber(Web3Static.parseHexToNumber(block.gasLimit)),
      gasUsed: safeCastToNumber(Web3Static.parseHexToNumber(block.gasUsed)),
      number: safeCastToNumber(Web3Static.parseHexToNumber(block.number)),
      transactionCount: block.transactions.length
    }

    if (block.minGasPrice !== undefined) {
      decodedBlock.minGasPrice = Web3Static.parseHexToNumberString(block["minGasPrice"]);
    }

    return decodedBlock;
  }

  async work() {
    const workerContext = await analyzeWorkerContext(this, this.web3Wrapper.getBlockNumber);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching blocks events for interval ${fromBlock}:${toBlock}`);
    const blocks = await fetchBlocks(this.ethClient, fromBlock, toBlock, false);
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

