import { getIntEnvVariable } from '../../../lib/utils';

// Dwellir Hyperliquid gRPC endpoint. Either 'host:port' or the dashboard form 'https://host/<api-key>', in which
// case the path is used as the API key unless DWELLIR_API_KEY is set.
export const HYPERLIQUID_GRPC_ENDPOINT = process.env.HYPERLIQUID_GRPC_ENDPOINT || '';
export const DWELLIR_API_KEY = process.env.DWELLIR_API_KEY || '';
// Comma separated, case sensitive coin names (e.g. 'BTC,ETH,xyz:TSLA'). Empty exports all coins. Filtered server side.
export const HYPERLIQUID_COINS = process.env.HYPERLIQUID_COINS || '';
// Upper bound of blocks taken from the stream buffer per work() call, i.e. per Kafka transaction.
export const MAX_BLOCKS_PER_BATCH = getIntEnvVariable('MAX_BLOCKS_PER_BATCH', 2000);
// The stream is paused when this many records are buffered and not yet exported.
export const MAX_BUFFERED_RECORDS = getIntEnvVariable('MAX_BUFFERED_RECORDS', 20000);
// Sleep between work() calls once the buffer is drained. Blocks are produced every ~70-100 ms.
export const LOOP_INTERVAL_CURRENT_MODE_MSEC = getIntEnvVariable('LOOP_INTERVAL_CURRENT_MODE_MSEC', 500);
// Streams carry no heartbeat, but without a coin filter a record arrives for every block. Reopen a stream which has
// been silent for that long. Raise it when exporting a few quiet coins.
export const STREAM_IDLE_TIMEOUT_MSEC = getIntEnvVariable('STREAM_IDLE_TIMEOUT_MSEC', 60000);
// Consecutive failed stream (re)connects before the error is thrown and the exporter restarts.
export const STREAM_MAX_RECONNECTS = getIntEnvVariable('STREAM_MAX_RECONNECTS', 20);
export const GRPC_UNARY_TIMEOUT_MSEC = getIntEnvVariable('GRPC_UNARY_TIMEOUT_MSEC', 15000);
