# Hyperliquid liquidations exporter

Exports Hyperliquid liquidations from the [Dwellir Hyperliquid gRPC API](https://www.dwellir.com/docs/hyperliquid/grpc)
(V3 raw feed `HyperliquidL1Gateway/StreamFills`, the node's `node_fills_by_block` files).

## How it works

The feed is a server stream positioned by block number: it replays from the requested block and then tails new blocks.
The worker keeps one stream open from `lastExportedBlock + 1`, buffers the records as they arrive, and every `work()`
call drains the buffer into one Kafka transaction (at most `MAX_BLOCKS_PER_BATCH` blocks). The saved position is
the last block written, so restarts and reconnects continue right after it. The replay reaches only as far back as
the endpoint retains history; an older position fails with `NOT_FOUND`.

A failed, ended or silent stream is reopened from the last exported block with exponential backoff. Records buffered
before the failure are exported first. After `STREAM_MAX_RECONNECTS` failed attempts in a row, and on errors a
reconnect cannot fix (`NOT_FOUND`, `UNAUTHENTICATED`, `INVALID_ARGUMENT`, ...), the error is thrown and the
exporter restarts.

Every fill of a liquidation carries `liquidation = {liquidatedUser, markPx, method}`: the liquidated user's fill and
the fills of the makers or backstop vault on the other side of the same `(coin, tid)` match. Only the liquidated
user's fills are exported, so the sum of `px * sz` is the liquidated volume.

Without a coin filter a record arrives for every block (~10 per second). Dwellir bills one API credit per streamed
record; `requests_made_count` counts them.

## Output

One Kafka record per liquidation fill: the liquidated user's side of one match against the book (market
liquidation) or against the backstop vault. A liquidated position closed against several resting orders produces
several records. Prices, sizes and amounts are the node's decimal strings.

```json
{
  "primaryKey": 1191944356000004,
  "blockNumber": 1191944356,
  "timestamp": 1792586803349,
  "hash": "0x6192086f60b54e59630b04470ba0a40202e70054fbb86d2b055ab3c21fb92844",
  "tid": 645845164397019,
  "coin": "io:PRL",
  "user": "0x78ebd40d10bf33dc95e8af138d7b3ba9c3bf4192",
  "side": "B",
  "px": "2.4785",
  "sz": "6.2",
  "startPosition": "-6.2",
  "closedPnl": "-2.59222",
  "fee": "0.001383",
  "markPx": "2.4568",
  "method": "market"
}
```

| Field | Meaning |
|---|---|
| `primaryKey` | Unique id of the record and its Kafka key: `blockNumber * 1000000 + index of the fill among all fills of the block`. The same on every replay. |
| `blockNumber` | Hyperliquid block containing the liquidation. |
| `timestamp` | Block time, Unix milliseconds (UTC). |
| `hash` | Hash of the transaction that triggered the liquidation (for market liquidations usually the validators' oracle price update); shared by all fills of that transaction. |
| `tid` | Trade id, shared with the counterparty's fill of the same match. Not unique on its own. |
| `coin` | Market: `BTC`, `ETH`, ... for the main perp DEX; `<dex>:<asset>` (e.g. `xyz:TSLA`) for HIP-3 perps. |
| `user` | The liquidated account (lowercase). |
| `side` | `A`: the liquidated user sold, i.e. a **long** position was liquidated. `B`: bought, a **short** was liquidated. |
| `px` | Execution price. |
| `sz` | Size in units of `coin`; `px * sz` is the USD notional. |
| `startPosition` | Signed position size before this fill (negative = short). `abs(startPosition) == sz` means this fill closed the rest of the position. |
| `closedPnl` | Realized PnL of the closed part, in USDC (usually a loss). |
| `fee` | Fee the liquidated user paid on this fill, in USDC. |
| `markPx` | Mark price at liquidation. |
| `method` | `market`: closed against resting orders on the book. `backstop`: taken over by the backstop (HLP) vault. |

A crash between the Kafka commit and the position save re-sends the last batch, so deduplicate on `primaryKey`
(e.g. `ReplacingMergeTree`).

## Settings

| Variable | Default | |
|---|---|---|
| `HYPERLIQUID_GRPC_ENDPOINT` | | `host:port`, or the dashboard form `https://host/<api-key>` |
| `DWELLIR_API_KEY` | | Sent as `x-api-key`; taken from the endpoint path when unset |
| `HYPERLIQUID_COINS` | all | Comma separated, case sensitive (`BTC,ETH,xyz:TSLA`), filtered server side |
| `START_BLOCK` | live tail | First block when there is no saved position |
| `MAX_BLOCKS_PER_BATCH` | `2000` | Blocks per Kafka transaction |
| `MAX_BUFFERED_RECORDS` | `20000` | The stream is paused above this |
| `LOOP_INTERVAL_CURRENT_MODE_MSEC` | `500` | Sleep once the buffer is drained |
| `STREAM_IDLE_TIMEOUT_MSEC` | `60000` | Reopen a stream silent for that long; raise it for a few quiet coins |
| `STREAM_MAX_RECONNECTS` | `20` | Failed reconnects in a row before restarting |
| `GRPC_UNARY_TIMEOUT_MSEC` | `15000` | Startup `ListFeeds` check |

The proto contract `lib/hyperliquid_v3.proto` is a copy of https://www.dwellir.com/docs/hyperliquid/grpc/v3.proto.

## ClickHouse

A suggested target table; numeric strings are parsed on insert:

```sql
CREATE TABLE hyperliquid_liquidations
(
    dt              DateTime64(3),
    primary_key     UInt64,
    block_number    UInt64,
    hash            String,
    tid             UInt64,
    coin            LowCardinality(String),
    user            String,
    side            LowCardinality(String),
    px              Float64,
    sz              Float64,
    usd_amount      Float64,
    start_position  Float64,
    closed_pnl      Float64,
    fee             Float64,
    mark_px         Float64,
    method          LowCardinality(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(dt)
ORDER BY (coin, dt, primary_key);
```

with `dt = fromUnixTimestamp64Milli(timestamp)`, `primary_key = primaryKey` and `usd_amount = px * sz`.
