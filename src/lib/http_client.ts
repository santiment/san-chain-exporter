import http from 'http';
import https from 'https';
import jayson, { HttpsClientOptions } from 'jayson/promise';
import { HTTPClientInterface, HTTPRequest } from '../types';

// The TCP session constructed by Node HTTP module would get closed after 5 seconds of inactivity by default.
// Extend this timeout to 30 to reduce the number of sessions constructed.
const TCP_SESSION_KEEP_ALIVE_MSEC = 30000;

interface ExtraOptions {
  auth?: string,
  method?: string,
  timeout?: number,
  version?: number
}

class JaysonHTTPClient implements HTTPClientInterface {
  private client: jayson.HttpClient;
  constructor(_client: jayson.HttpClient) {
    this.client = _client;
  }
  request(method: string, params: any[], id?: string | number): Promise<any> {
    return this.client.request(method, params, id)
  }

  generateRequest(method: string, params: any[], id: string | number): HTTPRequest {
    return {
      method: "test",
      params: [],
      id: ""
    }
    //return this.client.request(method, params, id, shouldCall)
  }
}

export function constructRPCClient(nodeURL: string, extraOptions: ExtraOptions = {}): HTTPClientInterface {
  const nodeUrl = new URL(nodeURL);

  const mergedOptions: HttpsClientOptions = {
    hostname: nodeUrl.hostname,
    port: nodeUrl.port,
    path: nodeUrl.pathname,
    ...extraOptions
  };

  const agentOptions = {
    keepAlive: true, // Enable keep-alive
    keepAliveMsecs: TCP_SESSION_KEEP_ALIVE_MSEC // Keep alive for 30 seconds
  };

  if (nodeURL.substring(0, 5) === 'https') {
    const agent = new https.Agent(agentOptions);
    mergedOptions.agent = agent;
    return new JaysonHTTPClient(jayson.client.https(mergedOptions));
  } else {
    const agent = new http.Agent(agentOptions);
    mergedOptions.agent = agent;
    return new JaysonHTTPClient(jayson.client.http(mergedOptions));
  }
}

module.exports = {
  constructRPCClient
};
