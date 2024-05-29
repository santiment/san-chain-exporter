import { ETHWorker } from '../../blockchains/eth/eth_worker';
import constants from '../../blockchains/eth/lib/constants';
import { MockWeb3Wrapper } from './mock_web3_wrapper';
import { WORK_NO_SLEEP, WORK_SLEEP, NO_WORK_SLEEP, nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime } from '../../blockchains/eth/lib/next_interval_calculator';

const sinon = require('sinon');
import assert from 'assert';


constants.CONFIRMATIONS = 3;
constants.BLOCK_INTERVAL = 100;


describe('analyzeWorkerContext', () => {
  it('returns "work no sleep" case', async () => {
    const worker = new ETHWorker(constants)
    worker.lastExportedBlock = 89;
    worker.lastConfirmedBlock = 90;

    const scenario = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(scenario, WORK_NO_SLEEP);
  });

  it('returns "work sleep" case', async () => {
    const worker = new ETHWorker(constants)
    worker.lastExportedBlock = 90;
    worker.lastConfirmedBlock = 90;
    worker.web3Wrapper = new MockWeb3Wrapper(100);

    const scenario = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(scenario, WORK_SLEEP);
  });

  it('returns "no work no sleep" case', async () => {
    const worker = new ETHWorker(constants)
    worker.lastExportedBlock = 100;
    worker.lastConfirmedBlock = 100;
    worker.web3Wrapper = new MockWeb3Wrapper(100);

    const scenario = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(scenario, NO_WORK_SLEEP);
  });
});

describe('setWorkerSleepTime', () => {
  it('sets sleep time accordingly when we are behind', () => {
    const worker = new ETHWorker(constants)
    setWorkerSleepTime(worker, WORK_NO_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, 0);
  });

  it('sets sleep time accordingly when we have caught up to lastConfirmedBlock, but not the blockchain node head', () => {
    const worker = new ETHWorker(constants)
    setWorkerSleepTime(worker, WORK_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });

  it('sets sleep time accordingly when we have caught up', () => {
    const worker = new ETHWorker(constants)
    setWorkerSleepTime(worker, NO_WORK_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });
});

describe('nextIntervalCalculator', () => {
  it('would not exceed BLOCK_INTERVAL', () => {
    const worker = new ETHWorker(constants)
    worker.lastExportedBlock = 0;
    worker.lastConfirmedBlock = 150;

    const { fromBlock, toBlock } = nextIntervalCalculator(worker);
    assert.deepStrictEqual(fromBlock, 1);
    assert.deepStrictEqual(toBlock, 100);
  });

  it('would not return full BLOCK_INTERVAL', () => {
    const worker = new ETHWorker(constants)
    worker.lastExportedBlock = 0;
    worker.lastConfirmedBlock = 37;

    const { fromBlock, toBlock } = nextIntervalCalculator(worker);
    assert.deepStrictEqual(fromBlock, 1);
    assert.deepStrictEqual(toBlock, 37);
  });
});

describe('various scenarios', () => {
  it('fetched interval should not go backwards even if the blockchain node reports old block numbers', async () => {
    const worker = new ETHWorker(constants)
    worker.web3Wrapper = new MockWeb3Wrapper(100);
    const context = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(context, WORK_SLEEP);
    const result = nextIntervalCalculator(worker);

    // Modify the last exported block as if we have consumed this interval
    worker.lastExportedBlock = result.toBlock;

    // Mock the Node to report an old number
    worker.web3Wrapper = new MockWeb3Wrapper(90);

    const contextSecond = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(contextSecond, NO_WORK_SLEEP);
  });

  it('fetched interval should not go backwards even if saved state is invalid', async () => {
    const worker = new ETHWorker(constants)
    worker.web3Wrapper = new MockWeb3Wrapper(4);

    // Setup a situation where the exported block has exceeded the Node block
    // Test is similar to the above but test that we already saved an old lastConfirmedBlock
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 5;

    const context = await analyzeWorkerContext(worker);
    assert.deepStrictEqual(context, NO_WORK_SLEEP);
  });

  it('blockchain node is not called when we are catching up', async () => {
    const worker = new ETHWorker(constants)
    worker.web3Wrapper = new MockWeb3Wrapper(999);
    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 2;

    const nodeCallSpy = sinon.spy(worker.web3Wrapper, 'getBlockNumber');

    await analyzeWorkerContext(worker);
    assert.ok(nodeCallSpy.notCalled);
  });

  it('blockchain node is called when exporter has caught up', async () => {
    const worker = new ETHWorker(constants)
    worker.web3Wrapper = new MockWeb3Wrapper(10);
    worker.lastExportedBlock = 2;
    worker.lastConfirmedBlock = 2;

    const nodeCallSpy = sinon.spy(worker.web3Wrapper, 'getBlockNumber');

    await analyzeWorkerContext(worker);
    assert.ok(nodeCallSpy.called);
  });
});
