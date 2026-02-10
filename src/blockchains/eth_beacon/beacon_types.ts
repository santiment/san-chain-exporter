export type GenesisResponse = {
  data: {
    genesis_time: string;
  };
};

export type BeaconBalance = {
  slot: number;
  timestamp: number;
  balance: number;
  oldTimestamp: number | null;
  oldBalance: number | null;
  pubkey: string;
};