const { assert } = require('chai');
const TaskManager = require('../../lib/task_manager');

describe('TaskManager', () => {
  it('constructor initializes corresponding variables', () => {
    const taskManager = new TaskManager();

    assert.deepStrictEqual(taskManager.taskData, {});
    assert.deepStrictEqual(taskManager.buffer, []);
    assert.strictEqual(taskManager.lastPushedToBuffer, undefined);
    assert.strictEqual(taskManager.queue, undefined);
  });

  it('queue is initialized accordingly', async () => {
    const taskManager = new TaskManager();
    await taskManager.initQueue(5);

    assert.isDefined(taskManager.queue);
    assert.strictEqual(taskManager.queue.concurrency, 5);
  });

  it('retrieveCompleted() makes a copy list of the buffer', () => {
    const taskManager = new TaskManager();
    taskManager.buffer = [1, 2, 3, 4, 5, 6, 7];

    const copy = taskManager.retrieveCompleted();
    assert.deepStrictEqual(copy, [1, 2, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(taskManager.buffer, []);
  });

  it('handleNewData() fills the taskData object in the correct format', () => {
    const taskManager = new TaskManager();
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10 }, [1, 2, 3]];

    taskManager.handleNewData(...exampleDataObject); // This [ interval, data ] pair comes from the worker's work method
    assert.deepStrictEqual(taskManager.taskData, { 1: { toBlock: 10, data: [1, 2, 3] } });
  });

  it('handleNewData() fills the buffer when sequential intervals present', () => {
    const taskManager = new TaskManager();
    taskManager.currentFromBlock = 1;
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10 }, [1, 2, 3]];
    const exampleDataObject2 = [{ fromBlock: 11, toBlock: 30 }, [4, 5, 6]];

    taskManager.handleNewData(...exampleDataObject);
    taskManager.handleNewData(...exampleDataObject2);
    assert.deepStrictEqual(taskManager.buffer, [...exampleDataObject[1], ...exampleDataObject2[1]]);
  });

  it('handleNewData() should not skip interval', () => {
    const taskManager = new TaskManager();
    taskManager.currentFromBlock = 1;
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10}, [1, 2, 3]];
    const exampleDataObject2 = [{ fromBlock: 31, toBlock: 40}, [4, 5, 6] ];

    taskManager.handleNewData(...exampleDataObject);
    taskManager.handleNewData(...exampleDataObject2);
    assert.deepStrictEqual(taskManager.buffer, [...exampleDataObject[1]]);
  });
});
