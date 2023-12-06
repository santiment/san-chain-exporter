const Web3 = require('web3');
const jayson = require('jayson/promise');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const Web3Wrapper = require('./lib/web3_wrapper');
const BaseWorker = require('../../lib/worker_base');
const { FeesDecoder } = require('./lib/fees_decoder');
const { filterErrors } = require('./lib/filter_errors');
const { decodeTransferTrace } = require('./lib/decode_transfers');
const { getGenesisTransfers } = require('./lib/genesis_transfers');
const { WithdrawalsDecoder } = require('./lib/withdrawals_decoder');
const { nextIntervalCalculator } = require('./lib/next_interval_calculator');
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack');


class ETHWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.web3Wrapper = new Web3Wrapper(this.web3);
    if (constants.NODE_URL.substring(0, 5) === 'https') {
      this.ethClient = jayson.client.https(constants.NODE_URL);
    } else {
      this.ethClient = jayson.client.http(constants.NODE_URL);
    }
    this.feesDecoder = new FeesDecoder(this.web3, this.web3Wrapper);
    this.withdrawalsDecoder = new WithdrawalsDecoder(this.web3, this.web3Wrapper);
    this.buffer = [];
  }

  parseEthInternalTrx(result) {
    const traces = filterErrors(result);

    return traces
      .filter((trace) =>
        trace['action']['value'] !== '0x0' &&
        trace['action']['balance'] !== '0x0' &&
        !(trace['type'] === 'call' && trace['action']['callType'] !== 'call')
      );
  }

  fetchEthInternalTrx(fromBlock, toBlock) {
    logger.info(`Fetching traces info ${fromBlock}:${toBlock}`);
    return this.ethClient.request('trace_filter', [{
      fromBlock: this.web3Wrapper.parseNumberToHex(fromBlock),
      toBlock: this.web3Wrapper.parseNumberToHex(toBlock)
    }]).then((data) => this.parseEthInternalTrx(data['result']));
  }

  async fetchBlocks(fromBlock, toBlock) {
    const blockRequests = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      blockRequests.push(
        this.ethClient.request(
          'eth_getBlockByNumber',
          [this.web3Wrapper.parseNumberToHex(i), true],
          undefined,
          false
        )
      );
    }

    const responses = await this.ethClient.request(blockRequests);
    const result = new Map();
    responses.forEach((response, index) => result.set(fromBlock + index, response.result));
    return result;
  }

  async fetchReceipts(blockNumbers) {
    const batch = [];
    for (const blockNumber of blockNumbers) {
      batch.push(
        this.ethClient.request(
          constants.RECEIPTS_API_METHOD,
          [this.web3Wrapper.parseNumberToHex(blockNumber)],
          undefined,
          false
        )
      );
    }
    const finishedRequests = await this.ethClient.request(batch);
    const result = {};

    finishedRequests.forEach((response) => {
      if (response.result) {
        response.result.forEach((receipt) => {
          result[receipt.transactionHash] = receipt;
        });
      }
      else {
        throw new Error(JSON.stringify(response));
      }
    });

    return result;
  }

  async fetchBlocksAndReceipts(fromBlock, toBlock) {
    logger.info(`Fetching blocks info ${fromBlock}:${toBlock}`);
    const blocks = await this.fetchBlocks(fromBlock, toBlock);
    logger.info(`Fetching receipts of ${fromBlock}:${toBlock}`);
    const receipts = await this.fetchReceipts(blocks.keys());

    return [blocks, receipts];
  }

  async fetchData(fromBlock, toBlock) {
    return await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocksAndReceipts(fromBlock, toBlock)]);
  }

  transformEvents(fromBlock, toBlock, data) {
    const [traces, [blocks, receipts]] = data;
    let events = [];
    if (fromBlock === 0) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers(this.web3));
    }

    events.push(...this.transformTransferEvents(traces, blocks));
    events.push(...this.transformTransactionEvents(blocks.values(), receipts));
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events);
    }

    return events;
  }

  transformTransferEvents(traces, blocksMap) {
    const result = [];
    for (let i = 0; i < traces.length; i++) {
      const block_timestamp = this.web3Wrapper.decodeTimestampFromBlock(blocksMap.get(traces[i]['blockNumber']));
      result.push(decodeTransferTrace(traces[i], block_timestamp, this.web3Wrapper));//TODO: Maybe push {blocknumbers: data}
    }

    return result;
  }

  transformTransactionEvents(blocks, receipts) {
    const result = [];
    for (const block of blocks) {
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, receipts);
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      if (constants.IS_ETH && blockNumber >= constants.SHANGHAI_FORK_BLOCK) {
        decoded_transactions.push(...this.withdrawalsDecoder.getBeaconChainWithdrawals(block, blockNumber));
      }
      result.push(...decoded_transactions);
      //TODO: Maybe push {blocknumbers: data}
    }

    return result;
  }
//TODO:s - If you have a [{#:data}] then you can check whether the # just doesnt have data or it's missing
  async makeQueueTask(interval) {
    const data = await this.fetchData(interval.fromBlock, interval.toBlock);
    const transformedData = this.transformEvents(interval.fromBlock, interval.toBlock, data);
    transformedData.forEach((data) => this.buffer.push(data));
  }

  async work() {
    const intervals = await nextIntervalCalculator(this);
    if (intervals.length === 0) return [];

    for (const interval of intervals) this.queue.add(() => this.makeQueueTask(interval));

    this.lastExportedBlock = Math.max(intervals[intervals.length - 1].toBlock, this.lastExportTime);
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHWorker
};
