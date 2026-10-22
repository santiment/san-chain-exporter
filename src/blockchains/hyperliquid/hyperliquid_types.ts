/**
 * The liquidated user's side of one liquidation fill, as written to Kafka. Prices, sizes and amounts are kept as the
 * node's decimal strings. See the README for the meaning of each field.
 */
export interface HyperliquidLiquidation {
  primaryKey: number;     // Kafka key: blockNumber * PRIMARY_KEY_MULTIPLIER + index of the fill in the block
  blockNumber: number;
  timestamp: number;      // Unix ms, block time
  hash: string;
  tid: number;
  coin: string;
  user: string;           // the liquidated account
  side: string;           // 'A' (sold: a long was liquidated) or 'B' (bought: a short was liquidated)
  px: string;
  sz: string;
  startPosition: string;
  closedPnl: string;
  fee: string;
  markPx: string;
  method: string;         // 'market' or 'backstop'
}

/** A raw feed record as decoded by @grpc/proto-loader. */
export interface FeedRecord {
  block_number?: number;
  timestamp?: number;
  data: Buffer;
}
