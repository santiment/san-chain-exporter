'use strict';
import xrpl, { LedgerRequest } from 'xrpl';
import assert from 'assert';
import { logger } from '../../lib/logger';
import { BaseWorker } from '../../lib/worker_base';
import { XRPConnection } from './xrp_types';

class XRPWorker extends BaseWorker {
  private nodeURLs: string;
  private connections: XRPConnection[];
  private retryIntervalMs: number;

  constructor(settings: any) {
    super(settings);

    this.nodeURLs = settings.XRP_NODE_URLS.split(',');
    this.connections = [];
    this.retryIntervalMs = 1000;
  }

  async createNewSetConnections() {
    const PQueue = (await import('p-queue')).default;
    if (this.nodeURLs.length === 0) {
      throw 'Error: All API URLs returned error.';
    }

    for (let i = 0; i < this.settings.CONNECTIONS_COUNT; i++) {
      const clientOptions = { timeout: this.settings.DEFAULT_WS_TIMEOUT };
      const nodeURL = this.nodeURLs[i % this.nodeURLs.length];
      logger.info(`Using ${nodeURL} as XRPL API endpoint.`);
      const api = new xrpl.Client(nodeURL, clientOptions);

      api.on('error', (...error) => {
        logger.error('Error in XRPL API connection number: ' + i + error);
        process.exit(-1);
      });
      await api.connect();

      const pQueueSettings: any = { concurrency: this.settings.MAX_CONNECTION_CONCURRENCY };
      if (this.settings.REQUEST_RATE_INTERVAL_MSEC > 0 && this.settings.REQUEST_RATE_INTERVAL_CAP > 0) {
        pQueueSettings.interval = this.settings.REQUEST_RATE_INTERVAL_MSEC;
        pQueueSettings.intervalCap = this.settings.REQUEST_RATE_INTERVAL_CAP;
        pQueueSettings.carryoverConcurrencyCount = true;
        logger.info(`Applying rate limit: ${pQueueSettings.intervalCap} requests per ${pQueueSettings.interval} milliseconds`);
      }

      this.connections.push({
        connection: api,
        queue: new PQueue(pQueueSettings),
        index: i
      });
    }
  }

  async connectionSend(connection: XRPConnection, params: LedgerRequest) {
    return connection.queue.add(() => {
      return connection.connection.request(params);
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
    this.lastConfirmedBlock = parseInt(lastValidatedLedgerData.ledger.ledger_index) - this.settings.CONFIRMATIONS;
  }

  isEmptyTransactionHash(transaction_hash: string) {
    for (const char of transaction_hash) {
      if (char !== '0') {
        return false;
      }
    }
    return true;
  }

  async fetchLedger(connection, ledger_index, should_expand) {
    for (let i = 0; i < this.settings.XRP_ENDPOINT_RETRIES; i++) {
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

  async fetchLedgerTransactions(connection, ledger_index) {
    /**
     * Request the expanded transactions. We have seen cases in the past where the XRPL Node would respond that
     * the response is too big. In this case in the past we have resolved to fetching per-tx, but this exhausts the
     * rate limit pretty fast. We need to contemplate different ways how to break the response in this case.
     * Maybe with some filter like:
     * https://github.com/XRPLF/xrpl.js/issues/2611#issuecomment-1875579443
     */
    const ledger = await this.fetchLedger(connection, ledger_index, true);
    if (ledger.warning) {
      logger.warn(`Rate limit warning: ${ledger.warning}`);
    }

    /* For legacy reasons the response need to contain the compact transaction hashes at the `leger.transactions`
     * level. The expanded transactions are located at the top level. Example:
     *
     *
     *  {
     *    "ledger": {
     *      "transactions": [ Comma separated tx hashes here ]
     *     },
     *     "transactions": [ Expanded txs here ]
     *  }
     *
     **/
    const transactionList = ledger.transactions.map(transaction => transaction.hash);
    const expandedTransactions = ledger.transactions;
    ledger.transactions = transactionList;
    return { ledger: ledger, transactions: expandedTransactions };
  }

  checkAllTransactionsValid(ledgers) {
    for (let indexLedger = 0; indexLedger < ledgers.length; indexLedger++) {
      const transactions = ledgers[indexLedger].transactions;
      const blockNumber = ledgers[indexLedger].ledger.ledger_index;
      logger.info(`Block number ${blockNumber} has ${transactions.length} transactions`);
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
      this.sleepTimeMsec = this.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      const lastValidatedLedger = await this.connectionSend(this.connections[0], {
        command: 'ledger',
        ledger_index: 'validated',
        transactions: true,
        expand: false
      });
      const newConfirmedBlock = parseInt(lastValidatedLedger.result.ledger.ledger_index) - this.settings.CONFIRMATIONS;
      if (newConfirmedBlock === this.lastConfirmedBlock) {
        return [];
      }
      this.lastConfirmedBlock = newConfirmedBlock;
    } else {
      this.sleepTimeMsec = 0;
    }
    const toBlock = Math.min(this.lastExportedBlock + this.settings.SEND_BATCH_SIZE, this.lastConfirmedBlock);
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
