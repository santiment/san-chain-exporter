const sinon = require('sinon');
const rewire = require('rewire');
const assert = require('assert');
const { expect } = require('chai');

const { main, Main } = rewire('../index');
const BaseWorker = require('../lib/worker_base');
const { Exporter } = require('../lib/kafka_storage');
const { worker } = require('../blockchains/eth/eth_worker');
const zkClientAsync = require('../lib/zookeeper_client_async');
const TaskManager = require('../lib/task_manager');

describe('Main', () => {
  const constants = {
    START_BLOCK: -1,
    START_PRIMARY_KEY: -1
  };

  afterEach(() => {
    sinon.restore();
  });

  it('initExporter returns error when Exporter connect() fails', async () => {
    sinon
      .stub(zkClientAsync.prototype, 'connectAsync')
      .rejects(new Error('Exporter connection failed'));

    const mainInstance = new Main();
    try {
      await mainInstance.init();
    } catch (err) {
      assert.strictEqual(err.message, 'Error when initializing exporter: Exporter connection failed');
    }
  });

  it('initExporter returns error when Exporter initTransactions() fails', async () => {
    sinon
      .stub(Exporter.prototype, 'connect')
      .resolves();

    sinon
      .stub(Exporter.prototype, 'initTransactions')
      .rejects(new Error('Exporter initTransactions failed'));

    const mainInstance = new Main();
    try {
      await mainInstance.init();
    } catch (err) {
      assert.strictEqual(err.message, 'Error when initializing exporter: Exporter initTransactions failed');
    }
  });

  it('handleInitPosition changes the lastProcessedPosition accordingly 1', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(JSON.parse('{"blockNumber":123456,"primaryKey":0}'));

    const mainInstance = new Main();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    sinon.spy(mainInstance, 'handleInitPosition');
    await mainInstance.handleInitPosition();

    assert(mainInstance.handleInitPosition.calledOnce);
    assert.strictEqual(mainInstance.lastProcessedPosition.blockNumber, 123456);
    assert.strictEqual(mainInstance.lastProcessedPosition.primaryKey, 0);
  });

  it('handleInitPosition changes the lastProcessedPosition accordingly 2', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);

    const mainInstance = new Main();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    sinon.spy(mainInstance, 'handleInitPosition');
    await mainInstance.handleInitPosition();

    assert(mainInstance.handleInitPosition.calledOnce);
    assert.strictEqual(mainInstance.lastProcessedPosition.blockNumber, -1);
    assert.strictEqual(mainInstance.lastProcessedPosition.primaryKey, -1);
  });

  it('handleInitPosition throws error when exporter.getLastPosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.throws(new Error('Exporter getLastPosition failed'));

    const mainInstance = new Main();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    try {
      await mainInstance.handleInitPosition();
      expect.fail('handleInitPosition should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Exporter getLastPosition failed');
    }
  });

  it('handleInitPosition throws error when exporter.savePosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);
    exporterStub.savePosition.throws(new Error('Exporter savePosition failed'));

    const mainInstance = new Main();
    mainInstance.exporter = exporterStub;
    mainInstance.worker = new BaseWorker(constants);

    try {
      await mainInstance.handleInitPosition();
      expect.fail('handleInitPosition should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Exporter savePosition failed');
    }
  });

  it('initWorker throws error when worker is already present', async () => {
    const mainInstance = new Main();
    mainInstance.worker = new BaseWorker(constants);
    try {
      await mainInstance.initWorker();
      expect.fail('initWorker should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Worker is already set');
    }
  });

  it('initWorker throws an error when worker.init() fails', async () => {
    const mainInstance = new Main();
    mainInstance.exporter = new Exporter('test-exporter');

    sinon.stub(worker.prototype, 'init').rejects(new Error('Worker init failed'));

    try {
      await mainInstance.initWorker();
      expect.fail('initWorker should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Worker init failed');
    }
  });

  it('initWorker throws an error when handleInitPosition() fails', async () => {
    const mainInstance = new Main();
    mainInstance.exporter = new Exporter('test-exporter');
    sinon.stub(worker.prototype, 'init').resolves();

    sinon.stub(mainInstance, 'handleInitPosition').throws(new Error('Error when initializing position'));

    try {
      await mainInstance.initWorker();
      expect.fail('initWorker should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Error when initializing position');
    }
  });

  it('initWorker success', async () => {
    const mainInstance = new Main();
    mainInstance.exporter = new Exporter('test-exporter');
    sinon.stub(worker.prototype, 'init').resolves();
    sinon.stub(mainInstance, 'handleInitPosition').resolves();
    sinon.stub(TaskManager.prototype, 'initQueue').resolves();
    mainInstance.lastProcessedPosition = { blockNumber: 10, primaryKey: 1 };

    await mainInstance.initWorker();
    assert(mainInstance.handleInitPosition.calledOnce);
    assert.strictEqual(mainInstance.taskManager.lastPushedToBuffer, 0);
  });

  it('workLoop throws error when worker can\'t be initialised', async () => {
    sinon.stub(BaseWorker.prototype, 'work').rejects(new Error('Error in worker "work" method'));
    const mainInstance = new Main();
    mainInstance.worker = new BaseWorker(constants);
    mainInstance.taskManager = new TaskManager(0, 50);
    await mainInstance.taskManager.initQueue(1);
    sinon.spy(mainInstance, 'workLoop');
    await mainInstance.workLoop();
    assert(mainInstance.workLoop.calledOnce);
    assert.strictEqual(mainInstance.shouldWork, false);
  });

  it('workLoop throws error when storeEvents() fails', async () => {
    sinon.stub(BaseWorker.prototype, 'work').resolves([1, 2, 3]);
    sinon.stub(Main.prototype, 'updateMetrics').returns(null);
    sinon.stub(Exporter.prototype, 'storeEvents').rejects(new Error('storeEvents failed'));

    const mainInstance = new Main();
    mainInstance.worker = new BaseWorker(constants);
    mainInstance.exporter = new Exporter('test-exporter');
    mainInstance.taskManager = new TaskManager();
    mainInstance.taskManager.buffer = [ 1 ]; // So that we get to see that storeEvents fails
    await mainInstance.taskManager.initQueue(1);
    try {
      await mainInstance.workLoop();
      expect.fail('workLoop should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'storeEvents failed');
    }
  });

  it('workLoop throws error when savePosition() fails', async () => {
    sinon.stub(BaseWorker.prototype, 'work').resolves([1, 2, 3]);
    sinon.stub(Main.prototype, 'updateMetrics').returns(null);
    sinon.stub(Exporter.prototype, 'storeEvents').resolves();
    sinon.stub(Exporter.prototype, 'savePosition').rejects(new Error('savePosition failed'));

    const mainInstance = new Main();
    mainInstance.worker = new BaseWorker(constants);
    mainInstance.exporter = new Exporter('test-exporter');
    mainInstance.taskManager = new TaskManager(0, 50);
    mainInstance.taskManager.buffer = [ 1 ]; // So that we get to see that savePosition fails
    await mainInstance.taskManager.initQueue(1);
    try {
      await mainInstance.workLoop();
      expect.fail('workLoop should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'savePosition failed');
    }
  });
});

describe('main function', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('main function throws error when initialization fails', async () => {
    sinon.stub(Main.prototype, 'init').rejects(new Error('Main init failed'));

    try {
      await main();
      expect.fail('main function should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Error initializing exporter: Main init failed');
    }
  });

  it('main function throws error when workLoop fails', async () => {
    sinon.stub(Main.prototype, 'init').resolves();
    sinon.stub(Main.prototype, 'workLoop').rejects(new Error('Main workLoop failed'));

    try {
      await main();
      expect.fail('main function should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Error in exporter work loop: Main workLoop failed');
    }
  });

  it('main function throws error when disconnecting fails', async () => {
    sinon.stub(Main.prototype, 'init').resolves();
    sinon.stub(Main.prototype, 'workLoop').resolves();
    sinon.stub(Main.prototype, 'disconnect').rejects(new Error('Main disconnect failed'));

    try {
      await main();
      expect.fail('main function should have thrown an error');
    } catch (err) {
      assert.strictEqual(err.message, 'Error in exporter work loop: Main disconnect failed');
    }
  });

  it('main function works', async () => {
    sinon.stub(Main.prototype, 'init').resolves();
    sinon.stub(Main.prototype, 'workLoop').resolves();
    sinon.stub(Main.prototype, 'disconnect').resolves();

    await main();
    assert(Main.prototype.init.calledOnce);
    assert(Main.prototype.workLoop.calledOnce);
  });
});
