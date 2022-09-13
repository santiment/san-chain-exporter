const assert = require('assert');

const util = require('../../blockchains/cardano/lib/util');

function getTransactionsPartialLastBlock() {
  return [
         {
      'includedAt': '2017-12-06T08:55:31Z',
      'blockIndex': 1,
      'fee': 194933,
      'hash': 'c56e8d96a91163bdb265191980dfe330a54777ba052222ce4aebd7483119ae6c',
      'block': {
        'number': 1,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': []
    },
    {
      'includedAt': '2017-12-06T08:55:31Z',
      'blockIndex': 0,
      'fee': 186803,
      'hash': '9403cb2fde3573dc4f72b5b2249fe74e28bcbb039e51689535834c73e6aa3b64',
      'block': {
        'number': 1,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': []
    },
    {
      'includedAt': '2017-12-06T08:58:11Z',
      'blockIndex': 1,
      'fee': 171070,
      'hash': '1413633eb460e7657ee606eeca43a7b37e7e97aeafc406056e8d226edfc299d4',
      'block': {
        'number': 2,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': []
    }
  ];
}

function getTransactionsOnePartialBlock() {
  return [{
      'includedAt': '2017-12-06T08:58:11Z',
      'blockIndex': 1,
      'fee': 171070,
      'hash': '1413633eb460e7657ee606eeca43a7b37e7e97aeafc406056e8d226edfc299d4',
      'block': {
        'number': 2,
        'epochNo': 14,
        'transactionsCount': 2
      },
      'inputs': [],
      'outputs': []
    }
  ];
}

function getTransactionsFullBlock() {
  return [{
      'includedAt': '2017-12-06T08:58:11Z',
      'blockIndex': 1,
      'fee': 171070,
      'hash': '1413633eb460e7657ee606eeca43a7b37e7e97aeafc406056e8d226edfc299d4',
      'block': {
        'number': 2,
        'epochNo': 14,
        'transactionsCount': 1
      },
      'inputs': [],
      'outputs': []
    }
  ];
}

describe('discardNotCompletedBlock Test', function() {
  it('test partial last block discarded', async function() {
    const transactions = getTransactionsPartialLastBlock();
    const result = util.discardNotCompletedBlock(transactions);
    assert.deepStrictEqual(result, transactions.slice(0, 2));
  });

  it('test one partial block exception', async function() {
    const transactions = getTransactionsOnePartialBlock();
    assert.throws(function() {util.discardNotCompletedBlock(transactions);}, Error);
  });

  it('test full block is not altered', async function() {
    const transactions = getTransactionsFullBlock();
    const result = util.discardNotCompletedBlock(transactions);
    assert.deepStrictEqual(result, transactions);
  });
});

describe('verifyAllBlocksComplete Test', function() {
  it('test throw on partial last block', async function() {
    const transactions = getTransactionsPartialLastBlock();
    assert.throws(function() {util.verifyAllBlocksComplete(transactions);}, Error);
  });

  it('test throw on partial single block', async function() {
    const transactions = getTransactionsOnePartialBlock();
    assert.throws(function() {util.verifyAllBlocksComplete(transactions);}, Error);
  });

  it('test verify passes on full block', async function() {
    const transactions = getTransactionsFullBlock();
    util.verifyAllBlocksComplete(transactions);
  });
});