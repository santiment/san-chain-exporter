import { z } from "zod"

const TraceActionSchema = z.object({
  author: z.string().optional(),
  address: z.string().optional(),
  rewardType: z.string().optional(),
  callType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  value: z.string().optional(),
  balance: z.string().optional(),
  refundAddress: z.string().optional()
});


export type TraceAction = z.infer<typeof TraceActionSchema>

const TraceResultSchema = z.object({
  gasUsed: z.string(),
  address: z.string().optional()
})

export type TraceResult = z.infer<typeof TraceResultSchema>

export const TraceSchema = z.object({
  action: TraceActionSchema,
  blockHash: z.string(),
  blockNumber: z.number(),
  result: TraceResultSchema.optional().nullable(),
  subtraces: z.number(),
  traceAddress: z.array(z.number()),
  transactionHash: z.string().optional(),
  transactionPosition: z.number().optional(),
  type: z.string(),
  error: z.string().optional()
})

export type Trace = z.infer<typeof TraceSchema>

export type ETHBlock = {
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
  // Transactions can be expanded or just hashes
  transactions: ETHTransaction[] | string[]
}

export type BeaconChainWithdrawal = {
  index: string,
  validatorIndex: string,
  address: string,
  amount: string
};

export type ETHTransaction = {
  from: string,
  to: string,
  hash: string,
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

export type ETHTransfer = {
  from: string,
  to: string,
  value: number,
  valueExactBase36: string,
  blockNumber: number,
  timestamp: number,
  transactionHash: string,
  transactionPosition: number,
  internalTxPosition: number,
  type: string,
  primaryKey?: number,
}

export type ETHReceipt = {
  blockNumber: string,
  blockHash: string,
  gasUsed: string,
  transactionHash: string,
  cumulativeGasUsed: string,
  logs: any[],
  transactionIndex: string
}

export type ETHReceiptsMap = {
  [transactionHash: string]: ETHReceipt;
}


