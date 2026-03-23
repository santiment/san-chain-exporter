export type BeaconBalance = {
  slot: number;
  timestamp: number;
  balance: number;
  oldTimestamp: number | null;
  oldBalance: number | null;
  validatorIndex: number;
};

// Tracks the last known balance and timestamp for a single validator.
// Used by detectBalanceChanges to compute diffs between daily snapshots.
export type BalanceState = {
  balance: number;
  timestamp: number;
};