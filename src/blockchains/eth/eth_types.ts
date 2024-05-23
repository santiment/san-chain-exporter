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

export interface ETHBlock {
  baseFeePerGas?: string,
  gasLimit: string,
  gasUsed: string,
  hash: string,
  miner: string,
  number: string,
  timestamp: string,
  totalDifficulty: string,
  difficulty: string,
  size: string,
  minGasPrice?: string
  // Withdrawals should be set for ETH post-Shenghai upgrade
  withdrawals?: BeaconChainWithdrawal[],
  transactions: ETHTransaction[]
}

export interface BeaconChainWithdrawal {
  index: string,
  validatorIndex: string,
  address: string,
  amount: number
};

export interface ETHTransaction {
  from: string,
  to: string,
  transactionHash: string,
  blockNumber: string,
  gasPrice: string
  blockHash: string,
  gas: string,
  transactionIndex: string,
  value: string,
  type: string,
  maxPriorityFeePerGas?: string,
  maxFeePerGas?: string
};

export interface ETHTransfer {
  from: string,
  to: string,
  value: number,
  valueExactBase36: string,
  blockNumber: number,
  timestamp: number,
  transactionHash?: string,
  transactionPosition?: number,
  type: string,
  primaryKey?: number,
}

export interface ETHReceipt {
  blockNumber: string,
  blockHash: string,
  gasUsed: string,
  transactionHash: string,
  cumulativeGasUsed: string,
  effectiveGasPrice: string,
  logs: any[],
  transactionIndex: string,
  type: string
}

export interface ETHReceiptsMap {
  [transactionHash: string]: ETHReceipt;
}


