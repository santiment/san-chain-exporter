/*jshint esversion: 6 */
import assert from 'assert';
const sinon = require('sinon');
import { XRPWorker, validateXRPTransaction, isRateLimitError, rateLimitRetryDelayMs, isConnectionError } from '../../blockchains/xrp/xrp_worker';
import { XRPConnection } from '../../blockchains/xrp/xrp_types';
import * as constants from '../../blockchains/xrp/lib/constants';

/** A stripped down XRP block */
const xrpBlock = {
  'ledger': {
    'accepted': true,
    'hash': '01AFAE9D64B549B014EC1FCCEB7A0EBFA34A0BE3D84B4909B3C9D7B7B0DE076A',
    'ledger_hash': '01AFAE9D64B549B014EC1FCCEB7A0EBFA34A0BE3D84B4909B3C9D7B7B0DE076A',
    'ledger_index': '3232710',
    'transaction_hash': '0993BFF01B90E030E065ECA2752EB563466FCA31356CBA2C495B5E5407117FC5',
    'transactions': [
      'D52DC46F5E7EB1068256AF2C42331CC23AC9F0C83824A1909F2141FEC001DBCF'
    ]
  },
  'transactions': [
    {
      'Account': 'rUqNn26jQG8zfNDy21NTCwgFXrFgLyRf3U',
      'Fee': '10',
      'Flags': 0,
      'Sequence': 101317,
      'SigningPubKey': '02B1A8D1DF2C281BA7A872B59E765A0CE7B7A31D8A7ACD7030DA2E45C4D33CF2C4',
      'metaData': {
        'AffectedNodes': []
      }
    }
  ]
};

const mockFetchLedgerTransactions = (_connection: any, ledger_index: number) => {
  const localBlock: any = structuredClone(xrpBlock);
  localBlock.ledger.ledger_index = ledger_index;
  return localBlock;
};

describe('workLoopSimpleTest', function () {
  it('Checking that position is being updated', async function () {
    const worker = new XRPWorker(constants);
    sinon.stub(worker, 'fetchLedgerTransactions').callsFake(mockFetchLedgerTransactions);

    // Set a huge last confirmed Node block, so that we do not ask the node and mock more easily.
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 20;
    await worker.work();

    const lastProcessedPosition = worker.getLastProcessedPosition();

    // The above loop should have progressed the lastProcessedPosition to the last known Node block
    assert.deepStrictEqual(
      lastProcessedPosition,
      {
        blockNumber: 20,
        primaryKey: 20
      }
    );
  });

  it('Checking that expected result is returned', async function () {
    const worker = new XRPWorker(constants);
    sinon.stub(worker, 'fetchLedgerTransactions').callsFake(mockFetchLedgerTransactions);

    // Set a huge last confirmed Node block, so that we do not ask the node and mock more easily.
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 20;
    const result = await worker.work();

    const expectedResult = [];

    for (let ledger_index = 11; ledger_index <= 20; ++ledger_index) {
      const localBlock: any = structuredClone(xrpBlock);
      localBlock.ledger.ledger_index = ledger_index;
      localBlock.primaryKey = ledger_index;
      expectedResult.push(localBlock);
    }
    assert.deepStrictEqual(result, expectedResult);
  });

  // Previously these cases called process.exit(-1), which killed the process without cleanup.
  // Now they throw errors that propagate through the work loop for graceful handling.
  // Tests use the extracted validateXRPTransaction() directly for isolated coverage.
  it('validateXRPTransaction throws on unvalidated transaction', function () {
    assert.throws(
      () => validateXRPTransaction({ hash: 'abc', validated: false, meta: {} }, 0, '100'),
      (err: Error) => err.message.includes('is not validated')
    );
  });

  // A transaction without 'meta' or 'metaData' is corrupt and must not be silently exported.
  it('validateXRPTransaction throws on missing meta field', function () {
    assert.throws(
      () => validateXRPTransaction({ hash: 'def' }, 0, '100'),
      (err: Error) => err.message.includes("missing 'meta' field")
    );
  });

  // Sanity check: valid transactions (with 'meta' or 'metaData') pass without throwing.
  it('validateXRPTransaction passes with meta', function () {
    validateXRPTransaction({ hash: 'abc', validated: true, meta: {} }, 0, '100');
  });

  it('validateXRPTransaction passes with metaData', function () {
    validateXRPTransaction({ hash: 'abc', metaData: {} }, 0, '100');
  });

  // A transaction without the 'validated' field at all should not throw (only explicit false is invalid).
  it('validateXRPTransaction passes when validated field is absent', function () {
    validateXRPTransaction({ hash: 'abc', meta: {} }, 0, '100');
  });

  it('work surfaces stored XRPL connection errors through the async work loop', async function () {
    const worker = new XRPWorker(constants);
    (worker as any).connectionError = new Error('XRPL connection dropped');
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 20;

    await assert.rejects(async () => worker.work(), /XRPL connection dropped/);
  });

  it('should loop several times due to lack of transactions', async () => {
    const worker = new XRPWorker(constants);
    // The invalid block would have no transactions but a non 0 transaction_hash
    const invalidBlock = {
      result: {
        ledger: {
          transactions: [],
          closed: true,
          transaction_hash: "1111111111111"
        }
      }
    };
    const validEmptyBlock = {
      result: {
        ledger: {
          transactions: [],
          closed: true,
          transaction_hash: '0'.repeat(64)
        }
      }
    };

    // We mock the connection send call and count how many times it is called
    let sendCallsCount = 0;
    // Reduce the retry interval so that tests finishes fast
    const retryIntervalMs = 100
    sinon.stub(worker, 'retryIntervalMs').value(retryIntervalMs);
    worker.connectionSend = () => {
      sendCallsCount += 1;
      return Promise.resolve(invalidBlock);
    };

    let sendCallsCountWhileInvalid = 0;
    // After a timeout, switch the mock function to return the valid block. Remember how many calls were made up until that moment.
    setTimeout(() => {
      sendCallsCountWhileInvalid = sendCallsCount;
      worker.connectionSend = () => {
        sendCallsCount += 1;
        return Promise.resolve(validEmptyBlock);
      };
    }, 2 * retryIntervalMs);

    const connection = null as unknown as XRPConnection; // Bypass TypeScript type checking
    // This call should eventually return, once the callback returns the correct block
    const fetchResult = await worker.fetchLedgerTransactions(connection, 1)

    assert.ok(sendCallsCountWhileInvalid >= 2);
    assert.ok(sendCallsCount >= 3);
    assert.deepStrictEqual(fetchResult, { ledger: validEmptyBlock.result.ledger, transactions: [] });
  });
});

describe('rateLimitHandling', function () {
  const { RippledError } = require('xrpl');
  const rateLimitMessage = 'rate limit: units quota (2000 per 10s) exhausted, retry in ~6353ms';

  const makeRateLimitError = () => new RippledError(rateLimitMessage, { error: rateLimitMessage, status: 'error' });

  /** A fake XRP connection whose queue executes the task right away and records pause()/start() calls. */
  const makeConnection = (request: any, extra: any = {}): XRPConnection => ({
    connection: { request, isConnected: () => true, connect: async () => undefined, ...extra } as any,
    queue: { add: (task: () => any) => task(), pause: sinon.spy(), start: sinon.spy() } as any,
    index: 0
  });

  it('isRateLimitError recognizes rate limit errors', function () {
    assert.strictEqual(isRateLimitError(makeRateLimitError()), true);
    assert.strictEqual(isRateLimitError(new RippledError('You are placing too much load on the server.', { error: 'slowDown' })), true);
    assert.strictEqual(isRateLimitError(new RippledError('The server is too busy to help you now.', { error: 'tooBusy' })), true);
    assert.strictEqual(isRateLimitError(new RippledError('The server is too busy to help you now.')), true);
    assert.strictEqual(isRateLimitError(new RippledError('ledgerNotFound', { error: 'lgrNotFound' })), false);
    assert.strictEqual(isRateLimitError(new Error(rateLimitMessage)), false);
    assert.strictEqual(isRateLimitError('rate limit'), false);
  });

  it('rateLimitRetryDelayMs honors the delay suggested by the endpoint', function () {
    assert.strictEqual(rateLimitRetryDelayMs(makeRateLimitError(), 1000), 6353 + 500);
    // No hint from the endpoint: back off for at least NO_HINT_RETRY_MS (5s).
    assert.strictEqual(rateLimitRetryDelayMs(new RippledError('slowDown', { error: 'slowDown' }), 1000), 5000 + 500);
    assert.strictEqual(rateLimitRetryDelayMs(new RippledError('The server is too busy to help you now.', { error: 'tooBusy' }), 8000), 8000 + 500);
    assert.strictEqual(rateLimitRetryDelayMs(new RippledError('retry in ~10ms'), 1000), 1000 + 500);
  });

  it('connectionSend pauses the queue and retries on rate limit errors', async function () {
    const worker = new XRPWorker(constants);
    const sleepStub = sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub();
    request.onCall(0).rejects(makeRateLimitError());
    request.onCall(1).rejects(makeRateLimitError());
    request.onCall(2).resolves({ result: { ledger: {} } });
    const connection = makeConnection(request);

    const result = await worker.connectionSend(connection, { command: 'ledger', ledger_index: 1 });

    assert.deepStrictEqual(result, { result: { ledger: {} } });
    assert.strictEqual(request.callCount, 3);
    assert.strictEqual(sleepStub.callCount, 2);
    assert.strictEqual(sleepStub.firstCall.args[0], 6353 + 500);
    assert.strictEqual(connection.queue.pause.callCount, 2);
    assert.strictEqual(connection.queue.start.callCount, 2);
    assert.strictEqual(connection.pausedUntil, undefined);
  });

  it('pauseConnection keeps the queue paused until the latest deadline', async function () {
    const worker = new XRPWorker(constants);
    const connection = makeConnection(sinon.stub());
    const clock = sinon.useFakeTimers({ now: 1000000 });
    try {
      const shortPause = worker.pauseConnection(connection, 1000);
      const longPause = worker.pauseConnection(connection, 5000);
      assert.strictEqual(connection.queue.pause.callCount, 2);

      await clock.tickAsync(1000);
      await shortPause;
      // The short pause elapsed, but a longer one is still in effect: the queue must stay paused.
      assert.strictEqual(connection.queue.start.callCount, 0);
      assert.strictEqual(connection.pausedUntil, 1000000 + 5000);

      await clock.tickAsync(4000);
      await longPause;
      assert.strictEqual(connection.queue.start.callCount, 1);
      assert.strictEqual(connection.pausedUntil, undefined);
    } finally {
      clock.restore();
    }
  });

  it('connectionSend reconnects and retries on connection errors', async function () {
    const { DisconnectedError } = require('xrpl');
    const worker = new XRPWorker(constants);
    const sleepStub = sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub();
    request.onCall(0).rejects(new DisconnectedError('WebSocket is not open: readyState 2 (CLOSING)'));
    request.onCall(1).resolves({ result: { ledger: {} } });
    let connected = false;
    const connect = sinon.stub().callsFake(async () => { connected = true; });
    const connection = makeConnection(request, { isConnected: () => connected, connect });

    const result = await worker.connectionSend(connection, { command: 'ledger', ledger_index: 1 });

    assert.deepStrictEqual(result, { result: { ledger: {} } });
    assert.strictEqual(request.callCount, 2);
    assert.strictEqual(connect.callCount, 1);
    assert.strictEqual(sleepStub.callCount, 1);
    assert.strictEqual(connection.queue.pause.callCount, 0);
  });

  it('connectionSend keeps retrying when reconnecting fails', async function () {
    const { NotConnectedError } = require('xrpl');
    const worker = new XRPWorker({ ...constants, XRP_ENDPOINT_RETRIES: 3 });
    sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub().rejects(new NotConnectedError('not connected'));
    const connect = sinon.stub().rejects(new Error('Websocket connection never cleaned up.'));
    const connection = makeConnection(request, { isConnected: () => false, connect });

    await assert.rejects(
      worker.connectionSend(connection, { command: 'ledger', ledger_index: 1 }),
      (err: any) => err instanceof NotConnectedError
    );
    assert.strictEqual(request.callCount, 3);
    assert.strictEqual(connect.callCount, 2);
  });

  it('isConnectionError recognizes xrpl.js transport errors and raw ws errors only', function () {
    const { DisconnectedError, NotConnectedError, TimeoutError } = require('xrpl');
    assert.strictEqual(isConnectionError(new DisconnectedError('x')), true);
    assert.strictEqual(isConnectionError(new NotConnectedError('x')), true);
    assert.strictEqual(isConnectionError(new TimeoutError('x')), true);
    assert.strictEqual(isConnectionError(new Error('WebSocket is not open: readyState 0 (CONNECTING)')), true);
    assert.strictEqual(isConnectionError(makeRateLimitError()), false);
    assert.strictEqual(isConnectionError(new Error('x')), false);
  });

  it('connectionSend retries any error when the connection turns out to be closed', async function () {
    const worker = new XRPWorker(constants);
    sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub();
    request.onCall(0).rejects(new Error('something unexpected'));
    request.onCall(1).resolves({ result: { ledger: {} } });
    let connected = false;
    const connect = sinon.stub().callsFake(async () => { connected = true; });
    const connection = makeConnection(request, { isConnected: () => connected, connect });

    const result = await worker.connectionSend(connection, { command: 'ledger', ledger_index: 1 });

    assert.deepStrictEqual(result, { result: { ledger: {} } });
    assert.strictEqual(request.callCount, 2);
    assert.strictEqual(connect.callCount, 1);
  });

  it('connectWithRetries retries handshake timeouts and gives up after the retry budget', async function () {
    const { NotConnectedError } = require('xrpl');
    const worker = new XRPWorker({ ...constants, XRP_ENDPOINT_RETRIES: 3 });
    const sleepStub = sinon.stub(worker, 'sleep').resolves();
    const connect = sinon.stub();
    connect.onCall(0).rejects(new NotConnectedError('Error: connect() timed out after 5000 ms.'));
    connect.onCall(1).resolves();
    await worker.connectWithRetries({ connect } as any, 0);
    assert.strictEqual(connect.callCount, 2);
    assert.strictEqual(sleepStub.callCount, 1);

    const alwaysFailing = sinon.stub().rejects(new NotConnectedError('Error: connect() timed out after 5000 ms.'));
    await assert.rejects(worker.connectWithRetries({ connect: alwaysFailing } as any, 0), NotConnectedError);
    assert.strictEqual(alwaysFailing.callCount, 3);

    const badUrl = sinon.stub().rejects(new Error('Cannot connect because no server was specified'));
    await assert.rejects(worker.connectWithRetries({ connect: badUrl } as any, 0), /no server/);
    assert.strictEqual(badUrl.callCount, 1);
  });

  it('failed automatic reconnects of the xrpl.js client are not fatal', async function () {
    const worker: any = new XRPWorker(constants);
    worker.recordConnectionError(0, ['reconnect', 'connect() timed out after 5000 ms', new Error('timeout')]);
    assert.strictEqual(worker.connectionError, null);
    worker.recordConnectionError(0, [new Error('ECONNRESET')]);
    assert.notStrictEqual(worker.connectionError, null);
  });

  it('connectionSend gives up after XRP_ENDPOINT_RETRIES attempts', async function () {
    const worker = new XRPWorker({ ...constants, XRP_ENDPOINT_RETRIES: 3 });
    const sleepStub = sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub().rejects(makeRateLimitError());

    await assert.rejects(
      worker.connectionSend(makeConnection(request), { command: 'ledger', ledger_index: 1 }),
      (err: any) => err instanceof RippledError && err.message === rateLimitMessage
    );
    assert.strictEqual(request.callCount, 3);
    assert.strictEqual(sleepStub.callCount, 2);
  });

  it('connectionSend rethrows other errors without retrying', async function () {
    const worker = new XRPWorker(constants);
    const sleepStub = sinon.stub(worker, 'sleep').resolves();
    const request = sinon.stub().rejects(new RippledError('ledgerNotFound', { error: 'lgrNotFound' }));

    await assert.rejects(
      worker.connectionSend(makeConnection(request), { command: 'ledger', ledger_index: 1 }),
      /ledgerNotFound/
    );
    assert.strictEqual(request.callCount, 1);
    assert.strictEqual(sleepStub.callCount, 0);
  });
});
