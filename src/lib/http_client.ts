import http from 'http';
import https from 'https';
import jayson, { HttpsClientOptions } from 'jayson/promise';
// The TCP session constructed by Node HTTP module would get closed after 5 seconds of inactivity by default.
// Extend this timeout to 30 to reduce the number of sessions constructed.
const TCP_SESSION_KEEP_ALIVE_MSEC = 30000;

export function constructRPCClient(nodeURL: string, extraOptions = {}): jayson.HttpClient | jayson.HttpsClient {
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
    return jayson.client.https(mergedOptions);
  } else {
    const agent = new http.Agent(agentOptions);
    mergedOptions.agent = agent;
    return jayson.client.http(mergedOptions);
  }
}

module.exports = {
  constructRPCClient
};
