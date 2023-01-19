const Web3 = require('web3');
const jayson = require('jayson/promise');
const { filterErrors } = require('./lib/filter_errors');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack');
const { getGenesisTransfers } = require('./lib/genesis_transfers');
const { transactionOrder, stableSort } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('./lib/web3_wrapper');
const { decodeTransferTrace } = require('./lib/decode_transfers');
const { FeesDecoder } = require('./lib/fees_decoder');
const { nextIntervalCalculator } = require('./lib/next_interval_calculator');


class ETHWorker extends BaseWorker {
  constructor() {
    super();

    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    this.web3 = new Web3(new Web3.providers.HttpProvider(constants.NODE_URL));
    this.web3Wrapper = new Web3Wrapper(this.web3);
    this.ethClient = jayson.client.https(constants.NODE_URL);
    this.feesDecoder = new FeesDecoder(this.web3, this.web3Wrapper);
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
    const responses = [];

    for (const blockNumber of blockNumbers) {
      const req = this.ethClient.request(constants.RECEIPTS_API_METHOD, [this.web3Wrapper.parseNumberToHex(blockNumber)], undefined, false);
      responses.push(this.ethClient.request([req]));
    }

    const finishedRequests = await Promise.all(responses);
    const result = {};

    finishedRequests.forEach((blockResponses) => {
      if (!blockResponses) return;

      blockResponses.forEach((blockResponse) => {
        if (blockResponse.result) {
          blockResponse.result.forEach((receipt) => {
            result[receipt.transactionHash] = receipt;
          });
        }
        else {
          throw new Error(JSON.stringify(blockResponse));
        }
      });
    });

    return result;
  }



  async fetchTracesBlocksAndReceipts(fromBlock, toBlock) {
    logger.info(`Fetching traces for blocks ${fromBlock}:${toBlock}`);
    const [traces, blocks] = await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocks(fromBlock, toBlock)
    ]);
    logger.info(`Fetching receipts of ${fromBlock}:${toBlock}`);
    const receipts = await this.fetchReceipts(blocks.keys());

    return [traces, blocks, receipts];
  }

  async getPastEvents(fromBlock, toBlock, traces, blocks, receipts) {
    let events = [];
    if (fromBlock === 0) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers(this.web3));
    }

    events.push(... await this.getPastTransferEvents(traces, blocks));
    events.push(... await this.getPastTransactionEvents(blocks.values(), receipts));
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events);
    }

    return events;
  }


  async getPastTransferEvents(traces, blocksMap) {
    const result = [];

    for (let i = 0; i < traces.length; i++) {
      const block_timestamp = this.web3Wrapper.decodeTimestampFromBlock(blocksMap.get(traces[i]['blockNumber']));
      result.push(decodeTransferTrace(traces[i], block_timestamp, this.web3Wrapper));
    }

    return result;
  }

  async getPastTransactionEvents(blocks, receipts) {
    const result = [];

    for (const block of blocks) {
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, receipts);
      result.push(...decoded_transactions);
    }

    return result;
  }

  async work() {
    const result = await nextIntervalCalculator(this);
    if (!result.success) {
      return [];
    }

    logger.info(`Fetching transfer events for interval ${result.fromBlock}:${result.toBlock}`);
    const [traces, blocks, receipts] = await this.fetchTracesBlocksAndReceipts(result.fromBlock, result.toBlock);
    const events = await this.getPastEvents(result.fromBlock, result.toBlock, traces, blocks, receipts);

    if (events.length > 0) {
      stableSort(events, transactionOrder);
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1;
      }

      this.lastPrimaryKey += events.length;
    }

    this.lastExportTime = Date.now();
    this.lastExportedBlock = result.toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }

}

module.exports = {
  worker: ETHWorker
};
