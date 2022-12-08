'use strict';
const xrpl = require('xrpl');
const assert = require('assert');
const constants = require('./lib/constants');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');

class XRPWorker extends BaseWorker {
  constructor() {
    super();
    this.nodeURLs = constants.XRP_NODE_URLS.split(',');
    this.connections = [];
  }

  async createNewSetConnections() {
    PQueue = (await import('p-queue')).default;
    if (this.nodeURLs.length === 0) {
      throw 'Error: All API URLs returned error.';
    }

    const nodeURL = this.nodeURLs.shift();
    logger.info(`Using ${nodeURL} as XRPL API endpoint.`);
    for (let i = 0; i < constants.CONNECTIONS_COUNT; i++) {
      const clientOptions = { timeout: constants.DEFAULT_WS_TIMEOUT };
      const api = new xrpl.Client(nodeURL, clientOptions);
      await api.connect();

      this.connections.push({
        connection: api,
        queue: new PQueue({ concurrency: constants.MAX_CONNECTION_CONCURRENCY }),
        index: i
      });
    }
  }

  async connectionSend({ connection, queue }, params) {
    return queue.add(() => {
      return connection.request(params);
    });
  }

  async init() {
    await this.createNewSetConnections();
    const lastValidatedLedger = await this.connectionSend(this.connections[0], {
      command: 'ledger',
      ledger_index: 'validated',
      transactions: true,
      expand: false
    });
    const lastValidatedLedgerData = lastValidatedLedger.result;
    this.lastConfirmedBlock = parseInt(lastValidatedLedgerData.ledger.ledger_index) - constants.CONFIRMATIONS;
  }

  async fetchLedgerTransactions(connection, ledger_index) {
    const ledger = await this.connectionSend(connection, {
      command: 'ledger',
      ledger_index: parseInt(ledger_index),
      transactions: true,
      expand: false
    }).then(value => value.result.ledger);

    assert(ledger.closed === true);

    if (typeof ledger.transactions === 'undefined' || ledger.transactions.length === 0) {
      return { ledger: ledger, transactions: [] };
    }

    if (ledger.transactions.length > 200) {
      logger.info(`<<< TOO MANY TXS at ledger ${ledger_index}: [[ ${ledger.transactions.length} ]], processing per-tx...`);
      let transactions = ledger.transactions.map(tx =>
        this.connectionSend(connection, {
          command: 'tx',
          transaction: tx,
          minLedgerVersion: ledger_index,
          maxLedgerVersion: ledger_index
        }).catch((error) => {
          if (error.message === 'txnNotFound') {
            return Promise.resolve(null);
          }

          return Promise.reject(error);
        })
      );

      transactions = await Promise.all(transactions);

      transactions = transactions.filter(t => t);

      return { ledger: ledger, transactions };
    }

    const result = await this.connectionSend(connection, {
      command: 'ledger',
      ledger_index: parseInt(ledger_index),
      transactions: true,
      expand: true
    }).then(value => value.result.ledger);

    assert(result.closed === true);

    return { ledger: ledger, transactions: result.transactions };
  }

  checkAllTransactionsValid(ledgers) {
    for (let indexLedger = 0; indexLedger < ledgers.length; indexLedger++) {
      const transactions = ledgers[indexLedger].transactions;
      const blockNumber = ledgers[indexLedger].ledger.ledger_index;
      for (let index = 0; index < transactions.length; index++) {
        const transaction = transactions[index];
        if ('validated' in transaction && !transaction.validated) {
          logger.error(`Transaction ${transaction.hash} at index ${index} in block ${blockNumber} is not validated. Aborting.`);
          process.exit(-1);
        }
        if (!('meta' in transaction) && !('metaData' in transaction)) {
          logger.error(`Transaction ${transaction.hash} at index ${index} in block ${blockNumber} is missing 'meta' field. Aborting.`);
          process.exit(-1);
        }
      }
    }
  }

  async work() {
    if (this.lastConfirmedBlock === this.lastExportedBlock) {
      this.sleepTimeMsec = constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      const lastValidatedLedger = await this.connectionSend(this.connections[0], {
        command: 'ledger',
        ledger_index: 'validated',
        transactions: true,
        expand: false
      });
      const newConfirmedBlock = parseInt(lastValidatedLedger.result.ledger.ledger_index) - constants.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    } else {
      this.sleepTimeMsec = 0;
    }
    const toBlock = Math.min(this.lastExportedBlock + constants.SEND_BATCH_SIZE, this.lastConfirmedBlock);
    let fromBlock = this.lastExportedBlock + 1;

    const requests = [];
    let transfers = [];
    logger.info(`Fetching transfers for interval ${fromBlock}:${toBlock}`);
    for (fromBlock; fromBlock <= toBlock; fromBlock++) {
      requests.push(
        this.fetchLedgerTransactions(this.connections[fromBlock % this.connections.length], fromBlock)
      );
    }
    const resolvedRequests = await Promise.all(requests);
    const ledgers = resolvedRequests.map(({ ledger, transactions }) => {
      return { ledger, transactions, primaryKey: ledger.ledger_index };
    });
    this.checkAllTransactionsValid(ledgers);

    this.lastExportTime = Date.now();
    this.lastExportedBlock = toBlock;
    if (ledgers.length > 0) {
      this.lastPrimaryKey = ledgers[ledgers.length - 1].primaryKey;
    }

    transfers = transfers.concat(ledgers);

    return transfers;
  }
}

module.exports = {
  worker: XRPWorker
};
