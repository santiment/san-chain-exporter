export interface TraceAction {
  author: string,
  address: string,
  rewardType: string,
  callType: string,
  from: string,
  gas: string,
  input: string,
  to: string,
  value: string,
  balance: string,
  refundAddress: string
}

export interface TraceResult {
  gasUsed: string,
  output: string,
  address: string
}

export interface Trace {
  action: TraceAction,
  blockHash: string,
  blockNumber: number,
  result: TraceResult,
  subtraces: 3,
  traceAddress: string[],
  transactionHash: string,
  transactionPosition: number,
  type: string
}

export interface Block {
  baseFeePerGas?: string,
  gasLimit?: string,
  gasUsed?: string,
  hash: string,
  miner: string,
  number: string,
  timestamp: string,
  totalDifficulty?: string,
  difficulty?: string,
  size?: string,
  minGasPrice?: string
  // Withdrawals should be set for ETH post-Shenghai upgrade
  withdrawals?: BeaconChainWithdrawal[],
  transactions: Transaction[]
}

export interface BeaconChainWithdrawal {
  index: string,
  validatorIndex: string,
  address: string,
  amount: string
};

export interface Transaction {
  from: string,
  to: string,
  hash: string,
  blockNumber: string,
  gasPrice: string
  blockHash: string,
  gas: string,
  transactionIndex: string,
  value: string
};

export interface Transfer {
  from: string,
  to: string,
  value: number,
  valueExactBase36: string,
  blockNumber: number,
  timestamp: number,
  transactionHash: string,
  type: string
}