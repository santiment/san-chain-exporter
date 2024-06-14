import { z } from "zod";
import { ETHBlockStats } from "../eth_blocks_types";

const ETHBlockSchema = z.object({
  hash: z.string(),
  miner: z.string(),
  difficulty: z.string(),
  totalDifficulty: z.string(),
  timestamp: z.number().min(0, "Timestamp should not be negative"),
  size: z.number().min(0, "Size should not be negative"),
  gasLimit: z.number().min(0, "Gas limit should not be negative"),
  gasUsed: z.number().min(0, "Gas used should not be negative"),
  number: z.number().min(0, "Number should not be negative"),
  transactionCount: z.number().min(0, "Transaction count should not be negative"),
  minGasPrice: z.string().optional()
});

export function validateETHBlocksStats(block: ETHBlockStats) {
  ETHBlockSchema.parse(block);
}
