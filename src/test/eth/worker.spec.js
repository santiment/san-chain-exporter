const assert = require('assert');
const v8 = require('v8');
const eth_worker = require('../../blockchains/eth/eth_worker');
const constants = require('../../blockchains/eth/lib/constants');

const testNullAction = require('./test_action_null.json');

describe('Test worker', function () {
  const worker = new eth_worker.worker(constants);
  let feeResult = null;
  let callResult = null;
  let feeResultWithPrimaryKey = null;
  let callResultWithPrimaryKey = null;

  beforeEach(function () {
    feeResult = {
      from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      to: '0x829bd824b016326a401d083b33d092293333a830',
      value: 14086000000000000,
      valueExactBase36: '3up2j2e99ts',
      blockNumber: 5711193,
      timestamp: 1527814787,
      transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      type: 'fee'
    };

    callResult = {
      from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      to: '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
      value: 320086793278069500,
      valueExactBase36: '2fjpaqu9o0tc',
      blockNumber: 5711193,
      timestamp: 1527814787,
      transactionHash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      transactionPosition: 0,
      type: 'call'
    };

    feeResultWithPrimaryKey = v8.deserialize(v8.serialize(feeResult));
    feeResultWithPrimaryKey.primaryKey = 1;

    callResultWithPrimaryKey = v8.deserialize(v8.serialize(callResult));
    callResultWithPrimaryKey.primaryKey = 2;
  });

  it('test primary key assignment', async function () {
    // Overwrite variables and methods that the 'work' method would use internally.
    worker.lastConfirmedBlock = 1;
    worker.lastQueuedBlock = 0;
    worker.fetchData = async function () {
      return [];
    };
    worker.transformPastEvents = function () {
      return [feeResult, callResult];
    };

    const result = await worker.work();

    assert.deepStrictEqual(result, [{fromBlock: 1, toBlock: 1}, [feeResultWithPrimaryKey, callResultWithPrimaryKey]]);
  });
});

describe('Test that when action is null parsing would not break', function () {
  it('Null action should not break parsing', function () {
    const worker = new eth_worker.worker(constants);
    const result = worker.parseEthInternalTrx(testNullAction);

    assert.deepStrictEqual(result, []);
  });
});
