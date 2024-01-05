const { assert } = require('chai');
const TaskManager = require('../../lib/task_manager');

describe('TaskManager', () => {
  it('constructor initializes corresponding variables', () => {
    const taskManager = new TaskManager();

    assert.deepStrictEqual(taskManager.taskData, {});
    assert.deepStrictEqual(taskManager.buffer, []);
    assert.strictEqual(taskManager.lastPushedToBuffer, 0);
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

  it('handleNewData() produces a map key->data pair accordingly', () => {
    const taskManager = new TaskManager();
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10, data: [1, 2, 3] }];

    taskManager.handleNewData([1, exampleDataObject]); // This [key, data] pair comes from the worker's work method
    assert.deepStrictEqual(taskManager.taskData, {1: exampleDataObject});
  });

  it('handleNewData() fills the buffer accordingly', () => {
    const taskManager = new TaskManager();
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10, data: [1, 2, 3] }];
    const exampleDataObject2 = [{ fromBlock: 31, toBlock: 40, data: [4, 5, 6] }];

    taskManager.handleNewData([0, exampleDataObject]);
    taskManager.handleNewData([1, exampleDataObject2]);
    assert.deepStrictEqual(taskManager.buffer, [...exampleDataObject, ...exampleDataObject2]);
  });

  it('handleNewData() fills the buffer accordingly 2', () => {
    const taskManager = new TaskManager();
    const exampleDataObject = [{ fromBlock: 1, toBlock: 10, data: [1, 2, 3] }];
    const exampleDataObject2 = [{ fromBlock: 31, toBlock: 40, data: [4, 5, 6] }];

    taskManager.handleNewData([0, exampleDataObject]);
    taskManager.handleNewData([3, exampleDataObject2]);
    assert.deepStrictEqual(taskManager.buffer, [...exampleDataObject]);
  });
});
