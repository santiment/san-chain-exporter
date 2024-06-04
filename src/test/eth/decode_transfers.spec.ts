import assert from 'assert';
process.env.IS_ETH = 'true';
import { decodeTransferTrace } from '../../blockchains/eth/lib/decode_transfers';
import { NODE_URL } from '../../blockchains/eth/lib/constants';
import { Web3Interface, constructWeb3WrapperNoCredentials } from '../../blockchains/eth/lib/web3_wrapper';


describe('genesis transfers', function () {
  const web3Wrapper: Web3Interface = constructWeb3WrapperNoCredentials(NODE_URL);

  it('parses trace of type suicide', function () {
    const suicide_trace = {
      'action': {
        'address': '0xa6c3b7f6520a0ef594fc666d3874ec78c561cdbb',
        'balance': '0x2386f26fc100000',
        'refundAddress': '0x245133ea0fb1b77fab5886d7ffb8046dfeff3858'
      },
      'blockHash': '0x9aaaed9f94c47b3d7dba12743b50f6de750edd18d4019b4f66e308b2aae9fa70',
      'blockNumber': 711983,
      'result': {
        'gasUsed': '0x250b6',
        'output': '0x0000000000000000000000000000000000000000000000000000000000000001'
      },
      'subtraces': 0,
      'traceAddress': [0],
      'transactionHash': '0xd715da4f846e41be86ea87dc97b186cafea3b50c95d5d9d889ec522b248b207f',
      'transactionPosition': 10,
      'type': 'suicide'
    };

    const timestamp = 1000000;
    const result = decodeTransferTrace(suicide_trace, timestamp, web3Wrapper);

    const result_expected = {
      'from': '0xa6c3b7f6520a0ef594fc666d3874ec78c561cdbb',
      'to': '0x245133ea0fb1b77fab5886d7ffb8046dfeff3858',
      'value': 160000000000000000,
      'valueExactBase36': '17rf9la2f4sg',
      'blockNumber': 711983,
      'timestamp': 1000000,
      'transactionHash': '0xd715da4f846e41be86ea87dc97b186cafea3b50c95d5d9d889ec522b248b207f',
      'transactionPosition': 10,
      'type': 'suicide'
    };

    assert.deepStrictEqual(result, result_expected);

  });

  it('parses trace of type call', function () {
    const call_trace = {
      'action': {
        'callType': 'call',
        'from': '0x48f2e6e5d0872da169c7f5823d5a2d5ea5f2b5e7',
        'gas': '0x34938',
        'input': '0x651e723c000000000000000000000000a9964c3a565810d09635fbc0468ec72b264cacdd000000000000000000000000000000000000000000000000000000005673dbe700000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000021bdba288b92ec8ade6739e4f75cfdc097fc8b9728bc3161e10adec84cd1cc4a160fb5c4b543de24a927ae77e9a565dfb370d8d5059e05490425efd9760351b9a0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000001b0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000a9964c3a565810d09635fbc0468ec72b264cacdd0000000000000000000000009abf4d7fa720ac6a3bf2b37ea746b4507b379e000000000000000000000000001d109aa4d3b7133f2b0a69c9d2848653e8649b6c000000000000000000000000491930382ca7ce1acc5a2526c08bac2709e147f6',
        'to': '0x7de5aba7de728950c92c57d08e20d4077161f12f',
        'value': '0x1'
      },
      'blockHash': '0x5e42fc42cd9f04a48713f33a9d2440079c58875f1726eab87c4ad1c55f1fc332',
      'blockNumber': 710093,
      'result': {
        'gasUsed': '0x250b6',
        'output': '0x0000000000000000000000000000000000000000000000000000000000000001'
      },
      'subtraces': 0,
      'traceAddress': [],
      'transactionHash': '0x22f839c82ff455554ec8aa98ee2b9a03d0d5ed4707b46d4a0a217df7d58bda2c',
      'transactionPosition': 10,
      'type': 'call'
    };

    const timestamp = 1450433505;

    const result = decodeTransferTrace(call_trace, timestamp, web3Wrapper);

    const result_expected = {
      'from': '0x48f2e6e5d0872da169c7f5823d5a2d5ea5f2b5e7',
      'to': '0x7de5aba7de728950c92c57d08e20d4077161f12f',
      'value': 1,
      'valueExactBase36': '1',
      'blockNumber': 710093,
      'timestamp': 1450433505,
      'transactionHash': '0x22f839c82ff455554ec8aa98ee2b9a03d0d5ed4707b46d4a0a217df7d58bda2c',
      'transactionPosition': 10,
      'type': 'call'
    };

    assert.deepStrictEqual(result, result_expected);
  });

  it('parses trace of type reward', function () {
    const reward_trace = {
      'action': {
        'author': '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
        'rewardType': 'block',
        'value': '0x4563918244f40000'
      },
      'blockHash': '0x5e42fc42cd9f04a48713f33a9d2440079c58875f1726eab87c4ad1c55f1fc332',
      'blockNumber': 710093,
      'result': {
        'gasUsed': '0x250b6',
        'output': '0x0000000000000000000000000000000000000000000000000000000000000001'
      },
      'subtraces': 0,
      'traceAddress': [],
      'transactionHash': '0x22f839c82ff455554ec8aa98ee2b9a03d0d5ed4707b46d4a0a217df7d58bda2c',
      'transactionPosition': 10,
      'type': 'reward'
    };

    const timestamp = 1450433505;

    const result = decodeTransferTrace(reward_trace, timestamp, web3Wrapper);
    const result_expected = {
      'from': 'mining_block',
      'to': '0x2a65aca4d5fc5b5c859090a6c34d164135398226',
      'value': 5000000000000000000,
      'valueExactBase36': '11zk02pzlmwow',
      'blockNumber': 710093,
      'timestamp': 1450433505,
      'type': 'reward'
    };

    assert.deepStrictEqual(result, result_expected);
  });

  it('parses trace of type create', function () {
    const create_trace = {
      'action': {
        'from': '0x245133ea0fb1b77fab5886d7ffb8046dfeff3858',
        'gas': '0x5355d',
        'value': '0x14d1120d7b160000'
      },
      'blockHash': '0xdae9dcbc48275d633e2f3bb54d287c50976820e25f9e2bfba00c81047659ff4a',
      'blockNumber': 710221,
      'result': {
        'gasUsed': '0x250b6',
        'address': '0xa6c3b7f6520a0ef594fc666d3874ec78c561cdbb'
      },
      'subtraces': 0,
      'traceAddress': [],
      'transactionHash': '0x6d39df3c46f19e8ef5e8bb3b81a063a29cb352675a00d66f0dc2117a1799add1',
      'transactionPosition': 11,
      'type': 'create'
    };

    const timestamp = 1450435908;
    const result = decodeTransferTrace(create_trace, timestamp, web3Wrapper);

    const result_expected = {
      'from': '0x245133ea0fb1b77fab5886d7ffb8046dfeff3858',
      'to': '0xa6c3b7f6520a0ef594fc666d3874ec78c561cdbb',
      'value': 1500000000000000000,
      'valueExactBase36': 'be9lmezvoveo',
      'blockNumber': 710221,
      'timestamp': 1450435908,
      'transactionHash': '0x6d39df3c46f19e8ef5e8bb3b81a063a29cb352675a00d66f0dc2117a1799add1',
      'transactionPosition': 11,
      'type': 'create'
    };

    assert.deepStrictEqual(result, result_expected);
  });
});
