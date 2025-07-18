import { logger } from '../../lib/logger';
import { constructRPCClient } from '../../lib/http_client';
import { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } from './lib/dao_hack';
import { getGenesisTransfers } from './lib/genesis_transfers';
import { assignInternalTransactionPosition, checkETHTransfersQuality, transactionOrder, mergeSortedArrays } from './lib/util'
import { BaseWorker } from '../../lib/worker_base';
import { Web3Interface, constructWeb3Wrapper, safeCastToNumber, Web3Static } from './lib/web3_wrapper';
import { decodeTransferTrace } from './lib/decode_transfers';
import { FeesDecoder } from './lib/fees_decoder';
import { nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime, NO_WORK_SLEEP } from './lib/next_interval_calculator';
import { WithdrawalsDecoder } from './lib/withdrawals_decoder';
import { fetchEthInternalTrx, fetchBlocks, fetchReceipts } from './lib/fetch_data';
import { HTTPClientInterface } from '../../types';
import { Trace, ETHBlock, ETHTransfer, ETHReceiptsMap } from './eth_types';
import { EOB, collectEndOfBlocks } from './lib/end_of_block';


export class ETHWorker extends BaseWorker {
  private web3Wrapper: Web3Interface;
  private ethClient: HTTPClientInterface;
  private feesDecoder: FeesDecoder;
  private withdrawalsDecoder: WithdrawalsDecoder;
  private ethClientVerification: HTTPClientInterface | undefined

  constructor(settings: any) {
    super(settings);

    logger.info(`Connecting to Ethereum node ${settings.NODE_URL}`);
    this.web3Wrapper = constructWeb3Wrapper(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD);
    this.ethClient = constructRPCClient(settings.NODE_URL, settings.RPC_USERNAME, settings.RPC_PASSWORD,
      settings.DEFAULT_TIMEOUT)

    if (settings.VERIFICATION_NODE) {
      this.ethClientVerification = constructRPCClient(settings.VERIFICATION_NODE, settings.VERIFICATION_NODE_USERNAME,
        settings.VERIFICATION_NODE_PASSWORD, settings.DEFAULT_TIMEOUT)
    }

    this.feesDecoder = new FeesDecoder();
    this.withdrawalsDecoder = new WithdrawalsDecoder();
  }

  async fetchData(fromBlock: number, toBlock: number): Promise<[Trace[], Map<number, ETHBlock>, ETHReceiptsMap]> {
    return await Promise.all([
      fetchEthInternalTrx(this.ethClient, this.web3Wrapper, fromBlock, toBlock, this.settings.IS_ETH,
        this.settings.THE_MERGE),
      fetchBlocks(this.ethClient, fromBlock, toBlock, true),
      fetchReceipts(this.ethClient, this.web3Wrapper,
        this.settings.RECEIPTS_API_METHOD, fromBlock, toBlock),
    ]);
  }

  transformPastEvents(fromBlock: number, toBlock: number, traces: Trace[],
    blocks: any, receipts: ETHReceiptsMap): ETHTransfer[] {
    let events: ETHTransfer[] = [];

    const transformedTransferEvents = this.transformPastTransferEvents(traces, blocks);
    const transformedTransactionEvents = this.transformPastTransactionEvents(blocks.values(), receipts);
    for (let event of transformedTransferEvents) events.push(event);
    for (let event of transformedTransactionEvents) events.push(event);
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events);
    }

    return events;
  }

  transformPastTransferEvents(traces: Trace[], blocksMap: Map<number, ETHBlock>): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (let i = 0; i < traces.length; i++) {
      const blockNumber = traces[i]['blockNumber'];
      const block = blocksMap.get(blockNumber);
      if (block === undefined) {
        throw Error(`Block ${blockNumber} is not found in block map`)
      }
      const blockTimestamp: number = safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp));
      result.push(decodeTransferTrace(traces[i], blockTimestamp));
    }

    return result;
  }

  transformPastTransactionEvents(blocks: ETHBlock[], receipts: ETHReceiptsMap): ETHTransfer[] {
    const result: ETHTransfer[] = [];

    for (const block of blocks) {
      const blockNumber = safeCastToNumber(Web3Static.parseHexToNumber(block.number));
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, blockNumber, receipts,
        this.settings.IS_ETH);
      if (block.withdrawals !== undefined) {
        const blockTimestamp = safeCastToNumber(Web3Static.parseHexToNumber(block.timestamp));
        decoded_transactions.push(...this.withdrawalsDecoder.getBeaconChainWithdrawals(block.withdrawals, blockNumber, blockTimestamp));
      }
      result.push(...decoded_transactions);
    }

    return result;
  }

  async work(): Promise<(ETHTransfer | EOB)[]> {
    const workerContext = await analyzeWorkerContext(this, () => this.web3Wrapper.getBlockNumber());
    setWorkerSleepTime(this, workerContext);
    if (workerContext === NO_WORK_SLEEP) return [];

    let { fromBlock, toBlock } = nextIntervalCalculator(this.lastExportedBlock, this.settings.BLOCK_INTERVAL, this.lastConfirmedBlock);
    const events: (ETHTransfer | EOB)[] = []
    if (fromBlock === 0 && this.settings.IS_ETH) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers());
      // We do not want to ask the Node for data for block 0. We already inject all the genesis transfers.
      fromBlock = 1;
      if (toBlock === 0) {
        toBlock = 1;
      }
    }

    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`)
    const [traces, blocks, receipts] = await this.fetchData(fromBlock, toBlock)
    events.push(...this.transformPastEvents(fromBlock, toBlock, traces, blocks, receipts))
    events.sort(transactionOrder)
    if (this.ethClientVerification) {
      await checkETHTransfersQuality(events, fromBlock, toBlock, this.ethClientVerification)
    }

    const eobEvents = collectEndOfBlocks(fromBlock, toBlock, blocks)
    const mergedEvents = mergeSortedArrays(events, eobEvents, transactionOrder)

    assignInternalTransactionPosition(mergedEvents)

    if (this.settings.ASSIGN_PRIMARY_KEY) {
      extendEventsWithPrimaryKey(mergedEvents, this.lastPrimaryKey);
      this.lastPrimaryKey += events.length;
    }

    this.lastExportedBlock = toBlock

    return mergedEvents
  }

  async init(): Promise<void> {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.settings.CONFIRMATIONS
  }
}

export function extendEventsWithPrimaryKey<T extends { primaryKey?: number }>(events: T[], lastPrimaryKey: number) {
  for (let i = 0; i < events.length; i++) {
    events[i].primaryKey = lastPrimaryKey + i + 1;
  }
}

