const assert = require('assert');

const { filterErrors } = require('../../../blockchains/eth/lib/filter_errors');
const testErrTxs = require('./test_err_txs.json');
const testErrTxsNonAction = require('./test_err_txs_non_action.json');
const testParentErr = require('./test_parent_err.json');
const hugeTraces = require('./huge_traces.json');

describe('Find errors', function () {
  it('Find hashes of all txs with errors', function () {
    assert.strictEqual(
      filterErrors(testErrTxs).length,
      1
    );
  });
});

describe('Find errors non action', function () {
  it('Test that if a non-action is returned it would not break us', function () {
    assert.strictEqual(
      filterErrors(testErrTxsNonAction).length,
      0
    );
  });
});

describe('Find parent errors', function () {
  it('Find children of trace with error', function () {
    assert.strictEqual(
      filterErrors(testParentErr).length,
      8
    );
  });
});

describe('Trie performance for large trace', function () {
  it('Inspect the performance of the filtering using a Trie data structure on a large traces set', function () {
    const before = new Date();
    filterErrors(hugeTraces);
    const after = new Date();
    // Before using a custom Trie implementation filtering this huge data set would have taken around 20 seconds.
    assert.ok(after - before < 1000);
  });
});
