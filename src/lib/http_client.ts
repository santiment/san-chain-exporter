import http from 'http';
import https from 'https';
import jayson, { HttpsClientOptions, JSONRPCRequest } from 'jayson/promise';
import { HTTPClientInterface } from '../types';

// The TCP session constructed by Node HTTP module would get closed after 5 seconds of inactivity by default.
// Extend this timeout to 30 to reduce the number of sessions constructed.
const TCP_SESSION_KEEP_ALIVE_MSEC = 30000;

class JaysonHTTPClient implements HTTPClientInterface {
  private client: jayson.HttpClient;
  constructor(_client: jayson.HttpClient) {
    this.client = _client;
  }

  request(method: string, params: any[], id?: string | number): Promise<any> {
    return this.client.request(method, params, id);
  }

  requestBulk(requests: any[]) {
    return this.client.request(requests);
  }

  generateRequest(method: string, params: any[]): JSONRPCRequest {
    return this.client.request(method, params, undefined, false);
  }
}

export function constructRPCClient(nodeURL: string, username: string, password: string, timeout: number): HTTPClientInterface {
  const nodeUrl = new URL(nodeURL);
  const authCredentials = username + ':' + password;

  const options: HttpsClientOptions = {
    hostname: nodeUrl.hostname,
    port: nodeUrl.port,
    path: nodeUrl.pathname,
    method: 'POST',
    auth: authCredentials,
    timeout: timeout,
    version: 2
  };

  const agentOptions = {
    keepAlive: true, // Enable keep-alive
    keepAliveMsecs: TCP_SESSION_KEEP_ALIVE_MSEC // Keep alive for 30 seconds
  };

  if (nodeURL.substring(0, 5) === 'https') {
    const agent = new https.Agent(agentOptions);
    options.agent = agent;
    return new JaysonHTTPClient(jayson.client.https(options));
  } else {
    const agent = new http.Agent(agentOptions);
    options.agent = agent;
    return new JaysonHTTPClient(jayson.client.http(options));
  }
}

