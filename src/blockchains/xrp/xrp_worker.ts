'use strict';
import { Client, ConnectionError, LedgerRequest, RippledError } from 'xrpl';
import assert from 'assert';
import { logger } from '../../lib/logger';
import { BaseWorker } from '../../lib/worker_base';
import { XRPConnection } from './xrp_types';

export class XRPWorker extends BaseWorker {
  private nodeURLs: string;
  private connections: XRPConnection[];
  private retryIntervalMs: number;
  private connectionError: Error | null;

  constructor(settings: any) {
    super(settings);

    this.nodeURLs = settings.XRP_NODE_URLS.split(',');
    this.connections = [];
    this.retryIntervalMs = 1000;
    this.connectionError = null;
  }

  async createNewSetConnections() {
    const PQueue = (await import('p-queue')).default;
    if (this.nodeURLs.length === 0) {
      throw 'Error: All API URLs returned error.';
    }

    for (let i = 0; i < this.settings.CONNECTIONS_COUNT; i++) {
      // 'timeout' bounds individual requests, 'connectionTimeout' the WebSocket handshake (xrpl.js default: 5s,
      // too short for a public cluster under load).
      const clientOptions = { timeout: this.settings.DEFAULT_WS_TIMEOUT, connectionTimeout: this.settings.DEFAULT_WS_TIMEOUT };
      const nodeURL = this.nodeURLs[i % this.nodeURLs.length];
      logger.info(`Using ${nodeURL} as XRPL API endpoint.`);
      const api = new Client(nodeURL, clientOptions);

      api.on('error', (...error) => {
        this.recordConnectionError(i, error);
      });
      await this.connectWithRetries(api, i);

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

  /**
   * Open the WebSocket of a client, retrying transient failures (handshake timeout, connection refused, ...) with
   * the same bounded backoff as dropped connections, but with the smaller XRP_CONNECT_RETRIES budget. Anything
   * that is not a connection error is thrown right away.
   */
  async connectWithRetries(api: Client, connectionIndex: number) {
    for (let attempt = 0; ; attempt++) {
      try {
        await api.connect();
        return;
      }
      catch (err: unknown) {
        if (!isConnectionError(err) || attempt + 1 >= this.settings.XRP_CONNECT_RETRIES) {
          throw err;
        }
        const waitMs = Math.min(this.retryIntervalMs * (attempt + 1), MAX_RECONNECT_WAIT_MS);
        logger.warn(`XRPL API connection number ${connectionIndex} could not be opened: ${(err as Error).message}. ` +
          `Retrying in ${waitMs} ms (attempt ${attempt + 1}/${this.settings.XRP_CONNECT_RETRIES}).`);
        await this.sleep(waitMs);
      }
    }
  }

  /**
   * Send a request over the given connection. Recoverable failures (see recoverFromRequestError) are retried up to
   * XRP_ENDPOINT_RETRIES times, anything else is thrown.
   */
  async connectionSend(connection: XRPConnection, params: LedgerRequest) {
    for (let attempt = 0; ; attempt++) {
      this.throwConnectionErrorIfAny();
      try {
        const response = await connection.queue.add(() => {
          return connection.connection.request(params);
        });
        this.throwConnectionErrorIfAny();
        return response;
      }
      catch (err: unknown) {
        await this.recoverFromRequestError(connection, err, attempt);
      }
    }
  }

  /**
   * Decide whether a failed request can be retried and, if so, wait until it makes sense to retry. Two kinds of
   * failures are recoverable:
   *  - Rate limit errors returned by the XRPL endpoint. The connection's request queue is paused for the interval
   *    suggested by the endpoint (or a default one) so that we stop sending requests while the endpoint rejects them.
   *    Public clusters close the WebSocket of clients which keep sending while being rate limited.
   *  - Connection errors (dropped WebSocket, request timeout). We wait, make sure the connection is re-established
   *    and retry.
   * Rethrows the error when it is of another kind or when the retries are exhausted.
   */
  async recoverFromRequestError(connection: XRPConnection, err: unknown, attempt: number) {
    if (attempt + 1 >= this.settings.XRP_ENDPOINT_RETRIES) {
      throw err;
    }
    const attemptInfo = `attempt ${attempt + 1}/${this.settings.XRP_ENDPOINT_RETRIES}`;
    if (isRateLimitError(err)) {
      await this.recoverFromRateLimit(connection, err as Error, attemptInfo);
    }
    else if (isConnectionError(err) || !connection.connection.isConnected()) {
      // Whatever the error is, if the connection is not open at this point the request could not have been served;
      // reconnect and retry rather than fail.
      await this.recoverFromConnectionError(connection, err as Error, attempt, attemptInfo);
    }
    else {
      throw err;
    }
  }

  private async recoverFromRateLimit(connection: XRPConnection, err: Error, attemptInfo: string) {
    const waitMs = rateLimitRetryDelayMs(err, this.retryIntervalMs);
    logger.warn(`Rate limited by XRPL API connection number ${connection.index}: ${err.message}. ` +
      `Pausing requests for ${waitMs} ms (${attemptInfo}).`);
    await this.pauseConnection(connection, waitMs);
  }

  private async recoverFromConnectionError(connection: XRPConnection, err: Error, attempt: number, attemptInfo: string) {
    const waitMs = Math.min(this.retryIntervalMs * (attempt + 1), MAX_RECONNECT_WAIT_MS);
    logger.warn(`XRPL API connection number ${connection.index} failed: ${err.message}. ` +
      `Reconnecting and retrying in ${waitMs} ms (${attemptInfo}).`);
    await this.sleep(waitMs);
    await this.ensureConnected(connection);
  }

  /**
   * Pause the request queue of the connection for `waitMs`. Concurrent calls (several in-flight requests being
   * rejected at once) extend the pause to the latest deadline. Resolves once `waitMs` has elapsed.
   */
  async pauseConnection(connection: XRPConnection, waitMs: number) {
    const until = Date.now() + waitMs;
    if (until > (connection.pausedUntil ?? 0)) {
      connection.pausedUntil = until;
      connection.queue.pause();
    }
    await this.sleep(waitMs);
    if (connection.pausedUntil === until) {
      connection.pausedUntil = undefined;
      connection.queue.start();
    }
  }

  /**
   * Re-establish the WebSocket connection if it is not open. Failures are only logged: the caller retries the
   * request, which fails again with a connection error and lands here again, until the retries are exhausted.
   */
  async ensureConnected(connection: XRPConnection) {
    if (connection.connection.isConnected()) {
      return;
    }
    try {
      await connection.connection.connect();
      logger.info(`XRPL API connection number ${connection.index} re-established.`);
    }
    catch (err: unknown) {
      logger.warn(`XRPL API connection number ${connection.index} could not be re-established yet: ${(err as Error).message}`);
    }
  }

  async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Best effort logging of the rate limit quota the endpoint grants us. The 'quota' command is specific to public
   * clusters (xrplcluster.com); rippled nodes reject it, which is fine.
   */
  async logEndpointQuota(connection: XRPConnection) {
    try {
      const response: any = await connection.connection.request({ command: 'quota' } as any);
      logger.info(`XRPL endpoint quota for connection number ${connection.index}: ${JSON.stringify(response.result)}`);
    }
    catch (err: unknown) {
      logger.info(`XRPL endpoint does not report a quota (connection number ${connection.index}): ${(err as Error).message}`);
    }
  }

  async init() {
    await this.createNewSetConnections();
    this.throwConnectionErrorIfAny();
    await this.logEndpointQuota(this.connections[0]);
    const lastValidatedLedger = await this.connectionSend(this.connections[0], {
      command: 'ledger',
      ledger_index: 'validated',
      transactions: true,
      expand: false
    });
    const lastValidatedLedgerData = lastValidatedLedger.result;
    this.lastConfirmedBlock = parseInt(lastValidatedLedgerData.ledger.ledger_index) - this.settings.CONFIRMATIONS;
  }

  private recordConnectionError(connectionIndex: number, errorParts: unknown[]) {
    if (errorParts[0] === 'reconnect') {
      // The xrpl.js client failed one of its own automatic reconnection attempts after the WebSocket dropped.
      // Not fatal: requests fail with a connection error and connectionSend() keeps reconnecting and retrying.
      logger.warn(`XRPL API connection number ${connectionIndex} failed to reconnect: ${String(errorParts[1])}`);
      return;
    }
    const details = errorParts
      .map((errorPart) => {
        if (errorPart instanceof Error) {
          return errorPart.message;
        }
        if (typeof errorPart === 'string') {
          return errorPart;
        }
        try {
          return JSON.stringify(errorPart);
        } catch (_err) {
          return String(errorPart);
        }
      })
      .join(', ');
    const errorMessage = details.length > 0
      ? `Error in XRPL API connection number: ${connectionIndex}: ${details}`
      : `Error in XRPL API connection number: ${connectionIndex}`;

    logger.error(errorMessage);
    if (this.connectionError === null) {
      this.connectionError = new Error(errorMessage);
    }
  }

  private throwConnectionErrorIfAny() {
    if (this.connectionError !== null) {
      throw this.connectionError;
    }
  }

  isEmptyTransactionHash(transaction_hash: string) {
    for (const char of transaction_hash) {
      if (char !== '0') {
        return false;
      }
    }
    return true;
  }

  async fetchLedger(connection: XRPConnection, ledger_index: number, should_expand: boolean) {
    for (let i = 0; i < this.settings.XRP_ENDPOINT_RETRIES; i++) {
      const result = await this.connectionSend(connection, {
        command: 'ledger',
        ledger_index: ledger_index,
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

  async fetchLedgerTransactions(connection: XRPConnection, ledger_index: number) {
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
    const transactionList = ledger.transactions.map((transaction: any) => transaction.hash);
    const expandedTransactions = ledger.transactions;
    ledger.transactions = transactionList;
    return { ledger: ledger, transactions: expandedTransactions };
  }

  checkAllTransactionsValid(ledgers: any) {
    for (let indexLedger = 0; indexLedger < ledgers.length; indexLedger++) {
      const transactions = ledgers[indexLedger].transactions;
      const blockNumber = ledgers[indexLedger].ledger.ledger_index;
      logger.info(`Block number ${blockNumber} has ${transactions.length} transactions`);
      for (let index = 0; index < transactions.length; index++) {
        validateXRPTransaction(transactions[index], index, blockNumber);
      }
    }
  }

  async work() {
    this.throwConnectionErrorIfAny();
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
    logger.info(`Fetching transfers for interval ${fromBlock}:${toBlock}`);
    for (fromBlock; fromBlock <= toBlock; fromBlock++) {
      requests.push(
        this.fetchLedgerTransactions(this.connections[fromBlock % this.connections.length], fromBlock)
      );
    }
    const resolvedRequests = await Promise.all(requests);
    this.throwConnectionErrorIfAny();
    const ledgers = resolvedRequests.map(({ ledger, transactions }) => {
      return { ledger, transactions, primaryKey: ledger.ledger_index };
    });
    this.checkAllTransactionsValid(ledgers);

    this.lastExportedBlock = toBlock;
    if (ledgers.length > 0) {
      this.lastPrimaryKey = ledgers[ledgers.length - 1].primaryKey;
    }

    return ledgers;
  }
}

/**
 * Extra time added on top of the retry interval suggested by the endpoint, so that we do not hit the limit again
 * by retrying a bit too early.
 */
const RATE_LIMIT_RETRY_MARGIN_MS = 500;

/** Wait applied when the endpoint rejects us for load without saying when to retry. rippled's load penalty decays
 * over a few seconds, so retrying sooner mostly burns retries. */
const NO_HINT_RETRY_MS = 5000;

/**
 * rippled error codes meaning "you are sending too much, back off": 'tooBusy' ("The server is too busy to help you
 * now."), 'slowDown' ("You are placing too much load on the server."). 'rateLimit' is used by some proxies.
 */
const RATE_LIMIT_ERROR_CODES = ['tooBusy', 'slowDown', 'rateLimit'];

/** Upper bound of the wait between attempts to re-establish a dropped connection. */
const MAX_RECONNECT_WAIT_MS = 30000;

/**
 * Check whether an error is a transport level error of the xrpl.js client (dropped WebSocket, not connected,
 * request timeout, ...), as opposed to an error returned by the XRPL endpoint.
 */
export function isConnectionError(err: unknown): boolean {
  if (err instanceof ConnectionError) {
    return true;
  }
  // While the xrpl.js client is re-establishing a dropped WebSocket, sending a request makes the underlying 'ws'
  // library throw a plain Error ("WebSocket is not open: readyState 0 (CONNECTING)"), which xrpl.js does not wrap.
  return err instanceof Error && err.message.startsWith('WebSocket is not open');
}

/**
 * Check whether an error returned by the XRPL endpoint indicates that we are being rate limited.
 *
 * Public clusters (e.g. xrplcluster.com) respond with a 'rate limit: units quota (N per 10s) exhausted, retry in ~Xms'
 * error message, while rippled itself responds with the 'slowDown' error code.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof RippledError)) {
    return false;
  }
  const data: any = err.data;
  if (data && RATE_LIMIT_ERROR_CODES.includes(data.error)) {
    return true;
  }
  if (typeof err.message !== 'string') {
    return false;
  }
  const message = err.message.toLowerCase();
  return message.includes('rate limit') || message.includes('too busy') || message.includes('too much load');
}

/**
 * Extract the retry delay suggested by a rate limit error message ('... retry in ~6353ms'). Without a hint
 * (rippled's 'tooBusy' / 'slowDown' just say to back off) fall back to NO_HINT_RETRY_MS or the provided default,
 * whichever is larger. A small margin is added on top.
 */
export function rateLimitRetryDelayMs(err: unknown, defaultMs: number): number {
  const message = err instanceof Error ? err.message : '';
  const match = message.match(/retry in ~?(\d+)\s*ms/i);
  const suggestedMs = match ? parseInt(match[1]) : Math.max(defaultMs, NO_HINT_RETRY_MS);
  return Math.max(suggestedMs, defaultMs) + RATE_LIMIT_RETRY_MARGIN_MS;
}

/**
 * Validate a single XRP transaction. Throws if the transaction is not validated
 * or is missing the required 'meta'/'metaData' field.
 */
export function validateXRPTransaction(transaction: any, index: number, blockNumber: string) {
  if ('validated' in transaction && !transaction.validated) {
    throw new Error(`Transaction ${transaction.hash} at index ${index} in block ${blockNumber} is not validated.`);
  }
  if (!('meta' in transaction) && !('metaData' in transaction)) {
    throw new Error(`Transaction ${transaction.hash} at index ${index} in block ${blockNumber} is missing 'meta' field.`);
  }
}
