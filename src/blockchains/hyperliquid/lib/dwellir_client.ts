import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Copied from https://www.dwellir.com/docs/hyperliquid/grpc/v3.proto
const PROTO_PATH = path.join(__dirname, 'hyperliquid_v3.proto');

/**
 * Accept both 'host:port' and the Dwellir dashboard form 'https://host/<api-key>'. gRPC needs 'host:port' and takes
 * the key as 'x-api-key' metadata; an explicitly configured key wins over the one in the URL.
 */
export function parseEndpoint(endpoint: string, apiKey: string): { address: string, apiKey: string } {
  let rest = endpoint.trim();
  const schemeEnd = rest.indexOf('://');
  if (schemeEnd !== -1) {
    rest = rest.slice(schemeEnd + 3);
  }
  const slash = rest.indexOf('/');
  const host = slash === -1 ? rest : rest.slice(0, slash);
  const keyFromPath = slash === -1 ? '' : rest.slice(slash + 1).split('/')[0];
  if (host === '') {
    throw new Error('HYPERLIQUID_GRPC_ENDPOINT needs to be set');
  }
  const key = apiKey || keyFromPath;
  if (key === '') {
    throw new Error('Dwellir API key missing: set DWELLIR_API_KEY or use the https://host/<api-key> endpoint form');
  }
  return { address: host.includes(':') ? host : `${host}:443`, apiKey: key };
}

export function createGatewayClient(address: string): any {
  const definition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,   // block numbers and Unix ms timestamps are far below 2^53
    enums: String,
    defaults: false,
    oneofs: true,
  });
  const proto: any = grpc.loadPackageDefinition(definition);
  return new proto.hyperliquid_l1_gateway.v3.HyperliquidL1Gateway(address, grpc.credentials.createSsl(), {
    'grpc.max_receive_message_length': 256 * 1024 * 1024,
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
    'grpc.keepalive_permit_without_calls': 1,
  });
}
