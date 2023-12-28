const Web3 = require('web3');
const jayson = require('jayson/promise');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const Web3Wrapper = require('./lib/web3_wrapper');
const BaseWorker = require('../../lib/worker_base');
const { FeesDecoder } = require('./lib/fees_decoder');
const { filterErrors } = require('./lib/filter_errors');
const { transactionOrder, stableSort } = require('./lib/util');
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
  }

  async ethClientRequestWithRetry(...params) {
    let retries = 0;
    let retryIntervalMs = 0;
    while (retries < constants.MAX_RETRIES) {
      try {
        const response = await this.ethClient.request(...params);
        if (response.error || response.result === null) {
          retries++;
          retryIntervalMs += (constants.BACKOFF_RETRY_STEP * retries);
          logger.error(`${params[0]} failed. Reason: ${response.error}. Retrying for ${retries} time`);
          await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
        } else {
          return response;
        }
      } catch(err) {
        retries++;
        retryIntervalMs += (constants.BACKOFF_RETRY_STEP * retries);
        logger.error(
          `Try block in ${params[0]} failed. Reason: ${err.toString()}. Waiting ${retryIntervalMs} and retrying for ${retries} time`
          );
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }
    return Promise.reject(`${params[0]} failed after ${retries} retries`);
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
    logger.info(`Fetching internal transactions for blocks ${fromBlock}:${toBlock}`);
    return this.ethClientRequestWithRetry('trace_filter', [{
      fromBlock: this.web3Wrapper.parseNumberToHex(fromBlock),
      toBlock: this.web3Wrapper.parseNumberToHex(toBlock)
    }]).then((data) => this.parseEthInternalTrx(data['result']));
  }

  async fetchBlocks(fromBlock, toBlock) {
    logger.info(`Fetching block info for blocks ${fromBlock}:${toBlock}`);
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
    const finishedRequests = await this.ethClientRequestWithRetry(batch);
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

  async fetchTracesBlocksAndReceipts(fromBlock, toBlock) {
    const [traces, blocks] = await Promise.all([
      this.fetchEthInternalTrx(fromBlock, toBlock),
      this.fetchBlocks(fromBlock, toBlock)
    ]);
    logger.info(`Fetching receipts of ${fromBlock}:${toBlock}`);
    const receipts = await this.fetchReceipts(blocks.keys());

    return [traces, blocks, receipts];
  }

  async getPastEvents(fromBlock, toBlock, traces, blocks, receipts) {
    logger.info(`Fetching transfer events for interval ${fromBlock}:${toBlock}`);
    let events = [];
    if (fromBlock === 0) {
      logger.info('Adding the GENESIS transfers');
      events.push(...getGenesisTransfers(this.web3));
    }

    const transferEvents = await this.getPastTransferEvents(traces, blocks);
    for (const transfer of transferEvents) events.push(transfer);

    const transactionEvents = await this.getPastTransactionEvents(blocks.values(), receipts);
    for (const trx of transactionEvents) events.push(trx);

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
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      if (constants.IS_ETH && blockNumber >= constants.SHANGHAI_FORK_BLOCK) {
        const temp_decoded_transactions = await this.withdrawalsDecoder.getBeaconChainWithdrawals(block, blockNumber);
        for (const trx of temp_decoded_transactions) {
          decoded_transactions.push(trx);
        }
      }
      for (const trx of decoded_transactions) {
        result.push(trx);
      }
    }

    return result;
  }

  async work() {
    const requestIntervals = await nextIntervalCalculator(this);
    if (requestIntervals.length === 0) return [];

    const events = [].concat(...await Promise.all(
      requestIntervals.map(async (requestInterval) => {
        const [traces, blocks, receipts] = await this.fetchTracesBlocksAndReceipts(requestInterval.fromBlock, requestInterval.toBlock);
        return await this.getPastEvents(requestInterval.fromBlock, requestInterval.toBlock, traces, blocks, receipts);
      })
    ));

    if (events.length > 0) {
      stableSort(events, transactionOrder);
      for (let i = 0; i < events.length; i++) {
        events[i].primaryKey = this.lastPrimaryKey + i + 1;
      }

      this.lastPrimaryKey += events.length;
    }

    this.lastExportedBlock = requestIntervals[requestIntervals.length - 1].toBlock;
    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3.eth.getBlockNumber() - constants.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHWorker
};
