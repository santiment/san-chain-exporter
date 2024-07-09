import assert from 'assert';

import { getCreationOutput } from '../../blockchains/eth_contracts/lib/transform_create_traces';


describe('Create only traces should be returned', function () {
  it('One of the traces should be filtered out', async function () {
    const createTrace1 = {
      'action': {
        'from': '0xd3cda913deb6f67967b99d67acdfa1712c293601',
        'gas': '0xe8084',
        'init': '0x0',
        'value': '0x0'
      },
      'blockHash': '0x3a8797cf80abc527d3e8369e6576de993a4c6689a2aad61d45d8ae64d6ce4394',
      'blockNumber': 86934,
      'result': {
        'address': '0xf95011f89fbc78988720a4f21b8c510600a9e996',
        'code': '0x0',
        'gasUsed': '0x19851'
      },
      'subtraces': 0,
      'traceAddress': [],
      'transactionHash': '0x3986a91455330981349789254aa8a512cf4a36a61b12ad335cd4478058569cd4',
      'transactionPosition': 0,
      'type': 'create'
    };

    const callTrace = {
      'action': {
        'callType': 'call',
        'from': '0xc47aaa860008be6f65b58c6c6e02a84e666efe31',
        'gas': '0x10d88',
        'input': '0x',
        'to': '0xa56697139eb8704667673af60c361af8c32694e3',
        'value': '0xafba03d15a15d5725'
      },
      'blockHash': '0x5599ccefb0bd3e3a59abf4feb5cdc4e9112e7c6654177e51bb36d5a6c8aa8700',
      'blockNumber': 86934,
      'result': {
        'gasUsed': '0x0',
        'output': '0x'
      },
      'subtraces': 0,
      'traceAddress': [],
      'transactionHash': '0x3986a91455330981349789254aa8a512cf4a36a61b12ad335cd4478058569cd4',
      'transactionPosition': 0,
      'type': 'call'
    }

    const result = getCreationOutput([createTrace1, callTrace], 1455404058);

    const expected = [
      {
        'address': '0xf95011f89fbc78988720a4f21b8c510600a9e996',
        'address_creator': '0xd3cda913deb6f67967b99d67acdfa1712c293601',
        'transaction_hash': '0x3986a91455330981349789254aa8a512cf4a36a61b12ad335cd4478058569cd4',
        'block_number': 86934,
        'block_created_at_timestamp': 1455404058
      }
    ]

    assert.deepStrictEqual(result, expected);
  })
})

it('Both of the traces should be returned', async function () {
  const createTrace2 = {
    'action': {
      'from': '0xd3cda913deb6f67967b99d67acdfa1712c293601',
      'gas': '0xe15cc',
      'init': '0x0',
      'value': '0x0'
    },
    'blockHash': '0xba541d8c6610749ce962bdf157152e5d2eb16465de3b8807ac375ce74e0c0d82',
    'blockNumber': 86833,
    'result': {
      'address': '0x61c5e2a298f40dbb2adee3b27c584adad6833bac',
      'code': '0x0',
      'gasUsed': '0x39486'
    },
    'subtraces': 1,
    'traceAddress': [],
    'transactionHash': '0xd3961e340049c8becf92e3b24372355bee334dd5d3ef5434e55791f560287828',
    'transactionPosition': 0,
    'type': 'create'
  }

  const createTrace3 = {
    'action': {
      'from': '0x61c5e2a298f40dbb2adee3b27c584adad6833bac',
      'gas': '0xd9842',
      'init': '0x0',
      'value': '0x0'
    },
    'blockHash': '0xba541d8c6610749ce962bdf157152e5d2eb16465de3b8807ac375ce74e0c0d82',
    'blockNumber': 86833,
    'result': {
      'address': '0x6386315cb57c9fd19d979f7a3537926a11fe1d9d',
      'code': '0x0',
      'gasUsed': '0x1009d'
    },
    'subtraces': 0,
    'traceAddress': [0],
    'transactionHash': '0xd3961e340049c8becf92e3b24372355bee334dd5d3ef5434e55791f560287828',
    'transactionPosition': 0,
    'type': 'create'
  }

  const result = getCreationOutput([createTrace2, createTrace3], 1455404053);

  const expected = [
    {
      "address": "0x61c5e2a298f40dbb2adee3b27c584adad6833bac",
      "address_creator": "0xd3cda913deb6f67967b99d67acdfa1712c293601",
      'transaction_hash': '0xd3961e340049c8becf92e3b24372355bee334dd5d3ef5434e55791f560287828',
      'block_number': 86833,
      'block_created_at_timestamp': 1455404053
    },
    {
      "address": "0x6386315cb57c9fd19d979f7a3537926a11fe1d9d",
      "address_fabric": "0x61c5e2a298f40dbb2adee3b27c584adad6833bac",
      "address_creator": "0xd3cda913deb6f67967b99d67acdfa1712c293601",
      'transaction_hash': '0xd3961e340049c8becf92e3b24372355bee334dd5d3ef5434e55791f560287828',
      'block_number': 86833,
      'block_created_at_timestamp': 1455404053
    }
  ]

  assert.deepStrictEqual(result, expected);
})

it('Two non-create traces are filtered out', async function () {

  const inputTraces = [{
    "action": {
      "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
      "callType": "call",
      "gas": "0xeee28",
      "input": "0x05215b2f0000000000000000000000000000000000000000000000000000000000002710",
      "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
      "value": "0x0"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": 81666,
    "result": {
      "gasUsed": "0xb6963",
      "output": "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    "subtraces": 2,
    "traceAddress": [],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "call"
  },
  {
    "action": {
      "from": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
      "gas": "0xe6e06",
      "value": "0x0"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": 81666,
    "result": {
      "address": "0xdc3153c4a6bd1f8dfb76ec59e8ae4e7b1ca8f965",
      "gasUsed": "0x9c7df"
    },
    "subtraces": 0,
    "traceAddress": [
      0
    ],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "create"
  },
  {
    "action": {
      "from": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
      "callType": "call",
      "gas": "0x443c2",
      "input": "0xc86a90fe000000000000000000000000000000000000000000000000000000000000271000000000000000000000000016893e10b99a59afd2c60331e0b49241d4d4d7cc",
      "to": "0xdc3153c4a6bd1f8dfb76ec59e8ae4e7b1ca8f965",
      "value": "0x0"
    },
    "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
    "blockNumber": 81666,
    "result": {
      "gasUsed": "0x6c4e",
      "output": "0x0000000000000000000000000000000000000000000000000000000000000001"
    },
    "subtraces": 0,
    "traceAddress": [
      1
    ],
    "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
    "transactionPosition": 0,
    "type": "call"
  }]

  const result = getCreationOutput(inputTraces, 1439505634);

  const expected = [
    {
      "address": "0xdc3153c4a6bd1f8dfb76ec59e8ae4e7b1ca8f965",
      "address_fabric": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
      "address_creator": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
      'transaction_hash': '0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb',
      'block_number': 81666,
      'block_created_at_timestamp': 1439505634
    }
  ]

  assert.deepStrictEqual(result, expected);
})
