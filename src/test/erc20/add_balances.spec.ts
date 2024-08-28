const assert = require('assert');
const rewire = require('rewire');
const sinon = require('sinon');

import { MULTICALL_FAILURE } from '../../blockchains/erc20/lib/add_balances';

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
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer], 50);

    const transferExpected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
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
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const transfer2: ERC20Transfer = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449854,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer1, transfer2], 50);

    const transfer1Expected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
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
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
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
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    await extendBalances(null, [transfer], 50);

    const transferExpected = {
      'contract': '0xfd89ea92f6ec07d955e2adbba2400ca1a6369028',
      'blockNumber': 10449853,
      'timestamp': 0,
      'transactionHash': '0x246616c3cf211facc802a1f659f64cefe7b6f9be50da1908fcea23625e97d1cb',
      'logIndex': 158,
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
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
      'to': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
      'from': '0xea5f6f8167a60f671cc02b074b6ac581153472c9',
      'value': 1.81e+21,
      'valueExactBase36': 'alzj4rdbzkcq9s'
    };

    const extendBalances = add_balances_rewired.__get__('extendTransfersWithBalances')

    assert.rejects(async () => {
      await extendBalances(null, [transfer], 50);
    }, Error)
  });
});
