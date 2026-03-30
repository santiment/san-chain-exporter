import assert from 'assert';
import { buildTraceTransfer } from '../../blockchains/eth/lib/decode_transfers';

describe('buildTraceTransfer', () => {
  // Verifies the basic shape with a simple hex value.
  it('creates a transfer with correct fields from hex value', () => {
    const result = buildTraceTransfer(
      '0xfrom', '0xto', '0x64', // 100 in hex
      500, 1000000, '0xtxhash', 5, 'call'
    );

    assert.strictEqual(result.from, '0xfrom');
    assert.strictEqual(result.to, '0xto');
    assert.strictEqual(result.value, 100);
    assert.strictEqual(result.blockNumber, 500);
    assert.strictEqual(result.timestamp, 1000000);
    assert.strictEqual(result.transactionHash, '0xtxhash');
    assert.strictEqual(result.transactionPosition, 5);
    assert.strictEqual(result.internalTxPosition, 0);
    assert.strictEqual(result.type, 'call');
  });

  // Zero-value transfers are valid (e.g. contract calls with no ETH sent).
  it('handles zero hex value (0x0)', () => {
    const result = buildTraceTransfer(
      '0xfrom', '0xto', '0x0',
      1, 1, '0xtx', 0, 'call'
    );

    assert.strictEqual(result.value, 0);
    assert.strictEqual(result.valueExactBase36, '0');
  });

  // Large hex values should produce correct base36 encoding.
  it('converts large hex values correctly to base36', () => {
    // 5 ETH in wei = 5000000000000000000 = 0x4563918244F40000
    const result = buildTraceTransfer(
      '0xfrom', '0xto', '0x4563918244F40000',
      1, 1, '0xtx', 0, 'reward'
    );

    assert.strictEqual(result.value, 5000000000000000000);
    assert.strictEqual(result.valueExactBase36, BigInt('5000000000000000000').toString(36));
  });

  // The type field is passed through — supports all trace types.
  it('supports different trace types', () => {
    const types = ['reward', 'create', 'suicide', 'call'];
    for (const type of types) {
      const result = buildTraceTransfer('0xa', '0xb', '0x1', 1, 1, '0xtx', 0, type);
      assert.strictEqual(result.type, type);
    }
  });

  // Reward traces use synthetic from/transactionHash values like "mining_block".
  // buildTraceTransfer should pass them through unchanged.
  it('passes through synthetic addresses for reward traces', () => {
    const result = buildTraceTransfer(
      'mining_block', '0xminer', '0x1',
      100, 1000, 'mining_block', 0, 'reward'
    );

    assert.strictEqual(result.from, 'mining_block');
    assert.strictEqual(result.transactionHash, 'mining_block');
    assert.strictEqual(result.transactionPosition, 0);
  });
});
