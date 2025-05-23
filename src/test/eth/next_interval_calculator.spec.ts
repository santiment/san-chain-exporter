const sinon = require('sinon');
import { ETHWorker } from '../../blockchains/eth/eth_worker';
import * as constants from '../../blockchains/eth/lib/constants';
import { WORK_NO_SLEEP, WORK_SLEEP, NO_WORK_SLEEP, nextIntervalCalculator, analyzeWorkerContext, setWorkerSleepTime } from '../../blockchains/eth/lib/next_interval_calculator';

import assert from 'assert';

const constantsEdit = { ...constants }
constantsEdit.CONFIRMATIONS = 3;
constantsEdit.BLOCK_INTERVAL = 100;


describe('analyzeWorkerContext', () => {
  it('returns "work no sleep" case', async () => {
    const worker: any = new ETHWorker(constantsEdit)
    worker.lastExportedBlock = 89;
    worker.lastConfirmedBlock = 90;

    const unusedFun: () => Promise<number> = async () => {
      return 0;
    }
    const scenario = await analyzeWorkerContext(worker, unusedFun);
    assert.deepStrictEqual(scenario, WORK_NO_SLEEP);
  });

  it('returns "work sleep" case', async () => {
    const worker: any = new ETHWorker(constantsEdit)
    worker.lastExportedBlock = 90;
    worker.lastConfirmedBlock = 90;

    const lastBlockFun = async () => 100;

    const scenario = await analyzeWorkerContext(worker, lastBlockFun);
    assert.deepStrictEqual(scenario, WORK_SLEEP);
  });

  it('returns "no work no sleep" case', async () => {
    const worker: any = new ETHWorker(constantsEdit)
    worker.lastExportedBlock = 100;
    worker.lastConfirmedBlock = 100;
    const lastBlockFun = async () => 100;

    const scenario = await analyzeWorkerContext(worker, lastBlockFun);
    assert.deepStrictEqual(scenario, NO_WORK_SLEEP);
  });
});

describe('setWorkerSleepTime', () => {
  it('sets sleep time accordingly when we are behind', () => {
    const worker = new ETHWorker(constantsEdit)
    setWorkerSleepTime(worker, WORK_NO_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, 0);
  });

  it('sets sleep time accordingly when we have caught up to lastConfirmedBlock, but not the blockchain node head', () => {
    const worker = new ETHWorker(constantsEdit)
    setWorkerSleepTime(worker, WORK_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });

  it('sets sleep time accordingly when we have caught up', () => {
    const worker = new ETHWorker(constantsEdit)
    setWorkerSleepTime(worker, NO_WORK_SLEEP);

    assert.deepStrictEqual(worker.sleepTimeMsec, worker.settings.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });
});

describe('nextIntervalCalculator', () => {
  it('would not exceed BLOCK_INTERVAL', () => {
    const worker = new ETHWorker(constantsEdit)
    worker.lastExportedBlock = 0;
    worker.lastConfirmedBlock = 150;

    const { fromBlock, toBlock } = nextIntervalCalculator(worker);
    assert.deepStrictEqual(fromBlock, 1);
    assert.deepStrictEqual(toBlock, 100);
  });

  it('would not return full BLOCK_INTERVAL', () => {
    const worker = new ETHWorker(constantsEdit)
    worker.lastExportedBlock = 0;
    worker.lastConfirmedBlock = 37;

    const { fromBlock, toBlock } = nextIntervalCalculator(worker);
    assert.deepStrictEqual(fromBlock, 1);
    assert.deepStrictEqual(toBlock, 37);
  });
});

describe('various scenarios', () => {
  it('fetched interval should not go backwards even if the blockchain node reports old block numbers', async () => {
    const worker: any = new ETHWorker(constantsEdit)

    const lastBlockFun1 = async () => 100;

    const context = await analyzeWorkerContext(worker, lastBlockFun1);
    assert.deepStrictEqual(context, WORK_SLEEP);
    const result = nextIntervalCalculator(worker);

    // Modify the last exported block as if we have consumed this interval
    worker.lastExportedBlock = result.toBlock;

    // Mock the Node to report an old number
    const lastBlockFun2 = async () => 90;

    const contextSecond = await analyzeWorkerContext(worker, lastBlockFun2);
    assert.deepStrictEqual(contextSecond, NO_WORK_SLEEP);
  });

  it('fetched interval should not go backwards even if saved state is invalid', async () => {
    const worker: any = new ETHWorker(constantsEdit)

    const lastBlockFun = async () => 4;

    // Setup a situation where the exported block has exceeded the Node block
    // Test is similar to the above but test that we already saved an old lastConfirmedBlock
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 5;

    const context = await analyzeWorkerContext(worker, lastBlockFun);
    assert.deepStrictEqual(context, NO_WORK_SLEEP);
  });

  it('blockchain node is not called when we are catching up', async () => {
    const worker: any = new ETHWorker(constantsEdit)

    const nodeCallSpy = sinon.spy(async () => 999)

    worker.lastExportedBlock = 1;
    worker.lastConfirmedBlock = 2;

    await analyzeWorkerContext(worker, nodeCallSpy);
    assert.ok(nodeCallSpy.notCalled);
  });

  it('blockchain node is called when exporter has caught up', async () => {
    const worker: any = new ETHWorker(constantsEdit)

    const nodeCallSpy = sinon.spy(async () => 10);

    worker.lastExportedBlock = 2;
    worker.lastConfirmedBlock = 2;

    await analyzeWorkerContext(worker, nodeCallSpy);
    assert.ok(nodeCallSpy.called);
  });
});
