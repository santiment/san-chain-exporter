const assert = require('assert');
const rewire = require('rewire');
const sinon = require('sinon');

import { MULTICALL_FAILURE } from '../../blockchains/erc20/lib/add_balances';
import { MulticallBlacklist } from '../../blockchains/erc20/lib/multicall_blacklist';

const add_balances_rewired = rewire('../../blockchains/erc20/lib/add_balances.ts');
import * as Utils from '../../blockchains/erc20/lib/balance_utils';
import { ERC20Transfer } from '../../blockchains/erc20/erc20_types';


describe('test extendTransfersWithBalances', function () {
  let getBalancesPerBlockOriginal: any = null;

  beforeEach(function () {
    getBalancesPerBlockOriginal = add_balances_rewired.__get__('getBalancesPerBlock');
  })

  afterEach(function () {
    add_balances_rewired.__set__('getBalancesPerBlock', getBalancesPerBlockOriginal);
  })

  it('test single transfer', async function () {
    const mockedResult: Utils.BlockNumberAddressContractBalance[] = [
      [10449853, '0xea5f6f8167a60f671cc02b074b6ac581153472c9', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '123'],
      [10449853, '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '456']
    ];
    const getBalancesPerBlockMocked = sinon.stub().resolves(mockedResult);

    add_balances_rewired.__set__('getBalancesPerBlock', getBalancesPerBlockMocked);


    const transfer: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer], 50, 2);

    const transferExpected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s',
      'fromBalance': '123',
      'toBalance': '456'
    };

    assert.deepStrictEqual(transfer, transferExpected)
  });

  it('test two blocks', async function () {
    const mockedResult: Utils.BlockNumberAddressContractBalance[] = [
      [10449853, '0xea5f6f8167a60f671cc02b074b6ac581153472c9', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '123'],
      [10449853, '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '456'],
      [10449854, '0xea5f6f8167a60f671cc02b074b6ac581153472c9', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '789'],
      [10449854, '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '101']
    ];
    const getBalancesPerBlockMocked = sinon.stub().resolves(mockedResult);

    add_balances_rewired.__set__('getBalancesPerBlock', getBalancesPerBlockMocked);


    const transfer1: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const transfer2: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449854,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer1, transfer2], 50, 2);

    const transfer1Expected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s',
      'fromBalance': '123',
      'toBalance': '456'
    };

    const transfer2Expected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449854,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s',
      'fromBalance': '789',
      'toBalance': '101'
    };

    assert.deepStrictEqual(transfer1, transfer1Expected)
    assert.deepStrictEqual(transfer2, transfer2Expected)
  });

  it('test balance for one address is not returned', async function () {
    const mockedResult: Utils.BlockNumberAddressContractBalance[] = [
      [10449853, '0xea5f6f8167a60f671cc02b074b6ac581153472c9', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '123'],
      [10449853, '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', MULTICALL_FAILURE]
    ];
    const getBalancesPerBlockMocked = sinon.stub().resolves(mockedResult);

    add_balances_rewired.__set__('getBalancesPerBlock', getBalancesPerBlockMocked);


    const transfer: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer], 50, 2);

    const transferExpected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s',
      'fromBalance': '123',
      'toBalance': MULTICALL_FAILURE
    };

    assert.deepStrictEqual(transfer, transferExpected)
  });

  it('exception if address missing in response', async function () {
    // No mention of the 'to' address should throw exception
    const mockedResult: Utils.BlockNumberAddressContractBalance[] = [
      [10449853, '0xea5f6f8167a60f671cc02b074b6ac581153472c9', '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028', '123']
    ];
    const getBalancesPerBlockMocked = sinon.stub().resolves(mockedResult);

    add_balances_rewired.__set__('getBalancesPerBlock', getBalancesPerBlockMocked);

    const transfer: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'transactionIndex': 0,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1810000000000000000000n,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    assert.rejects(async () => {
      await extendBalances(null, [transfer], 50, 2);
    }, Error)
  });

});

describe('test execute Multicall', function () {
  let doMulticallOriginal: any = null;

  beforeEach(function () {
    doMulticallOriginal = add_balances_rewired.__get__('doMulticall');
  })

  afterEach(function () {
    add_balances_rewired.__set__('doMulticall', doMulticallOriginal);
  })

  it('test executeNonBatchMulticall', async function () {

    const mockedResult = { "0": true, "1": "0x000000000000000000000000000000000000000000000000000001f935735eb8", "__length__": 2, "success": true, "returnData": "0x000000000000000000000000000000000000000000000000000001f935735eb8" };

    // One address resolves the other fails
    const doMulticallMock = sinon.stub().callsFake((web3: any, blockNumber: number, addressContract: Utils.AddressContract[]) => {
      assert.equal(addressContract.length, 1)

      if (addressContract[0][0] === "address1") {
        return Promise.reject(new Error('Mocked rejection'));
      } else {
        return Promise.resolve([mockedResult]);
      }
    });


    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const executeNonBatchMulticall = add_balances_rewired.__get__('executeNonBatchMulticall');
    const addressContract1 = ["address1", "contract1"]
    const addressContract2 = ["address2", "contract2"]

    const addressContracts = [addressContract1, addressContract2]
    const result: Utils.AddressContractToMulticallResult[] = await executeNonBatchMulticall(null, addressContracts, 1);

    const expected = [[addressContract1, MULTICALL_FAILURE], [addressContract2, mockedResult]]

    assert.deepStrictEqual(result, expected)
  });

  it('test executeBatchMulticall', async function () {

    const multicallResultAddress1 = { "0": true, "1": "0x000000000000000000000000000000000000000000000000000001f935735eb8", "__length__": 2, "success": true, "returnData": "0x000000000000000000000000000000000000000000000000000001f935735eb8" };
    const multicallResultAddress2 = { "0": true, "1": "0x00000000000000000000000000000000000000000000000000000000008aff7a", "__length__": 2, "success": true, "returnData": "0x00000000000000000000000000000000000000000000000000000000008aff7a" };


    const doMulticallMock = sinon.stub().callsFake((web3: any, blockNumber: number, addressContract: Utils.AddressContract[]) => {
      assert.equal(addressContract.length, 2)

      return Promise.resolve([multicallResultAddress1, multicallResultAddress2]);
    });


    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const executeBatchMulticall = add_balances_rewired.__get__('executeBatchMulticall');
    const addressContract1 = ["address1", "contract1"]
    const addressContract2 = ["address2", "contract2"]

    const addressContracts = [addressContract1, addressContract2]
    const result: Utils.AddressContractToMulticallResult[] = await executeBatchMulticall(null, addressContracts, 1);

    const expected = [[addressContract1, multicallResultAddress1], [addressContract2, multicallResultAddress2]]

    assert.deepStrictEqual(result, expected)
  });
});

describe('test multicall blacklist integration', function () {
  let doMulticallOriginal: any = null;

  const failureResult = { "0": false, "1": "0x", "__length__": 2, "success": false, "returnData": "0x" };
  const successResult = { "0": true, "1": "0x00000000000000000000000000000000000000000000000000000000000000ff", "__length__": 2, "success": true, "returnData": "0x00000000000000000000000000000000000000000000000000000000000000ff" };
  const web3Mock = { eth: { abi: { decodeParameter: () => 255n } } };

  beforeEach(function () {
    doMulticallOriginal = add_balances_rewired.__get__('doMulticall');
  })

  afterEach(function () {
    add_balances_rewired.__set__('doMulticall', doMulticallOriginal);
  })

  it('blacklisted contract is not requested from the node', async function () {
    const blacklist = new MulticallBlacklist(1);
    blacklist.recordAllFailed('contract1', 1);
    assert.strictEqual(blacklist.isBlacklisted('contract1'), true);

    const doMulticallMock = sinon.stub().callsFake(
      (_web3: any, _blockNumber: number, addressContracts: Utils.AddressContract[]) => {
        assert.deepStrictEqual(addressContracts, [['address2', 'contract2']]);
        return Promise.resolve([successResult]);
      });
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    const result = await getBalancesPerBlock(web3Mock,
      [['address1', 'contract1'], ['address2', 'contract2']], 2, 'multicallAddress', blacklist);

    const expected = [
      [2, 'address1', 'contract1', MULTICALL_FAILURE],
      [2, 'address2', 'contract2', (255n).toString(36)]
    ];
    assert.deepStrictEqual(result, expected);
    assert.strictEqual(doMulticallMock.callCount, 1);
  });

  it('contract-wide failures in successful batches lead to blacklisting', async function () {
    const blacklist = new MulticallBlacklist(2);

    const doMulticallMock = sinon.stub().resolves([failureResult, failureResult]);
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    const addressContracts = [['address1', 'contract1'], ['address2', 'contract1']];

    await getBalancesPerBlock(web3Mock, addressContracts, 10, 'multicallAddress', blacklist);
    assert.strictEqual(blacklist.isBlacklisted('contract1'), false);

    await getBalancesPerBlock(web3Mock, addressContracts, 11, 'multicallAddress', blacklist);
    assert.strictEqual(blacklist.isBlacklisted('contract1'), true);
  });

  it('partial success within a contract is not counted towards blacklisting', async function () {
    const blacklist = new MulticallBlacklist(1);

    const doMulticallMock = sinon.stub().resolves([failureResult, successResult]);
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    await getBalancesPerBlock(web3Mock, [['address1', 'contract1'], ['address2', 'contract1']], 10,
      'multicallAddress', blacklist);

    assert.strictEqual(blacklist.isBlacklisted('contract1'), false);
  });

  it('all calls failing at the RPC level is a non recoverable error', async function () {
    const blacklist = new MulticallBlacklist(1);

    // Both the batch and the individual calls fail at the RPC level
    const doMulticallMock = sinon.stub().rejects(new Error('Mocked RPC error'));
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    await assert.rejects(
      () => getBalancesPerBlock(web3Mock, [['address1', 'contract1']], 10, 'multicallAddress', blacklist),
      /All 1 individual multicalls failed at block 10/
    );
    assert.strictEqual(blacklist.isBlacklisted('contract1'), false);
  });

  it('reverts inside fulfilled responses on the fallback path are recorded', async function () {
    const blacklist = new MulticallBlacklist(1);

    // The batch request is rejected at the RPC level, the individual call returns an on-chain revert
    const doMulticallMock = sinon.stub();
    doMulticallMock.onFirstCall().rejects(new Error('Mocked RPC error'));
    doMulticallMock.resolves([failureResult]);
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    const result = await getBalancesPerBlock(web3Mock, [['address1', 'contract1']], 10,
      'multicallAddress', blacklist);

    assert.deepStrictEqual(result, [[10, 'address1', 'contract1', MULTICALL_FAILURE]]);
    assert.strictEqual(blacklist.isBlacklisted('contract1'), true);
  });

  it('contract-wide failure mixing an RPC level rejection is recorded', async function () {
    const blacklist = new MulticallBlacklist(1);

    // The batch is rejected, then one individual call is rejected while the other returns a revert
    const doMulticallMock = sinon.stub().callsFake(
      (_web3: any, _blockNumber: number, addressContracts: Utils.AddressContract[]) => {
        if (addressContracts.length > 1) {
          return Promise.reject(new Error('Mocked batch RPC error'));
        }
        return addressContracts[0][0] === 'address1'
          ? Promise.reject(new Error('Mocked RPC error'))
          : Promise.resolve([failureResult]);
      });
    add_balances_rewired.__set__('doMulticall', doMulticallMock);

    const getBalancesPerBlock = add_balances_rewired.__get__('getBalancesPerBlock');
    const result = await getBalancesPerBlock(web3Mock,
      [['address1', 'contract1'], ['address2', 'contract1']], 10, 'multicallAddress', blacklist);

    assert.deepStrictEqual(result, [
      [10, 'address1', 'contract1', MULTICALL_FAILURE],
      [10, 'address2', 'contract1', MULTICALL_FAILURE]
    ]);
    assert.strictEqual(blacklist.isBlacklisted('contract1'), true);
  });
});
