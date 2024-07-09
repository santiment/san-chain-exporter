import assert from 'assert';
import { markChildrenWithFailedParents, TrieNode, PARENT_ERROR } from '../../blockchains/eth/lib/custom_trie';
import { Trace } from '../../blockchains/eth/eth_types';


describe('custom trie test', function () {

  let trace1: Trace;
  let trace2: Trace;
  let trace3: Trace;
  let trace4: Trace;

  beforeEach(function () {
    trace1 = {
      "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x0"
      },
      "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
      "blockNumber": 81666,
      "result": {
        "gasUsed": "0xb6963",
      },
      "subtraces": 2,
      "traceAddress": [],
      "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
      "transactionPosition": 0,
      "type": "call"
    };

    trace2 = {
      "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x0"
      },
      "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
      "blockNumber": 81666,
      "result": {
        "gasUsed": "0xb6963",
      },
      "subtraces": 0,
      "traceAddress": [0],
      "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
      "transactionPosition": 0,
      "type": "call"
    };

    trace3 = {
      "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x0"
      },
      "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
      "blockNumber": 81666,
      "result": {
        "gasUsed": "0xb6963",
      },
      "subtraces": 0,
      "traceAddress": [1],
      "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
      "transactionPosition": 0,
      "type": "call"
    };

    trace4 = {
      "action": {
        "from": "0x16893e10b99a59afd2c60331e0b49241d4d4d7cc",
        "callType": "call",
        "to": "0x91d050e1a0ee2423a35f2c7191f1c5405854ba99",
        "value": "0x0"
      },
      "blockHash": "0xf4590f903c395538fad33e8ce65e823083bbc49d6489fe84523b2e9a4acce713",
      "blockNumber": 81666,
      "result": {
        "gasUsed": "0xb6963",
      },
      "subtraces": 0,
      "traceAddress": [1, 0],
      "transactionHash": "0x6a53357416176c8e954330fbff34be32ccd078825e9610f2faca603f28e3cdeb",
      "transactionPosition": 0,
      "type": "call"
    };
  })

  it('Test single node, no error', async function () {
    const trace1Expected: Trace = JSON.parse(JSON.stringify(trace1));

    markChildrenWithFailedParents([trace1]);

    assert.deepStrictEqual(trace1, trace1Expected);
  });

  it('Assert throws on non root trace', async function () {
    assert.throws(() => markChildrenWithFailedParents([trace2]), Error);
  });

  it('Test parent failed, child is marked', async function () {
    trace1.error = 'Out of gas';

    const trace1Expected: Trace = JSON.parse(JSON.stringify(trace1));
    const trace2Expected: Trace = JSON.parse(JSON.stringify(trace2));

    markChildrenWithFailedParents([trace1, trace2]);

    trace2Expected.error = PARENT_ERROR

    assert.deepStrictEqual(trace1, trace1Expected);
    assert.deepStrictEqual(trace2, trace2Expected);
  });

  it('Test child failed, nothing changes', async function () {
    trace2.error = 'Out of gas';

    const trace1Expected: Trace = JSON.parse(JSON.stringify(trace1));
    const trace2Expected: Trace = JSON.parse(JSON.stringify(trace2));

    markChildrenWithFailedParents([trace1, trace2]);

    assert.deepStrictEqual(trace1, trace1Expected);
    assert.deepStrictEqual(trace2, trace2Expected);
  });

  it('Test parent failed, two children marked', async function () {
    trace1.error = 'Out of gas';

    const trace1Expected: Trace = JSON.parse(JSON.stringify(trace1));
    const trace2Expected: Trace = JSON.parse(JSON.stringify(trace2));
    const trace3Expected: Trace = JSON.parse(JSON.stringify(trace3));

    trace2Expected.error = PARENT_ERROR;
    trace3Expected.error = PARENT_ERROR;

    markChildrenWithFailedParents([trace1, trace2, trace3]);

    assert.deepStrictEqual(trace1, trace1Expected);
    assert.deepStrictEqual(trace2, trace2Expected);
    assert.deepStrictEqual(trace3, trace3Expected);
  });

  // Test that when we have multiple parent traces for same transaction, each child trace is associated to the correct
  // parent. I did not find such case (multiple parent traces), but it should be possible.
  it('Test two parent traces on top level, one success, other fail', async function () {
    const parent1Success: Trace = JSON.parse(JSON.stringify(trace1));
    trace1.error = 'Out of gas';
    const parent2Failure: Trace = JSON.parse(JSON.stringify(trace1));

    const child1ExpectSuccess: Trace = JSON.parse(JSON.stringify(trace2));
    const child2ExpectError: Trace = JSON.parse(JSON.stringify(trace3));
    child2ExpectError.error = PARENT_ERROR;

    markChildrenWithFailedParents([parent1Success, trace2, parent2Failure, trace3]);

    assert.deepStrictEqual(trace2, child1ExpectSuccess);
    assert.deepStrictEqual(trace3, child2ExpectError);
  });

  it('Test error propagates across two nested parents', async function () {
    // Exact error does not matter, still use another one to show it
    trace1.error = 'invalid jump destination';

    const trace3Expected: Trace = JSON.parse(JSON.stringify(trace3));
    trace3Expected.error = PARENT_ERROR

    const trace4Expected: Trace = JSON.parse(JSON.stringify(trace4));
    trace4Expected.error = PARENT_ERROR

    markChildrenWithFailedParents([trace1, trace3, trace4]);

    assert.deepStrictEqual(trace3, trace3Expected);
    assert.deepStrictEqual(trace4, trace4Expected);
  });

  it('Test two nested parents, grand parent is not affected', async function () {
    const trace1Expected: Trace = JSON.parse(JSON.stringify(trace1));

    trace3.error = 'invalid jump destination';

    markChildrenWithFailedParents([trace1, trace3, trace4]);

    assert.deepStrictEqual(trace1, trace1Expected);
  });

});
