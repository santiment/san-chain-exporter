export type ERC20Transfer = {
  from: string,
  to: string,
  value: number,
  valueExactBase36: string,
  contract: string,
  blockNumber: number,
  timestamp: number,
  transactionHash: string,
  logIndex: number
  type?: string,
  primaryKey?: number
}

