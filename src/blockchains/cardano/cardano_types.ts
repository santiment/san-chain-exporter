export type Transaction = {
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

export type TransactionBlock = {
  number: number
}