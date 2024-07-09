import { z } from "zod";

const ContractCreationTrace = z.object({
  address: z.string().min(1, "Address should be non empty"),
  address_fabric: z.string().optional(),
  address_creator: z.string(),
  transaction_hash: z.string().min(1, "Transaction hash should be non empty"),
  block_number: z.number().min(0, "Block number should not be negative"),
  block_created_at_timestamp: z.number().min(0, "Timestamp should not be negative"),
});

export type ContractCreationTrace = z.infer<typeof ContractCreationTrace>;

export function validateContractCreationTrace(trace: ContractCreationTrace) {
  ContractCreationTrace.parse(trace);
}
