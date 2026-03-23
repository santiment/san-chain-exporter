import assert from 'assert';
import { createFeeTransfer } from '../../blockchains/eth/lib/fees_decoder';
import { ETHBlock, ETHTransaction } from '../../blockchains/eth/eth_types';

// Minimal transaction and block objects with hex-encoded fields,
// matching the structure that createFeeTransfer expects.
const mockTransaction: ETHTransaction = {
  from: '0xsender',
  to: '0xreceiver',
  hash: '0xtxhash',
  blockNumber: '0xa',      // 10
  gasPrice: '0x1',
  blockHash: '0xblockhash',
  gas: '0x5208',
  transactionIndex: '0x3', // 3
  value: '0x0',
  type: '0x0',
};

const mockBlock: ETHBlock = {
  gasLimit: '0x1',
  gasUsed: '0x1',
  hash: '0xblockhash',
  miner: '0xminer',
  number: '0xa',
  timestamp: '0x64',       // 100
  difficulty: '1',
  size: '1',
  transactions: [],
};

describe('createFeeTransfer', () => {
  // Verifies the basic shape: all fields correctly derived from inputs.
  it('creates a fee transfer with correct fields', () => {
    const result = createFeeTransfer(
      '0xfrom', '0xto', BigInt(1000), mockTransaction, mockBlock, 'fee'
    );

    assert.strictEqual(result.from, '0xfrom');
    assert.strictEqual(result.to, '0xto');
    assert.strictEqual(result.value, 1000);
    assert.strictEqual(result.valueExactBase36, BigInt(1000).toString(36));
    assert.strictEqual(result.blockNumber, 10);
    assert.strictEqual(result.timestamp, 100);
    assert.strictEqual(result.transactionHash, '0xtxhash');
    assert.strictEqual(result.transactionPosition, 3);
    assert.strictEqual(result.internalTxPosition, 0);
    assert.strictEqual(result.type, 'fee');
  });

  // Zero gas expense is valid (e.g. post-London tx where baseFee equals gasPrice).
  it('handles zero gas expense', () => {
    const result = createFeeTransfer(
      '0xfrom', '0xto', BigInt(0), mockTransaction, mockBlock, 'fee_burnt'
    );

    assert.strictEqual(result.value, 0);
    assert.strictEqual(result.valueExactBase36, '0');
    assert.strictEqual(result.type, 'fee_burnt');
  });

  // Large values should still produce correct base36 encoding even if Number() loses precision.
  // The valueExactBase36 field preserves the full-precision value.
  it('preserves precision in valueExactBase36 for large values', () => {
    const largeGas = BigInt('9007199254740993'); // > Number.MAX_SAFE_INTEGER
    const result = createFeeTransfer(
      '0xfrom', '0xto', largeGas, mockTransaction, mockBlock, 'fee'
    );

    // base36 encoding should be lossless from the bigint
    assert.strictEqual(result.valueExactBase36, largeGas.toString(36));
  });

  // The type field is passed through as-is — supports any fee type string.
  it('passes through arbitrary type strings', () => {
    const result = createFeeTransfer(
      '0xfrom', '0xto', BigInt(1), mockTransaction, mockBlock, 'custom_type'
    );
    assert.strictEqual(result.type, 'custom_type');
  });
});
