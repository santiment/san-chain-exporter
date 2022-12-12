/*jshint esversion: 6 */
const assert = require('assert');

const xrp_worker = require('../../blockchains/xrp/xrp_worker');

/** A stripped down XRP block */
const xrpBlock = {
  'ledger': {
    'accepted': true,
    'hash': '01AFAE9D64B549B014EC1FCCEB7A0EBFA34A0BE3D84B4909B3C9D7B7B0DE076A',
    'ledger_hash': '01AFAE9D64B549B014EC1FCCEB7A0EBFA34A0BE3D84B4909B3C9D7B7B0DE076A',
    'ledger_index': '3232710',
    'transaction_hash': '0993BFF01B90E030E065ECA2752EB563466FCA31356CBA2C495B5E5407117FC5',
    'transactions': [
      'D52DC46F5E7EB1068256AF2C42331CC23AC9F0C83824A1909F2141FEC001DBCF'
    ]
  },
  'transactions': [
    {
      'Account': 'rUqNn26jQG8zfNDy21NTCwgFXrFgLyRf3U',
      'Fee': '10',
      'Flags': 0,
      'Sequence': 101317,
      'SigningPubKey': '02B1A8D1DF2C281BA7A872B59E765A0CE7B7A31D8A7ACD7030DA2E45C4D33CF2C4',
      'metaData': {
        'AffectedNodes': []
      }
    }
  ]
};



const mockFetchLedgerTransactions = (connection, ledger_index) => {
  const localBlock = structuredClone(xrpBlock);
  localBlock.ledger.ledger_index = ledger_index;
  return localBlock;
};

describe('workLoopSimpleTest', function () {
  it('Checking that position is being updated', async function () {
    const worker = new xrp_worker.worker();
    worker.fetchLedgerTransactions = mockFetchLedgerTransactions;

    // Set a huge last confirmed Node block, so that we do not ask the node and mock more easily.
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 20;
    await worker.work();

    const lastProcessedPosition = worker.getLastProcessedPosition();

    // The above loop should have progressed the lastProcessedPosition to the last known Node block
    assert.deepStrictEqual(
      lastProcessedPosition,
      {
        blockNumber: 20,
        primaryKey: 20
      }
    );
  });

  it('Checking that expected result is returned', async function () {
    const worker = new xrp_worker.worker();
    worker.fetchLedgerTransactions = mockFetchLedgerTransactions;

    // Set a huge last confirmed Node block, so that we do not ask the node and mock more easily.
    worker.lastExportedBlock = 10;
    worker.lastConfirmedBlock = 20;
    const result = await worker.work();

    const expectedResult = [];

    for (let ledger_index = 11; ledger_index <= 20; ++ledger_index) {
      const localBlock = structuredClone(xrpBlock);
      localBlock.ledger.ledger_index = ledger_index;
      localBlock.primaryKey = ledger_index;
      expectedResult.push(localBlock);
    }
    assert.deepStrictEqual(result, expectedResult);
  });

});
