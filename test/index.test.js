process.env.BLOCKCHAIN = 'eth';

const sinon = require('sinon');
const assert = require('assert');
 
const { Main } = require('../index');
const { Exporter } = require('../lib/kafka_storage');
const BaseWorker = require('../lib/worker_base');
const zkClientAsync = require('../lib/zookeeper_client_async');

describe('Main', () => {
  it('_initExporter returns error when Exporter connect() fails', async () => {
    sinon
      .stub(zkClientAsync.prototype, 'connectAsync')
      .rejects(new Error('Exporter connection failed'));

    const MainInstance = new Main();
    try {
      await MainInstance.init();
    } catch (err) {
      assert.equal(err.message, 'Error when initializing exporter: Exporter connection failed');
    }
    sinon.restore();
  });

  it('_initExporter returns error when Exporter initTransactions() fails', async () => {
    sinon
      .stub(Exporter.prototype, 'connect')
      .resolves();

    sinon
      .stub(Exporter.prototype, 'initTransactions')
      .rejects(new Error('Exporter initTransactions failed'));

    const MainInstance = new Main();
    try {
      await MainInstance.init();
    } catch (err) {
      assert.equal(err.message, 'Error when initializing exporter: Exporter initTransactions failed');
    }
    sinon.restore();
  });

  it('_handleInitPosition changes the lastProcessedPosition accordingly 1', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(JSON.parse('{"blockNumber":123456,"primaryKey":0}'));

    const MainInstance = new Main();
    MainInstance.exporter = exporterStub;
    MainInstance.worker = new BaseWorker();

    sinon.spy(MainInstance, '_handleInitPosition');
    await MainInstance._handleInitPosition();

    assert(MainInstance._handleInitPosition.calledOnce);
    assert.equal(MainInstance.lastProcessedPosition.blockNumber, 123456);
    assert.equal(MainInstance.lastProcessedPosition.primaryKey, 0);
    sinon.restore();
  });

  it('_handleInitPosition changes the lastProcessedPosition accordingly 2', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);

    const MainInstance = new Main();
    MainInstance.exporter = exporterStub;
    MainInstance.worker = new BaseWorker();

    sinon.spy(MainInstance, '_handleInitPosition');
    await MainInstance._handleInitPosition();

    assert(MainInstance._handleInitPosition.calledOnce);
    assert.equal(MainInstance.lastProcessedPosition.blockNumber, -1);
    assert.equal(MainInstance.lastProcessedPosition.primaryKey, -1);
    sinon.restore();
  });

  it('_handleInitPosition throws error when exporter.getLastPosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.throws(new Error('Exporter getLastPosition failed'));

    const MainInstance = new Main();
    MainInstance.exporter = exporterStub;
    MainInstance.worker = new BaseWorker();

    try {
      await MainInstance._handleInitPosition();
    } catch (err) {
      assert.equal(err.message, 'Exporter getLastPosition failed');
    }
    sinon.restore();
  });

  it('_handleInitPosition throws error when exporter.savePosition() fails', async () => {
    const exporterStub = sinon.createStubInstance(Exporter);
    exporterStub.getLastPosition.returns(null);
    exporterStub.savePosition.throws(new Error('Exporter savePosition failed'));

    const MainInstance = new Main();
    MainInstance.exporter = exporterStub;
    MainInstance.worker = new BaseWorker();

    try {
      await MainInstance._handleInitPosition();
    } catch (err) {
      assert.equal(err.message, 'Exporter savePosition failed');
    }
    sinon.restore();
  });

  // it('updateMetrics work', () => {});
  // it('updateMetrics throws error when something\'s wrong', () => {});

  it('initWorker throws error when worker is already present', async () => {
    const MainInstance = new Main();
    MainInstance.worker = new BaseWorker();
    try {
      await MainInstance._initWorker();
    } catch (err) {
      assert.equal(err.message, 'Worker is already set');
    }
    sinon.restore();
  });

  it('initWorker throws an error when worker.init() fails', async () => {//TODO: Doesnt work
    const MainInstance = new Main();
    // MainInstance.exporter = new Exporter();

    sinon.stub(Main.worker, 'worker').returns(new BaseWorker());
    sinon.stub(MainInstance.worker, 'init').throws(new Error('Worker init failed'));

    try {
      await MainInstance._initWorker();
    } catch (err) {
      assert.equal(err.message, 'Error when initializing worker: Worker init failed');
    }
    sinon.restore();
  });

  // it('workLoop success', () => {});
  // it('workLoop throws error when worker can\'t be initialised', () => {});
  // it('workLoop throws error when storeEvents() fails', () => {});
  // it('workLoop throws error when savePosition() fails', () => {});

  // it('main function 1', () => {});
  // it('main function 2', () => {});
  // it('main function 3', () => {});
});
