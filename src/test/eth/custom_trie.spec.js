const assert = require('assert');
const custom_trie = require('../../blockchains/eth/lib/custom_trie');


describe('custom trie test', function () {

  it('Test single node construction dummy root', async function () {
    const trace1 = {
      traceAddress: []
    };

    const trie = new custom_trie.CustomTrie([trace1]);
    assert.strictEqual(trie.trieRoot.traceObject, null);
  });

  it('Test single node construction', async function () {
    const trace1 = {
      traceAddress: [],
      error: 'Out of gas'
    };

    const trie = new custom_trie.CustomTrie([trace1]);

    const rootChildrenExpected = {
      [custom_trie.DUMMY_FIRST_NODE]: {
        children: {},
        traceObject: trace1
      }
    };

    assert.deepStrictEqual(trie.trieRoot.children, rootChildrenExpected);
  });

  it('Test two nodes construction, parent failed', async function () {
    const trace1 = {
      traceAddress: [],
      error: 'Out of gas'
    };
    const trace2 = {
      traceAddress: [1]
    };

    const trie = new custom_trie.CustomTrie([trace1, trace2]);

    const rootChildrenExpected = {
      [custom_trie.DUMMY_FIRST_NODE]: {
        children: {
          1: {
            children: {},
            traceObject: trace2
          }
        },
        traceObject: trace1
      }
    };

    assert.deepStrictEqual(trie.trieRoot.children, rootChildrenExpected);
  });

  it('Test two nodes construction, child failed', async function () {
    const trace3 = {
      traceAddress: [],
    };
    const trace4 = {
      traceAddress: [1],
      error: 'Out of gas'
    };

    const trie = new custom_trie.CustomTrie([trace4, trace3]);

    const rootChildrenExpected = {
      [custom_trie.DUMMY_FIRST_NODE]: {
        children: {
          1: {
            children: {},
            traceObject: trace4
          }
        },
        traceObject: trace3
      }
    };

    assert.deepStrictEqual(trie.trieRoot.children, rootChildrenExpected);
  });

  it('Test failed parent propagates to child', async function () {
    const trace1 = {
      traceAddress: [],
      error: 'Out of gas'
    };
    const trace2 = {
      traceAddress: [1]
    };
    const trace2Expected = {
      traceAddress: [1],
      error: 'parent_error'
    };
    const trie = new custom_trie.CustomTrie([trace1, trace2]);
    trie.markChildrenWithFailedParents();


    const rootChildrenExpected = {
      [custom_trie.DUMMY_FIRST_NODE]: {
        children: {
          1: {
            children: {},
            traceObject: trace2Expected
          }
        },
        traceObject: trace1
      }
    };

    assert.deepStrictEqual(trie.trieRoot.children, rootChildrenExpected);
  });

  it('Test non failed parent does nothing', async function () {
    const trace1 = {
      traceAddress: []
    };
    const trace2 = {
      traceAddress: [1]
    };
    const trace2Expected = {
      traceAddress: [1]
    };
    const trie = new custom_trie.CustomTrie([trace1, trace2]);
    trie.markChildrenWithFailedParents();


    const rootChildrenExpected = {
      [custom_trie.DUMMY_FIRST_NODE]: {
        children: {
          1: {
            children: {},
            traceObject: trace2Expected
          }
        },
        traceObject: trace1
      }
    };

    assert.deepStrictEqual(trie.trieRoot.children, rootChildrenExpected);
  });
});
