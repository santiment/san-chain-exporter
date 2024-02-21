const { assert, expect } = require('chai');
const TaskManager = require('../../lib/task_manager');
const { MAX_TASK_DATA_KEYS, START_BLOCK, START_PRIMARY_KEY } = require('../../lib/constants');

describe('TaskManager', () => {
  it('constructor initializes corresponding variables', () => {
    const taskManager = new TaskManager();

    assert.deepStrictEqual(taskManager.taskData, {});
    assert.strictEqual(taskManager.consequentTaskIndex, 0);

    assert.strictEqual(taskManager.queue, undefined);
    assert.strictEqual(taskManager.lastPushedToBuffer, undefined);
    assert.strictEqual(taskManager.lastPrimaryKey, undefined);
    assert.strictEqual(taskManager.lastExportedBlock, undefined);
  });

  it('queue is initialized accordingly', async () => {
    const taskManager = new TaskManager();
    await taskManager.initQueue(5);

    assert.isDefined(taskManager.queue);
    assert.strictEqual(taskManager.queue.concurrency, 5);
  });

  it('create static method initializes the TaskManager with its queue', async () => {
    const CONCURRENCY = 2;
    const taskManager = await TaskManager.create(CONCURRENCY);
    const PQueue = (await import('p-queue')).default;

    expect(taskManager.queue).to.be.an.instanceof(PQueue);
    expect(taskManager.queue.concurrency).to.eq(CONCURRENCY);

    expect(taskManager).to.be.an.instanceof(TaskManager);
  });

  it('queue handles tasks accordingly when they finish', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const exampleEventsData = [ 1, 2, 3, 4, 5 ];
    const emmitedTaskData = [{ fromBlock: 1, toBlock: 10 }, exampleEventsData];
    taskManager.queue.emit('completed', emmitedTaskData);

    expect(taskManager.taskData).to.deep.eq({ 1: { toBlock: 10, data: exampleEventsData } });
    expect(taskManager.consequentTaskIndex).to.eq(1);
    expect(taskManager.queue.isPaused).to.eq(false);
  });

  it('queue is paused when `consequentTaskIndex` crosses the borderline', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.consequentTaskIndex = MAX_TASK_DATA_KEYS;

    const exampleEventsData = [ 1, 2, 3, 4, 5 ];
    const emmitedTaskData = [{ fromBlock: 1, toBlock: 10 }, exampleEventsData];
    taskManager.queue.emit('completed', emmitedTaskData);

    expect(taskManager.queue.isPaused).to.eq(true);
  });

  it('queue gets started if it\'s been paused', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.consequentTaskIndex = MAX_TASK_DATA_KEYS;
    taskManager.queue.pause();

    taskManager.restartQueueIfNeeded();

    expect(taskManager.queue.isPaused).to.eq(false);
    expect(taskManager.consequentTaskIndex).to.eq(0);
  });

  it('retrieveCompleted returns empty array if `taskData` is an empty object', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const testResult = taskManager.retrieveCompleted();
    expect(testResult).to.be.empty;
  });

  it('retrieveCompleted returns an array for the corresponding sequence in `taskData`', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.initPosition({ blockNumber: 0, primaryKey: 0 });

    const exampleEventsData = [ { prop: 1 }, { prop: 2 }, { prop: 3 } ];
    const exampleEventsData2 = [ { prop: 4 }, { prop: 5 }, { prop: 6 } ];
    const exampleEventsData3 = [ { prop: 7 }, { prop: 8 }, { prop: 9 } ];
    const exampleTaskData = {
      1: { toBlock: 10, data: exampleEventsData },
      11: { toBlock: 20, data: exampleEventsData2 },
      21: { toBlock: 30, data: exampleEventsData3 },
    };
    taskManager.taskData = exampleTaskData;

    const exampleResult = [
      { prop: 1, primaryKey: 1 }, { prop: 2, primaryKey: 2}, { prop: 3, primaryKey: 3 },
      { prop: 4, primaryKey: 4 }, { prop: 5, primaryKey: 5 }, { prop: 6, primaryKey: 6 },
      { prop: 7, primaryKey: 7 }, { prop: 8, primaryKey: 8 }, { prop: 9, primaryKey: 9 }
    ];

    const testResult = taskManager.retrieveCompleted();
    expect(testResult).to.deep.eq(exampleResult);
  });

  it('retrieveCompleted returns only the first part of the keys data when holes are present in `taskData`', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.initPosition({ blockNumber: 0, primaryKey: 0 });

    const exampleEventsData = [ { prop: 1 }, { prop: 2 }, { prop: 3 } ];
    const exampleEventsData3 = [ { prop: 7 }, { prop: 8 }, { prop: 9 } ];
    const exampleTaskData = {
      1: { toBlock: 10, data: exampleEventsData },
      21: { toBlock: 30, data: exampleEventsData3 },
    };
    taskManager.taskData = exampleTaskData;

    const exampleResult = [
      { prop: 1, primaryKey: 1 }, { prop: 2, primaryKey: 2}, { prop: 3, primaryKey: 3 },
    ];

    const testResult = taskManager.retrieveCompleted();
    expect(testResult).to.deep.eq(exampleResult);
  });

  it('initPosition sets the instance properties accordingly, returns corresponding object (no ZK value present)', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const testResult = taskManager.initPosition();
    expect(taskManager.lastExportedBlock).to.eq(START_BLOCK);
    expect(taskManager.lastPrimaryKey).to.eq(START_PRIMARY_KEY);
    expect(testResult).to.deep.eq({ blockNumber: START_BLOCK, primaryKey: START_PRIMARY_KEY });
  });

  it('initPosition sets the instance properties accordingly, returns corresponding object (ZK value present)', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const exampleZookeeperValue = { blockNumber: 10, primaryKey: 300 };
    const testResult = taskManager.initPosition(exampleZookeeperValue);
    expect(taskManager.lastExportedBlock).to.eq(exampleZookeeperValue.blockNumber);
    expect(taskManager.lastPrimaryKey).to.eq(exampleZookeeperValue.primaryKey);
    expect(testResult).to.deep.eq(exampleZookeeperValue);
  });

  it('getLastProcessedPosition returns correct object', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.lastExportedBlock = 10;
    taskManager.lastPrimaryKey = 300;

    const testResult = taskManager.getLastProcessedPosition();
    expect(testResult).to.deep.eq({
      blockNumber: taskManager.lastExportedBlock,
      primaryKey: taskManager.lastPrimaryKey
    });
  });

  it('isChangedLastExportedBlock returns false when lastProcessedPosition.blockNumber = lastExportedBlock', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.lastExportedBlock = 10;

    const testResult = taskManager.isChangedLastExportedBlock(10);
    expect(testResult).to.eq(false);
  });

  it('isChangedLastExportedBlock returns true when lastProcessedPosition.blockNumber != lastExportedBlock', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    taskManager.lastExportedBlock = 10;

    const testResult = taskManager.isChangedLastExportedBlock(9);
    expect(testResult).to.eq(true);
  });
});
