import assert from 'assert';
import { parseICPBlockTransaction } from '../../blockchains/icp/icp_worker';
import { ICPTransaction } from '../../blockchains/icp/lib/icp_types';

const BURN_ADDRESS = 'burn';

function makeTx(operations: any[]): ICPTransaction {
  return {
    transaction_identifier: { hash: 'tx-hash-1' },
    metadata: { block_height: '10', memo: '0', timestamp: '1700000000000000000' }, // nanoseconds
    operations,
  };
}

describe('parseICPBlockTransaction', () => {
  it('parses a FEE operation', () => {
    const tx = makeTx([{
      operation_identifier: { index: '0' },
      type: 'FEE',
      status: '',
      account: { address: 'sender-addr' },
      amount: { value: '-10000', currency: { symbol: 'ICP', decimals: '8' } },
      metadata: {},
    }]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'FEE');
    assert.strictEqual(result[0].from, 'sender-addr');
    assert.strictEqual(result[0].to, BURN_ADDRESS);
    assert.strictEqual(result[0].value, '10000'); // absolute value, minus removed
    assert.strictEqual(result[0].timestamp, '1700000000');
    assert.strictEqual(result[0].blockNumber, 5);
  });

  it('parses a MINT operation', () => {
    const tx = makeTx([{
      operation_identifier: { index: '0' },
      type: 'MINT',
      status: '',
      account: { address: 'receiver-addr' },
      amount: { value: '50000', currency: { symbol: 'ICP', decimals: '8' } },
      metadata: {},
    }]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'MINT');
    assert.strictEqual(result[0].from, 'mint');
    assert.strictEqual(result[0].to, 'receiver-addr');
    assert.strictEqual(result[0].value, '50000');
  });

  it('parses an APPROVE operation', () => {
    const tx = makeTx([{
      operation_identifier: { index: '0' },
      type: 'APPROVE',
      status: '',
      account: { address: 'owner-addr' },
      amount: { value: '0', currency: { symbol: 'ICP', decimals: '8' } },
      metadata: { spender: 'spender-addr', allowance: { e8s: '100000' }, expected_allowance: '', expires_at: '', from: '' },
    }]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'APPROVE');
    assert.strictEqual(result[0].from, 'owner-addr');
    assert.strictEqual(result[0].to, 'spender-addr');
    assert.strictEqual(result[0].value, '100000');
    assert.strictEqual(result[0].symbol, 'ICP');
  });

  // A TRANSACTION consists of a debit (negative value) and credit (positive value) pair
  // with adjacent operation indices and matching absolute values.
  it('parses a matched TRANSACTION debit/credit pair', () => {
    const tx = makeTx([
      {
        operation_identifier: { index: '0' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'sender' },
        amount: { value: '-200', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
      {
        operation_identifier: { index: '1' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'receiver' },
        amount: { value: '200', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
    ]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'TRANSACTION');
    assert.strictEqual(result[0].from, 'sender');
    assert.strictEqual(result[0].to, 'receiver');
    assert.strictEqual(result[0].value, '200');
  });

  // Debit/credit with non-adjacent indices should not match.
  it('does not match TRANSACTION pair with non-adjacent indices', () => {
    const tx = makeTx([
      {
        operation_identifier: { index: '0' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'sender' },
        amount: { value: '-200', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
      {
        operation_identifier: { index: '5' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'receiver' },
        amount: { value: '200', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
    ]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 0);
  });

  // Debit/credit with mismatched values should not match.
  it('does not match TRANSACTION pair with mismatched values', () => {
    const tx = makeTx([
      {
        operation_identifier: { index: '0' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'sender' },
        amount: { value: '-200', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
      {
        operation_identifier: { index: '1' },
        type: 'TRANSACTION',
        status: '',
        account: { address: 'receiver' },
        amount: { value: '300', currency: { symbol: 'ICP', decimals: '8' } },
        metadata: {},
      },
    ]);

    const result = parseICPBlockTransaction(tx, 5, BURN_ADDRESS);
    assert.strictEqual(result.length, 0);
  });
});
