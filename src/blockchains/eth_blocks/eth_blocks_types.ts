export type ETHBlockStats = {
  hash: string,
  miner: string,
  difficulty: string,
  totalDifficulty: string,
  timestamp: number,
  size: number,
  gasLimit: number,
  gasUsed: number,
  number: number,
  transactionCount: number,
  minGasPrice?: string
}
