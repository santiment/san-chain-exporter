export interface Transaction {
  block: TransactionBlock,
  hash: string,

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

export interface TransactionBlock {
  number: number
}