const { assert, expect } = require('chai');
const TaskManager = require('../../lib/task_manager');
const { MAX_TASK_DATA_KEYS, START_BLOCK, START_PRIMARY_KEY } = require('../../lib/constants');

describe('TaskManager', () => {
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

    assert.deepStrictEqual(taskManager.taskData, {});

    assert.strictEqual(taskManager.lastExportedIndex, 0);
    assert.strictEqual(taskManager.lastTaskIndex, 0);

    expect(taskManager.queue).to.be.an.instanceof(PQueue);
    expect(taskManager.queue.concurrency).to.eq(CONCURRENCY);

    expect(taskManager).to.be.an.instanceof(TaskManager);
  });

  it('pushQueue handles the given task metadata', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);
    let isMetadataLambdaCalled = false;
    const exampleTaskMetadata = {
      interval: { fromBlock: 1, toBlock: 50 },
      lambda: () => { isMetadataLambdaCalled = true; }
    };

    taskManager.pushToQueue(exampleTaskMetadata);
    expect(taskManager.lastTaskIndex).to.eq(1);
    expect(taskManager.taskData).to.deep.eq({
      1: exampleTaskMetadata
    });
    expect(isMetadataLambdaCalled).to.eq(true);
  });

  it('queue handles tasks accordingly when they finish', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const interval = { fromBlock: 1, toBlock: 50 };
    taskManager.pushToQueue({
      interval: interval,
      lambda: () => {}
    });
    const taskIndex = 1;
    const taskData = [ 1, 2, 3, 4, 5 ];
    const exampleEventsData = [taskIndex, taskData];
    taskManager.queue.emit('completed', exampleEventsData);

    expect(taskManager.taskData).to.deep.eq({ 1: { data: taskData, interval: interval  } });
  });

  it('retrieveCompleted returns an array for the corresponding sequence in `taskData`', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const exampleEventsData = [ { prop: 1 }, { prop: 2 }, { prop: 3 } ];
    const exampleEventsData2 = [ { prop: 4 }, { prop: 5 }, { prop: 6 } ];
    const exampleEventsData3 = [ { prop: 7 }, { prop: 8 }, { prop: 9 } ];
    const interval1 = { fromBlock: 1, toBlock: 10 };
    const interval2 = { fromBlock: 11, toBlock: 20 };
    const interval3 = { fromBlock: 21, toBlock: 30 };
    const exampleTaskData = {
      1: { interval: interval1, data: exampleEventsData },
      2: { interval: interval2, data: exampleEventsData2 },
      3: { interval: interval3, data: exampleEventsData3 },
    };
    taskManager.taskData = exampleTaskData;

    const exampleResult = [
      { prop: 1 }, { prop: 2 }, { prop: 3 },
      { prop: 4 }, { prop: 5 }, { prop: 6 },
      { prop: 7 }, { prop: 8 }, { prop: 9 }
    ];

    const testResult = taskManager.retrieveCompleted();
    expect(testResult).to.deep.eq([30, exampleResult]);
  });

  it('retrieveCompleted returns only the first part of the keys data when holes are present in `taskData`', async () => {
    const CONCURRENCY = 1;
    const taskManager = await TaskManager.create(CONCURRENCY);

    const exampleEventsData = [ { prop: 1 }, { prop: 2 }, { prop: 3 } ];
    const exampleEventsData3 = [ { prop: 7 }, { prop: 8 }, { prop: 9 } ];
    const interval1 = { fromBlock: 1, toBlock: 10 };
    const interval2 = { fromBlock: 11, toBlock: 20 };
    const interval3 = { fromBlock: 21, toBlock: 30 };
    const exampleTaskData = {
      1: { interval: interval1, data: exampleEventsData },
      2: { interval: interval2, lambda: () => {} },
      3: { interval: interval3, data: exampleEventsData3 },
    };
    taskManager.taskData = exampleTaskData;

    const exampleResult = [
      { prop: 1 }, { prop: 2 }, { prop: 3 },
    ];

    const testResult = taskManager.retrieveCompleted();
    expect(testResult).to.deep.eq([10, exampleResult]);
  });
});
