import { Web3 } from 'web3';
import Web3HttpProvider, { HttpProviderOptions } from 'web3-providers-http';
import jayson from 'jayson/promise';
import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { buildHttpOptions } from '../../lib/build_http_options';
import { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } from './lib/dao_hack';
import { getGenesisTransfers } from './lib/genesis_transfers';
import { transactionOrder, stableSort } from './lib/util';
import { BaseWorker } from '../../lib/worker_base';
import Web3Wrapper from './lib/web3_wrapper';
import { decodeTransferTrace } from './lib/decode_transfers';
import { FeesDecoder } from './lib/fees_decoder';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from './lib/next_interval_calculator';
import { WithdrawalsDecoder } from './lib/withdrawals_decoder';
import { fetchEthInternalTrx, fetchBlocks, fetchReceipts } from './lib/fetch_data';
import { Trace, Block, ETHTransfer } from './eth_types';

export class ETHWorker extends BaseWorker {
  private web3Wrapper: Web3Wrapper;
  private ethClient: jayson.HttpClient | jayson.HttpsClient;
  private feesDecoder: FeesDecoder;
  private withdrawalsDecoder: WithdrawalsDecoder;

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

    this.feesDecoder = new FeesDecoder(this.web3Wrapper);
    this.withdrawalsDecoder = new WithdrawalsDecoder(this.web3Wrapper);
  }

  async fetchData(fromBlock: number, toBlock: number): Promise<[Trace[], Map<number, Block>, any]> {
    return await Promise.all([
      fetchEthInternalTrx(this.ethClient, this.web3Wrapper, fromBlock, toBlock),
      fetchBlocks(this.ethClient, this.web3Wrapper, fromBlock, toBlock),
      fetchReceipts(this.ethClient, this.web3Wrapper,
        this.settings.RECEIPTS_API_METHOD, fromBlock, toBlock),
    ]);
  }

  transformPastEvents(fromBlock: number, toBlock: number, traces: Trace[],
    blocks: any, receipts: any): ETHTransfer[] {
    let events: ETHTransfer[] = [];
    if (fromBlock === 0) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers(this.web3Wrapper));
    }

    const transformedTransferEvents = this.transformPastTransferEvents(traces, blocks);
    const transformedTransactionEvents = this.transformPastTransactionEvents(blocks.values(), receipts);
    for (let event of transformedTransferEvents) events.push(event);
    for (let event of transformedTransactionEvents) events.push(event);
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events, this.web3Wrapper);
    }

    return events;
  }

  transformPastTransferEvents(traces: Trace[], blocksMap: Map<number, Block>): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (let i = 0; i < traces.length; i++) {
      const blockNumber = traces[i]['blockNumber'];
      const block = blocksMap.get(blockNumber);
      if (block === undefined) {
        throw Error(`Block ${blockNumber} is not found in block map`)
      }
      const blockTimestamp = this.web3Wrapper.parseHexToNumber(block.timestamp);
      result.push(decodeTransferTrace(traces[i], blockTimestamp, this.web3Wrapper));
    }

    return result;
  }

  transformPastTransactionEvents(blocks: Block[], receipts: any): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (const block of blocks) {
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, blockNumber, receipts,
        this.settings.IS_ETH, this.settings.BURN_ADDRESS, this.settings.LONDON_FORK_BLOCK);
      if (block.withdrawals !== undefined) {
        const blockTimestamp = this.web3Wrapper.parseHexToNumber(block.timestamp);
        decoded_transactions.push(...this.withdrawalsDecoder.getBeaconChainWithdrawals(block.withdrawals, blockNumber, blockTimestamp));
      }
      result.push(...decoded_transactions);
    }

    return result;
  }

  async work(): Promise<ETHTransfer[]> {
    const workerContext = await analyzeWorkerContext(this);
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    const { fromBlock, toBlock } = nextIntervalCalculator(this);
    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`);
    const [traces, blocks, receipts] = await this.fetchData(fromBlock, toBlock);
    const events = this.transformPastEvents(fromBlock, toBlock, traces, blocks, receipts);

    if (events.length > 0) {
      stableSort(events, transactionOrder);
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1;
      }

      this.lastPrimaryKey += events.length;
    }

    this.lastExportedBlock = toBlock;

    return events;
  }

  async init(): Promise<void> {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHWorker
};


