const { Web3 } = require('web3');
const jayson = require('jayson/promise');
const { filterErrors } = require('./lib/filter_errors');
const { logger } = require('../../lib/logger');
const { injectDAOHackTransfers, DAO_HACK_FORK_BLOCK } = require('./lib/dao_hack');
const { getGenesisTransfers } = require('./lib/genesis_transfers');
const { transactionOrder, stableSort } = require('./lib/util');
const BaseWorker = require('../../lib/worker_base');
const Web3Wrapper = require('./lib/web3_wrapper');
const { decodeTransferTrace } = require('./lib/decode_transfers');
const { FeesDecoder } = require('./lib/fees_decoder');
const { nextIntervalCalculator } = require('./lib/next_interval_calculator');
const { WithdrawalsDecoder } = require('./lib/withdrawals_decoder');

class ETHWorker extends BaseWorker {
  constructor(constants) {
    super();

    this.constants = constants;
    logger.info(`Connecting to Ethereum node ${constants.NODE_URL}`);
    logger.info(`Applying the following settings: ${JSON.stringify(constants)}`);
    this.web3Wrapper = new Web3Wrapper(new Web3(new Web3.providers.HttpProvider(constants.NODE_URL)));
    if (constants.NODE_URL.substring(0, 5) === 'https') {
      this.ethClient = jayson.client.https(constants.NODE_URL);
    } else {
      this.ethClient = jayson.client.http(constants.NODE_URL);
    }
    this.feesDecoder = new FeesDecoder(this.web3Wrapper);
    this.withdrawalsDecoder = new WithdrawalsDecoder(this.web3Wrapper);
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
      const req = this.ethClient.request(this.constants.RECEIPTS_API_METHOD, [this.web3Wrapper.parseNumberToHex(blockNumber)], undefined, false);
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
      events.push(...getGenesisTransfers(this.web3Wrapper));
    }

    events.push(... await this.getPastTransferEvents(traces, blocks));
    events.push(... await this.getPastTransactionEvents(blocks.values(), receipts));
    if (fromBlock <= DAO_HACK_FORK_BLOCK && DAO_HACK_FORK_BLOCK <= toBlock) {
      logger.info('Adding the DAO hack transfers');
      events = injectDAOHackTransfers(events, this.web3Wrapper);
    }

    return events;
  }

  async getPastTransferEvents(traces, blocksMap) {
    const result = [];

    for (let i = 0; i < traces.length; i++) {
      const block_timestamp = this.web3Wrapper.parseHexToNumber(blocksMap.get(traces[i]['blockNumber']).timestamp);
      result.push(decodeTransferTrace(traces[i], block_timestamp, this.web3Wrapper));
    }

    return result;
  }

  async getPastTransactionEvents(blocks, receipts) {
    const result = [];

    for (const block of blocks) {
      const blockNumber = this.web3Wrapper.parseHexToNumber(block.number);
      const decoded_transactions = this.feesDecoder.getFeesFromTransactionsInBlock(block, blockNumber, receipts);
      if (this.constants.IS_ETH && blockNumber >= this.constants.SHANGHAI_FORK_BLOCK) {
        decoded_transactions.push(... await this.withdrawalsDecoder.getBeaconChainWithdrawals(block, blockNumber));
      }
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

    this.lastExportedBlock = result.toBlock;

    return events;
  }

  async init() {
    this.lastConfirmedBlock = await this.web3Wrapper.getBlockNumber() - this.constants.CONFIRMATIONS;
  }
}

module.exports = {
  worker: ETHWorker
};
