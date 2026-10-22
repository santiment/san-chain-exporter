import { HyperliquidLiquidation } from '../hyperliquid_types';

// primaryKey = blockNumber * PRIMARY_KEY_MULTIPLIER + index of the fill in the block's events. Keeps keys below 2^53
// up to block ~9e9. Do not change: it would change the keys of already exported liquidations.
export const PRIMARY_KEY_MULTIPLIER = 1_000_000;

/**
 * Extract the liquidations from one node_fills_by_block envelope, as carried in Record.data of the Dwellir StreamFills
 * feed:
 *
 *   {"local_time": "...", "block_time": "2026-10-21T09:46:43.892", "block_number": 1191799936,
 *    "events": [["0x<user>", {"coin": "BTC", "px": "...", "tid": 123, "liquidation": {...} | null, ...}], ...]}
 *
 * A liquidation match contains the liquidated user's fill and the fills of the makers (or backstop vault) on the
 * other side, all with the same (coin, tid) and all carrying `liquidation`. Only the liquidated user's fills are kept.
 */
export function parseLiquidations(data: Buffer | string, recordBlockNumber?: number,
  recordTimestamp?: number): { blockNumber: number, liquidations: HyperliquidLiquidation[] } {
  const envelope = JSON.parse(data.toString());
  const blockNumber: number = envelope.block_number ?? recordBlockNumber;
  if (typeof blockNumber !== 'number') {
    throw new Error(`Fills record without block number: ${data.toString().slice(0, 200)}`);
  }
  const blockEvents: any[] = envelope.events ?? [];
  if (blockEvents.length > PRIMARY_KEY_MULTIPLIER) {
    throw new Error(`Block ${blockNumber} has ${blockEvents.length} fills, more than PRIMARY_KEY_MULTIPLIER allows`);
  }

  const liquidations: HyperliquidLiquidation[] = [];
  // The index counts every fill of the block, so a liquidation gets the same key on every replay.
  blockEvents.forEach(([user, fill], index) => {
    const liquidation = fill.liquidation;
    if (!liquidation || user.toLowerCase() !== String(liquidation.liquidatedUser).toLowerCase()) {
      return;
    }
    liquidations.push({
      primaryKey: blockNumber * PRIMARY_KEY_MULTIPLIER + index,
      blockNumber,
      timestamp: recordTimestamp ?? parseBlockTime(envelope.block_time),
      hash: fill.hash,
      tid: fill.tid,
      coin: fill.coin,
      user: user.toLowerCase(),
      side: fill.side,
      px: fill.px,
      sz: fill.sz,
      startPosition: fill.startPosition,
      closedPnl: fill.closedPnl,
      fee: fill.fee,
      markPx: liquidation.markPx,
      method: liquidation.method,
    });
  });
  return { blockNumber, liquidations };
}

/** '2026-10-21T09:46:43.892720809' (UTC, nanoseconds, no zone) -> Unix ms. */
export function parseBlockTime(blockTime: string): number {
  const millis = Date.parse(blockTime.slice(0, 23) + 'Z');
  if (Number.isNaN(millis)) {
    throw new Error(`Unexpected block_time '${blockTime}'`);
  }
  return millis;
}
