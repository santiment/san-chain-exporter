import { z } from "zod";
import { ETHBlockStats } from "../eth_blocks_types";

const ETHBlockSchema = z.object({
  hash: z.string(),
  miner: z.string(),
  difficulty: z.string(),
  totalDifficulty: z.string(),
  timestamp: z.string(),
  size: z.union([z.number(), z.bigint()]),
  gasLimit: z.string(),
  gasUsed: z.string(),
  number: z.union([z.number(), z.bigint()]),
  transactionCount: z.number(),
  minGasPrice: z.string().optional()
});

export function validateETHBlocksStats(block: ETHBlockStats) {
  ETHBlockSchema.parse(block);
}
