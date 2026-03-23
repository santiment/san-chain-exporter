import assert from 'assert';
import { primaryKeyOrderComparator, isPrimaryKeyOverflow, transactionOrder } from '../../blockchains/erc20/lib/extend_events_key';
import { ERC20Transfer } from '../../blockchains/erc20/erc20_types';

// Helper to create a minimal ERC20Transfer with the fields relevant to sorting.
function makeTransfer(overrides: Partial<ERC20Transfer>): ERC20Transfer {
  return {
    from: '0xa',
    to: '0xb',
    value: BigInt(1),
    valueExactBase36: '1',
    contract: '0xc',
    blockNumber: 100,
    timestamp: 1000,
    transactionHash: '0xtx',
    logIndex: 0,
    transactionIndex: 0,
    ...overrides,
  };
}

describe('transactionOrder', () => {
  // Basic sorting by block number.
  it('sorts by blockNumber first', () => {
    const a = makeTransfer({ blockNumber: 200 });
    const b = makeTransfer({ blockNumber: 100 });
    assert.ok(transactionOrder(a, b) > 0);
    assert.ok(transactionOrder(b, a) < 0);
  });

  // Same block — falls through to transaction index.
  it('sorts by transactionIndex when blockNumber is equal', () => {
    const a = makeTransfer({ blockNumber: 100, transactionIndex: 5 });
    const b = makeTransfer({ blockNumber: 100, transactionIndex: 3 });
    assert.ok(transactionOrder(a, b) > 0);
    assert.ok(transactionOrder(b, a) < 0);
  });

  // Same block and tx — falls through to log index.
  it('sorts by logIndex when block and txIndex are equal', () => {
    const a = makeTransfer({ blockNumber: 100, transactionIndex: 5, logIndex: 10 });
    const b = makeTransfer({ blockNumber: 100, transactionIndex: 5, logIndex: 3 });
    assert.ok(transactionOrder(a, b) > 0);
    assert.ok(transactionOrder(b, a) < 0);
  });

  // Returns 0 when all three fields are equal.
  it('returns 0 for identical ordering fields', () => {
    const a = makeTransfer({ blockNumber: 100, transactionIndex: 5, logIndex: 10 });
    const b = makeTransfer({ blockNumber: 100, transactionIndex: 5, logIndex: 10 });
    assert.strictEqual(transactionOrder(a, b), 0);
  });

  // Non-number transactionIndex is treated as -1, sorting before valid indices.
  it('treats non-number transactionIndex as -1', () => {
    const a = makeTransfer({ transactionIndex: undefined as any });
    const b = makeTransfer({ transactionIndex: 0 });
    assert.ok(transactionOrder(a, b) < 0);
  });
});

describe('primaryKeyOrderComparator', () => {
  // Same basic ordering as transactionOrder for different blocks.
  it('sorts by blockNumber first', () => {
    const a = makeTransfer({ blockNumber: 200, primaryKey: 1 });
    const b = makeTransfer({ blockNumber: 100, primaryKey: 2 });
    assert.ok(primaryKeyOrderComparator(a, b) > 0);
  });

  // Same block, different transaction index.
  it('sorts by transactionIndex when blockNumber is equal', () => {
    const a = makeTransfer({ transactionIndex: 5, primaryKey: 1 });
    const b = makeTransfer({ transactionIndex: 3, primaryKey: 2 });
    assert.ok(primaryKeyOrderComparator(a, b) > 0);
  });

  // Same block and tx, different log index.
  it('sorts by logIndex when block and txIndex are equal', () => {
    const a = makeTransfer({ logIndex: 10, primaryKey: 1 });
    const b = makeTransfer({ logIndex: 3, primaryKey: 2 });
    assert.ok(primaryKeyOrderComparator(a, b) > 0);
  });

  // When block, tx, and log index are all equal, primaryKey is the tiebreaker.
  // This happens when overwritten events share the same position as originals.
  it('uses primaryKey as final tiebreaker', () => {
    const a = makeTransfer({ primaryKey: 50 });
    const b = makeTransfer({ primaryKey: 30 });
    assert.ok(primaryKeyOrderComparator(a, b) > 0);
    assert.ok(primaryKeyOrderComparator(b, a) < 0);
  });

  // Returns 0 when everything including primaryKey is equal.
  it('returns 0 when all fields including primaryKey are equal', () => {
    const a = makeTransfer({ primaryKey: 10 });
    const b = makeTransfer({ primaryKey: 10 });
    assert.strictEqual(primaryKeyOrderComparator(a, b), 0);
  });

  // Throws if primaryKey is not set — catches programming errors where
  // events are sorted before primary keys are assigned.
  it('throws if primaryKey is not a number on either event', () => {
    const a = makeTransfer({ primaryKey: undefined });
    const b = makeTransfer({ primaryKey: 10 });
    assert.throws(
      () => primaryKeyOrderComparator(a, b),
      (err: Error) => err.message.includes('Primary keys should be set')
    );
  });

  // Both primaryKeys missing should also throw.
  it('throws if both primaryKeys are undefined', () => {
    const a = makeTransfer({ primaryKey: undefined });
    const b = makeTransfer({ primaryKey: undefined });
    assert.throws(
      () => primaryKeyOrderComparator(a, b),
      (err: Error) => err.message.includes('Primary keys should be set')
    );
  });

  // Non-number transactionIndex should be treated as -1.
  it('treats non-number transactionIndex as -1', () => {
    const a = makeTransfer({ transactionIndex: undefined as any, primaryKey: 1 });
    const b = makeTransfer({ transactionIndex: 0, primaryKey: 2 });
    assert.ok(primaryKeyOrderComparator(a, b) < 0);
  });
});

describe('isPrimaryKeyOverflow', () => {
  const MULTIPLIER = 10000;

  // Well below the limit — no overflow.
  it('returns false when sum is below multiplier', () => {
    assert.strictEqual(isPrimaryKeyOverflow(100, 50, MULTIPLIER), false);
  });

  // Exactly at the boundary is an overflow (>= comparison).
  it('returns true when sum equals multiplier', () => {
    assert.strictEqual(isPrimaryKeyOverflow(9999, 1, MULTIPLIER), true);
  });

  // Above the boundary.
  it('returns true when sum exceeds multiplier', () => {
    assert.strictEqual(isPrimaryKeyOverflow(9000, 2000, MULTIPLIER), true);
  });

  // No overwritten events — only maxLogIndex matters.
  it('returns false with zero overwritten and low logIndex', () => {
    assert.strictEqual(isPrimaryKeyOverflow(500, 0, MULTIPLIER), false);
  });

  // Edge case: maxLogIndex alone reaches the multiplier.
  it('returns true when maxLogIndex alone reaches multiplier', () => {
    assert.strictEqual(isPrimaryKeyOverflow(MULTIPLIER, 0, MULTIPLIER), true);
  });

  // Both zero — well below any positive multiplier.
  it('returns false when both are zero', () => {
    assert.strictEqual(isPrimaryKeyOverflow(0, 0, MULTIPLIER), false);
  });

  // Edge case: multiplier of 1 — even logIndex 0 with 1 overwrite overflows.
  it('handles multiplier of 1', () => {
    assert.strictEqual(isPrimaryKeyOverflow(0, 1, 1), true);
    assert.strictEqual(isPrimaryKeyOverflow(0, 0, 1), false);
  });
});
