const { Web3 } = require('web3');
const assert = require('assert');
const eth_worker = require('../../blockchains/eth/eth_worker');
const constants = require('../../blockchains/eth/lib/constants');
const {
  injectDAOHackTransfers,
  DAO_HACK_ADDRESSES,
  DAO_HACK_FORK_BLOCK
} = require('../../blockchains/eth/lib/dao_hack');
const Web3Wrapper = require('../../blockchains/eth/lib/web3_wrapper');
const web3Wrapper = new Web3Wrapper(new Web3());

describe('fetch past events', function () {
  const transaction = {
    blockHash: '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
    blockNumber: '0x572559',
    chainId: null,
    condition: null,
    creates: null,
    from: '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
    gas: '0x18be0',
    gasPrice: '0x3a35294400',
    hash: '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
    input: '0x454a2ab300000000000000000000000000000000000000000000000000000000000bf518',
    nonce: '0x9a9',
    publicKey: '0x077f2583a73ed1db394591aa209713b0d66c305a403bbf0c37ebe329eb517877f0654196a1a47817fdf5732e27430a7cc9ef304741f34e50e0690931823ef020',
    r: '0x2fb44a3c0826e6d874ec664b60577b5b1baa7b03a21f95c8508653593b0bcd27',
    raw: '0xf8938209a9853a3529440083018be094b1690c08e213a35ed9bab7b318de14420fb57d8c8804712d3e1aa21b20a4454a2ab300000000000000000000000000000000000000000000000000000000000bf5181ca02fb44a3c0826e6d874ec664b60577b5b1baa7b03a21f95c8508653593b0bcd27a07d798edb0c7ddc16868d433728b533047379eb0afd8c0f461215ffe16674fd52',
    s: '0x7d798edb0c7ddc16868d433728b533047379eb0afd8c0f461215ffe16674fd52',
    standardV: '0x1',
    to: '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
    transactionIndex: '0x0',
    v: '0x1c',
    value: '0x4712d3e1aa21b20'
  };
  const blocks = new Map();
  blocks.set(5711193,
    {
      author: '0x829bd824b016326a401d083b33d092293333a830',
      difficulty: '0xb8d1a2118a1d5',
      extraData: '0xe4b883e5bda9e7a59ee4bb99e9b1bc',
      gasLimit: '0x7a2047',
      gasUsed: '0x7a0166',
      hash: '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
      logsBloom: '0x0213080000401000000004018202222a412040800800000402100908800801ac0000e02a00000100029041423048040120002080012101800040121200e1092001000169200804118014408c000140081100014006b000000103910090085005002040022010840005c0004008010009004c022408056000443001150000045020808711446114600422001590c800000c04c1010000205400000002440269988200000440c810000400182494008122190004210001902200008040809000010440080200040a00100080004841000001032025000a4401209200440c0600000410202401200000004400c00840825400008113189100420018008201000094',
      miner: '0x829bd824b016326a401d083b33d092293333a830',
      mixHash: '0x9c40fd29ce55422fdfdd7cfcc34379f2ba8b20e565dda7280923354164ea6e2e',
      nonce: '0xca3f1c80070df1b6',
      number: '0x572559',
      parentHash: '0xcab11d33dee569682f70c021e9032c37aaa41932af1604f4f240e29f5aecbf37',
      receiptsRoot: '0xf1404089b2f6b6af7773bac2c58433f582687bd2758b3329a28c230d8f5f5113',
      sealFields: [
        '0xa09c40fd29ce55422fdfdd7cfcc34379f2ba8b20e565dda7280923354164ea6e2e',
        '0x88ca3f1c80070df1b6'
      ],
      sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
      size: '0x915a',
      stateRoot: '0x76644d69cbc1f9246d4fe45c4373c509e0d9fe8ddbdd5fd97f5cc09e62861cef',
      timestamp: '0x5b109a83',
      totalDifficulty: '0xf4890fc4320c56c9a4',
      transactions: [transaction],
      transactionsRoot: '0xa7df4bb8858bfc779dae9b59201561394b686cdc942a7b0728aa396f7e35f40f',
      uncles: []
    });

  const receipts = {
    '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d':
    {
      'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
      'blockNumber': '0x572559',
      'contractAddress': null,
      'cumulativeGasUsed': '0xdc18',
      'from': '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      'gasUsed': '0xdc18',
      'logs': [{
        'address': '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
        'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
        'blockNumber': '0x572559',
        'data': '0x00000000000000000000000000000000000000000000000000000000000bf51800000000000000000000000000000000000000000000000004704ed9dfca173400000000000000000000000003b16ab6e23bdbeeab719d8e4c49d63674876253',
        'logIndex': '0x0',
        'removed': false,
        'topics': ['0x4fcc30d90a842164dd58501ab874a101a3749c3d4747139cefe7c876f4ccebd2'],
        'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
        'transactionIndex': '0x0',
        'transactionLogIndex': '0x0',
        'type': 'mined'
      }, {
        'address': '0x06012c8cf97bead5deae237070f9587f8e7a266d',
        'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
        'blockNumber': '0x572559',
        'data': '0x000000000000000000000000b1690c08e213a35ed9bab7b318de14420fb57d8c00000000000000000000000003b16ab6e23bdbeeab719d8e4c49d6367487625300000000000000000000000000000000000000000000000000000000000bf518',
        'logIndex': '0x1',
        'removed': false,
        'topics': ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
        'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
        'transactionIndex': '0x0',
        'transactionLogIndex': '0x1',
        'type': 'mined'
      }],
      'logsBloom': '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000001000000000000000000000000000000000000000000000000000000000000100000008000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000011000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000100080000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000',
      'status': '0x1',
      'to': '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
      'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
      'transactionIndex': '0x0'
    }
  };
  const trace = {
    'action': {
      'callType': 'call',
      'from': '0x03b16ab6e23bdbeeab719d8e4c49d63674876253',
      'gas': '0x13788',
      'input': '0x454a2ab300000000000000000000000000000000000000000000000000000000000bf518',
      'to': '0xb1690c08e213a35ed9bab7b318de14420fb57d8c',
      'value': '0x4712d3e1aa21b20'
    },
    'blockHash': '0x22854625d4c18b3034461851a6fb181209e77a242adbd923989e7113a60fec56',
    'blockNumber': 5711193,
    'result': { 'gasUsed': '0x13788', 'output': '0x' },
    'subtraces': 3,
    'traceAddress': [],
    'transactionHash': '0x1a06a3a86d2897741f3ddd774df060a63d626b01197c62015f404e1f007fa04d',
    'transactionPosition': 0,
    'type': 'call'
  };

  const worker = new eth_worker.worker(constants);
  let feeResult = null;
  let callResult = null;

  beforeEach(async function () {
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
  });


  it('parse transaction events', async function () {
    const result = await worker.getPastTransactionEvents(blocks.values(), receipts);
    const expectedResult = [feeResult];

    assert.deepStrictEqual(result, expectedResult);
  });

  it('parse transfer events', async function () {
    const result = await worker.getPastTransferEvents([trace], blocks);
    const expectedResult = [callResult];

    assert.deepStrictEqual(result, expectedResult);
  });

  it('add genesis events', async function () {
    const result = await worker.getPastEvents(0, 1, [trace], blocks, receipts);

    const firstGenesisEvent = {
      from: 'GENESIS',
      to: '0x000d836201318ec6899a67540690382780743280',
      value: '200000000000000000000',
      valueExactBase36: '167i830vk1gbnk',
      blockNumber: 0,
      timestamp: 1438269973,
      transactionHash: 'GENESIS_000d836201318ec6899a67540690382780743280',
      type: 'genesis'
    };


    assert.deepStrictEqual(firstGenesisEvent, result[0]);
  });

  it('genesis events ordering', async function () {
    const result = await worker.getPastEvents(0, 1, [trace], blocks, receipts);

    const genesisEventsInserted = 8894;
    assert.strictEqual(result.length, genesisEventsInserted + 2);
    assert.deepStrictEqual(callResult, result[genesisEventsInserted]);
    assert.deepStrictEqual(feeResult, result[genesisEventsInserted + 1]);
  });

  it('DAO hack events', async function () {
    const result = await worker.getPastEvents(DAO_HACK_FORK_BLOCK - 1, DAO_HACK_FORK_BLOCK + 1, [trace], blocks, receipts);
    const expectedEvents = DAO_HACK_ADDRESSES.length + 2;

    assert.deepStrictEqual(expectedEvents, result.length);
  });

  it('DAO hack events ordering', async function () {
    // Test that DAO hack events are inserted in between the others
    feeResult.blockNumber = DAO_HACK_FORK_BLOCK - 1;
    callResult.blockNumber = DAO_HACK_FORK_BLOCK - 1;

    const eventsResult = [feeResult, callResult];
    injectDAOHackTransfers(eventsResult, web3Wrapper);

    assert.deepStrictEqual(feeResult, eventsResult[0]);
    assert.deepStrictEqual(callResult, eventsResult[1]);
  });
});
