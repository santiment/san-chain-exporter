export type ETHBlockStats = {
  hash: string,
  miner: string,
  difficulty: string,
  totalDifficulty: string,
  timestamp: string,
  size: number | BigInt,
  gasLimit: string,
  gasUsed: string,
  number: number | BigInt,
  transactionCount: number,
  minGasPrice?: string
}
