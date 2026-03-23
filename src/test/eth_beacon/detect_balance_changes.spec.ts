import assert from 'assert';
import { detectBalanceChanges } from '../../blockchains/eth_beacon/eth_beacon_worker';
import { BalanceState } from '../../blockchains/eth_beacon/beacon_types';

describe('detectBalanceChanges', () => {
  // A brand new validator (not in lastState) with a non-zero balance should produce a change.
  it('detects new validator with non-zero balance', () => {
    const lastState = new Map<number, BalanceState>();
    const balances = [{ index: '1', balance: '32000000000' }];

    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].validatorIndex, 1);
    assert.strictEqual(changes[0].balance, 32000000000);
    assert.strictEqual(changes[0].oldBalance, 0);        // no previous state
    assert.strictEqual(changes[0].oldTimestamp, null);    // no previous timestamp
    assert.strictEqual(changes[0].slot, 100);
    assert.strictEqual(changes[0].timestamp, 5000);
  });

  // A validator not in lastState with 0 balance is never-active — should be skipped.
  it('skips new validator with zero balance', () => {
    const lastState = new Map<number, BalanceState>();
    const balances = [{ index: '1', balance: '0' }];

    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 0);
    assert.strictEqual(lastState.size, 0); // should not be added to state
  });

  // A validator whose balance is unchanged should not appear in the result.
  it('skips validator with unchanged balance', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 });

    const balances = [{ index: '1', balance: '32000000000' }];
    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 0);
    // State should remain unchanged
    assert.strictEqual(lastState.get(1)!.balance, 32000000000);
    assert.strictEqual(lastState.get(1)!.timestamp, 4000);
  });

  // A validator whose balance increased should produce a change with old values.
  it('detects balance increase', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 });

    const balances = [{ index: '1', balance: '32100000000' }];
    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].balance, 32100000000);
    assert.strictEqual(changes[0].oldBalance, 32000000000);
    assert.strictEqual(changes[0].oldTimestamp, 4000);

    // State should be updated
    assert.strictEqual(lastState.get(1)!.balance, 32100000000);
    assert.strictEqual(lastState.get(1)!.timestamp, 5000);
  });

  // A validator whose balance decreased (e.g. slashing penalty).
  it('detects balance decrease', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 });

    const balances = [{ index: '1', balance: '31500000000' }];
    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].balance, 31500000000);
    assert.strictEqual(changes[0].oldBalance, 32000000000);
  });

  // When a validator's balance drops to 0 (exited), its entry should be removed from state.
  it('removes validator from state when balance drops to zero', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 });

    const balances = [{ index: '1', balance: '0' }];
    const changes = detectBalanceChanges(balances, lastState, 100, 5000);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0].balance, 0);
    assert.strictEqual(changes[0].oldBalance, 32000000000);

    // Entry should be deleted from the state map
    assert.strictEqual(lastState.has(1), false);
  });

  // Mix of changed, unchanged, new, and exited validators in a single call.
  it('handles a mix of changed and unchanged validators', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 }); // unchanged
    lastState.set(2, { balance: 31000000000, timestamp: 4000 }); // will increase
    lastState.set(3, { balance: 30000000000, timestamp: 4000 }); // will exit (balance -> 0)

    const balances = [
      { index: '1', balance: '32000000000' },  // no change
      { index: '2', balance: '32000000000' },  // increased
      { index: '3', balance: '0' },            // exited
      { index: '4', balance: '32000000000' },  // new validator
      { index: '5', balance: '0' },            // new but zero — skipped
    ];

    const changes = detectBalanceChanges(balances, lastState, 200, 6000);

    // 3 changes: validator 2 (increase), 3 (exit), 4 (new)
    assert.strictEqual(changes.length, 3);

    const byIndex = new Map(changes.map(c => [c.validatorIndex, c]));
    assert.ok(!byIndex.has(1)); // unchanged, not in results
    assert.ok(!byIndex.has(5)); // new with 0 balance, not in results

    assert.strictEqual(byIndex.get(2)!.balance, 32000000000);
    assert.strictEqual(byIndex.get(2)!.oldBalance, 31000000000);

    assert.strictEqual(byIndex.get(3)!.balance, 0);
    assert.strictEqual(byIndex.get(3)!.oldBalance, 30000000000);

    assert.strictEqual(byIndex.get(4)!.balance, 32000000000);
    assert.strictEqual(byIndex.get(4)!.oldBalance, 0);
    assert.strictEqual(byIndex.get(4)!.oldTimestamp, null);

    // State should reflect: 1 unchanged, 2 updated, 3 deleted, 4 added, 5 not added
    assert.strictEqual(lastState.size, 3);
    assert.strictEqual(lastState.get(1)!.balance, 32000000000);
    assert.strictEqual(lastState.get(2)!.balance, 32000000000);
    assert.strictEqual(lastState.get(4)!.balance, 32000000000);
    assert.strictEqual(lastState.has(3), false);
    assert.strictEqual(lastState.has(5), false);
  });

  // Empty input should return empty result and not modify state.
  it('returns empty array for empty input', () => {
    const lastState = new Map<number, BalanceState>();
    lastState.set(1, { balance: 32000000000, timestamp: 4000 });

    const changes = detectBalanceChanges([], lastState, 100, 5000);

    assert.strictEqual(changes.length, 0);
    assert.strictEqual(lastState.size, 1); // unchanged
  });

  // Validates that slot and timestamp are correctly passed through to all changes.
  it('propagates slot and timestamp to all change records', () => {
    const lastState = new Map<number, BalanceState>();

    const balances = [
      { index: '1', balance: '100' },
      { index: '2', balance: '200' },
    ];

    const changes = detectBalanceChanges(balances, lastState, 999, 12345);

    assert.strictEqual(changes.length, 2);
    for (const change of changes) {
      assert.strictEqual(change.slot, 999);
      assert.strictEqual(change.timestamp, 12345);
    }
  });
});
