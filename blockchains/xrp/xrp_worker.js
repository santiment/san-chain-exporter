'use strict';
const xrpl = require('xrpl');
const assert = require('assert');
const { logger } = require('../../lib/logger');
const BaseWorker = require('../../lib/worker_base');

class XRPWorker extends BaseWorker {
  constructor(constants) {
    super();

    this.constants = constants;
    this.nodeURLs = constants.XRP_NODE_URLS.split(',');
    this.connections = [];
    this.retryIntervalMs = 1000;
  }

  async createNewSetConnections() {
    const PQueue = (await import('p-queue')).default;
    if (this.nodeURLs.length === 0) {
      throw 'Error: All API URLs returned error.';
    }

    for (let i = 0; i < this.constants.CONNECTIONS_COUNT; i++) {
      const clientOptions = { timeout: this.constants.DEFAULT_WS_TIMEOUT };
      const nodeURL = this.nodeURLs[i % this.nodeURLs.length];
      logger.info(`Using ${nodeURL} as XRPL API endpoint.`);
      const api = new xrpl.Client(nodeURL, clientOptions);

      api.on('error', (...error) => {
        logger.error('Error in XRPL API connection number: ' + i + error);
        process.exit(-1);
      });
      await api.connect();

      this.connections.push({
        connection: api,
        queue: new PQueue({ concurrency: this.constants.MAX_CONNECTION_CONCURRENCY }),
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
    this.lastConfirmedBlock = parseInt(lastValidatedLedgerData.ledger.ledger_index) - this.constants.CONFIRMATIONS;
  }

  isEmptyTransactionHash(transaction_hash) {
    for (const char of transaction_hash) {
      if (char !== '0') {
        return false;
      }
    }
    return true;
  }

  async fetchLedger(connection, ledger_index, should_expand) {
    for (let i = 0; i < this.constants.XRP_ENDPOINT_RETRIES; i++) {
      const result = await this.connectionSend(connection, {
        command: 'ledger',
        ledger_index: parseInt(ledger_index),
        transactions: true,
        expand: should_expand
      });

      const ledger = result.result.ledger;

      assert(ledger.closed === true);
      assert(typeof ledger.transactions !== 'undefined');
      assert(typeof ledger.transaction_hash !== 'undefined');

      if (ledger.transactions.length === 0 && !this.isEmptyTransactionHash(ledger.transaction_hash)) {
        // This block is invalid, the problem must be in the Endpoint. Wait and retry.
        await new Promise((resolve) => setTimeout(resolve, this.retryIntervalMs));
        logger.info(`Ledger ${ledger_index} is being retried due to invalid response`);
      }
      else {
        return ledger;
      }
    }

    throw new Error(`Error: Exhausted retry attempts for block ${ledger_index}.`);
  }

  async fetchTransactions(connection, transactions, ledger_index) {
    const transactionsPromise = transactions.map(tx =>
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

    const resolvedTransactions = await Promise.all(transactionsPromise);

    // When transactions are fetched one by one, we need to take the 'result' field
    return resolvedTransactions.map(t => t.result);
  }

  async fetchLedgerTransactions(connection, ledger_index) {
    const ledger = await this.fetchLedger(connection, ledger_index, false);

    if (ledger.transactions.length > 200) {
      logger.info(`<<< TOO MANY TXS at ledger ${ledger_index}: [[ ${ledger.transactions.length} ]], processing per-tx...`);
      const transactions = await this.fetchTransactions(connection, ledger.transactions, ledger_index);
      return { ledger: ledger, transactions: transactions };
    }
    else {
      const ledgerWithExpandedTransactions = await this.fetchLedger(connection, ledger_index, true);
      return { ledger: ledger, transactions: ledgerWithExpandedTransactions.transactions };
    }
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
      this.sleepTimeMsec = this.constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      const lastValidatedLedger = await this.connectionSend(this.connections[0], {
        command: 'ledger',
        ledger_index: 'validated',
        transactions: true,
        expand: false
      });
      const newConfirmedBlock = parseInt(lastValidatedLedger.result.ledger.ledger_index) - this.constants.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    } else {
      this.sleepTimeMsec = 0;
    }
    const toBlock = Math.min(this.lastExportedBlock + this.constants.SEND_BATCH_SIZE, this.lastConfirmedBlock);
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
