import assert from 'assert';

import { CardanoWorker } from '../../blockchains/cardano/cardano_worker';
import * as constants from '../../blockchains/cardano/lib/constants';

function getTransactions() {
  return [
    {
      'includedAt': '2017-12-06T08:55:31Z',
      'blockIndex': 1,
      'fee': 194933,
      'hash': 'c56e8d96a91163bdb265191980dfe330a54777ba052222ce4aebd7483119ae6c',
      'block': {
        'number': 317330,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [
        {
          'address': 'DdzFFzCqrhsebLjvgRDoqDSzkLkre17U8uxPrg6Hmj5a7mA4x8XBdQg7z1Bp8VYuPZ1DgDggRxp2eUe2PHjpHuiPgpEpSqic5UNUFjak',
          'value': '9999800000'
        },
        {
          'address': 'DdzFFzCqrhsx7orxkN5gUffXxn326vuajy9S2nFzXbnGgTknbsaD2Uqhr78RUZFhCTVqJ4evRiiBZ3zfmW8PhycpTUZe5449RnZt7E3D',
          'value': '6119587793'
        },
        {
          'address': 'DdzFFzCqrhsxiHcTKJDquMEQFxxRjtroHtvRJhtrBgZQTidSYD1G3JnRtSTM4bfqsXv8VjtmkroyWAr6ekuG53yputH2Gp444iagj8yy',
          'value': '100000000'
        },
        {
          'address': 'DdzFFzCqrht3Ky22GWcdwxezR6T36EYzhbdyo4BwyyhMAtWmaSTG44BiE6C9P99ahtPgQHL6wcux1mBcNTe8r9N1AFCGhcuVevsnR59f',
          'value': '736894'
        }
      ],
      'outputs': [
        {
          'address': 'DdzFFzCqrht3pseTmXyqY7qkb2dY3VFrh6k3HR4WVyNQezKn5VVZX9hzJBBoohw7XaW6uxRYn9TtCbVaBLvrKVCcRYoLuuKmYSM8GKY9',
          'value': '712943'
        },
        {
          'address': 'DdzFFzCqrhsfkegDcdUJAGBRoUP2LVakkby6ntdckcURzBsKmNJ7HmQ6LBwLZxTRVBvhZzuFuX9KUpraDcqhJavm35yeXgS2keJPHfKB',
          'value': '16219216811'
        }
      ]
    },
    {
      'includedAt': '2017-12-06T08:55:31Z',
      'blockIndex': 0,
      'fee': 186803,
      'hash': '9403cb2fde3573dc4f72b5b2249fe74e28bcbb039e51689535834c73e6aa3b64',
      'block': {
        'number': 317330,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [
        {
          'address': 'DdzFFzCqrhsvRk2TnrBDxRmZB8w43auQfMW29ahqCiMKT9jkGACwiMXEZpJfBTtuL6ntHPHjKZH82gWmpnjstH6nowTPTwYw9o5BdMQR',
          'value': '1076222449'
        },
        {
          'address': 'DdzFFzCqrhsnpX1uWVbf5VM98C6rA1gf6LyWdKbbWS2mC2de1vTMLrKryxtfUbfxtuJVEZXAxVrnWHDUNiz1Afzf3VkdhXL1dVrzGJZY',
          'value': '899458212'
        },
        {
          'address': 'DdzFFzCqrhsskkhebMQgpJgmSJXNneqroi5sq5Easd36iPLFtev2RfWPSwPt1Lt6Ttpgj5v975ebXdtQ8mACn32p1m3cgLTuonpRvyQF',
          'value': '39800000'
        }
      ],
      'outputs': [
        {
          'address': 'DdzFFzCqrhsnNzBXY5uR41HPPc7GFua7bDQaf9cFukdZCzBrYYiGSh2f24c1AZpiRsvyMmwe8nFbEqEmhfwh3bG1h8Vxzpb6Ta62Lzyx',
          'value': '15293858'
        },
        {
          'address': 'DdzFFzCqrhsecWYnT9k5EAowtMJVMQ4cJZXdYrdN7MUZp4epboWgCQFkPc2eRHTXcNSa3GQMPKFoySuBLn79qW9w1Kh5EW2BmBc4k9Zd',
          'value': '2000000000'
        }
      ]
    },
    {
      'includedAt': '2017-12-06T08:58:11Z',
      'blockIndex': 1,
      'fee': 171070,
      'hash': '1413633eb460e7657ee606eeca43a7b37e7e97aeafc406056e8d226edfc299d4',
      'block': {
        'number': 317338,
        'epochNo': 14,
        'transactionsCount': 1
      },
      'inputs': [
        {
          'address': 'DdzFFzCqrht1yENnM3eM6XL6VQEppvRy6LrsBXK2BD21Td5oiCEFDh8YYYUi9q7ov9uwf8owKLtW5vpbJuMToLNaXAwpbbjGq5GMpQ25',
          'value': '3361777567226'
        }
      ],
      'outputs': [
        {
          'address': 'DdzFFzCqrht2T8iiupm8ATb52ZSRF3rhjfQXKnzuFw9XXTehpQEwMSwhAgQDeAn9biAqfbiGpQKEFzk3oWTcFp5ynqdUreg1gjuoh1BC',
          'value': '3361221167910'
        },
        {
          'address': 'DdzFFzCqrhsxG76ZQGGifqN19ARGFduzjSsJMfcwyqkxMyLutWVKFzEqpr2dEfG8DucfsKM29uPUr7o9pKmSQJGoB8ui27pwMZBajTG9',
          'value': '556228246'
        }
      ]
    }
  ];
}

function getGenesisTransactions() {
  return [
    {
      'includedAt': '2017-09-23T21:44:51Z',
      'blockIndex': 0,
      'fee': 0,
      'hash': '2d51b929d79a0ac8f360f38e8a38cdcb28ca84139aced314c5d7edc739aa4366',
      'block': {
        'number': null,
        'epochNo': null,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': [
        {
          'address': 'Ae2tdPwUPEZGvXJ3ebp4LDgBhbxekAH2oKZgfahKq896fehv8oCJxmGJgLt',
          'value': '1153846000000'
        }
      ]
    },
    {
      'includedAt': '2017-09-23T21:44:51Z',
      'blockIndex': 0,
      'fee': 0,
      'hash': '29c8a63ac4ff2bdb630656e9e568c3e526ef316b280b7123b9a9a9719f9ce8d7',
      'block': {
        'number': null,
        'epochNo': null,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': [
        {
          'address': 'Ae2tdPwUPEYyahAbgfTxhChyWV6xMWKCDQs35Cr9qUXgzVviBrvhJ6NyUzA',
          'value': '455585000000'
        }
      ]
    }
  ];
}

describe('workLoopTest', function () {
  let cardanoWorker: CardanoWorker;
  const BLOCKCHAIN_HEAD_BLOCK = 100;
  let transactions: any[];
  let genesisTransactions: any[];

  beforeEach(async function () {
    cardanoWorker = new CardanoWorker(constants);
    transactions = getTransactions();
    cardanoWorker.getTransactions = async function () {
      // Return a deep copy of the transactions so not to pollute the original object
      return JSON.parse(JSON.stringify(transactions));
    };
    genesisTransactions = getGenesisTransactions();
    cardanoWorker.getGenesisTransactions = async function () {
      // Return a deep copy of the transactions so not to pollute the original object
      return JSON.parse(JSON.stringify(genesisTransactions));
    };
    cardanoWorker.getCurrentBlock = async function () {
      return BLOCKCHAIN_HEAD_BLOCK;
    };
    await cardanoWorker.init();
  });

  it('test no sleep is set on catch-up', async function () {
    await cardanoWorker.work();
    assert.strictEqual(cardanoWorker.sleepTimeMsec, 0);
  });

  it('test sleep is set once we are caught up', async function () {
    cardanoWorker.lastExportedBlock = await cardanoWorker.getCurrentBlock() - constants.CONFIRMATIONS;
    await cardanoWorker.work();
    assert.strictEqual(cardanoWorker.sleepTimeMsec, constants.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000);
  });

  it('test genesis transfers are returned first', async function () {
    const result = await cardanoWorker.work();
    const expected = JSON.parse(JSON.stringify(genesisTransactions));
    expected[0].primaryKey = 1;
    expected[1].primaryKey = 2;
    // Test also that we have overwritten the block numbers
    expected[0].block.number = 0;
    expected[1].block.number = 0;

    assert.deepStrictEqual(result, expected);
  });

  it('test regular transfers are returned after genesis', async function () {
    // This should returned the genesis transfers
    await cardanoWorker.work();
    // This should return the first batch of regular transfers
    const result = await cardanoWorker.work();
    const expected = JSON.parse(JSON.stringify(transactions));
    expected[0].primaryKey = 3;
    expected[1].primaryKey = 4;
    expected[2].primaryKey = 5;

    assert.deepStrictEqual(result, expected);
  });

});

