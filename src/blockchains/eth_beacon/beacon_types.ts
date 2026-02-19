export type BeaconBalance = {
  slot: number;
  timestamp: number;
  balance: number;
  oldTimestamp: number | null;
  oldBalance: number | null;
  validatorIndex: number;
};