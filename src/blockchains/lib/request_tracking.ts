'use strict';

import { logger as defaultLogger } from '../../lib/logger';
import { HTTPClientInterface } from '../../types';
import { Web3Interface, Web3Wrapper } from '../eth/lib/web3_wrapper';

export type RequestRecorder = (count: number) => void;

export class TrackingHttpClient implements HTTPClientInterface {
  private client: HTTPClientInterface;
  private recordRequest: RequestRecorder;

  constructor(client: HTTPClientInterface, recordRequest: RequestRecorder) {
    this.client = client;
    this.recordRequest = recordRequest;
  }

  request(method: string, params: any[], id?: string | number): Promise<any> {
    this.recordRequest(1);
    return this.client.request(method, params, id);
  }

  requestBulk(requests: any[]): Promise<any> {
    const batchSize = Array.isArray(requests) ? requests.length : 1;
    this.recordRequest(batchSize);
    return this.client.requestBulk(requests);
  }

  generateRequest(method: string, params: any[]): any {
    return this.client.generateRequest(method, params);
  }
}

export function attachWeb3RequestTracker(web3Wrapper: Web3Interface, recordRequest: RequestRecorder,
  log = defaultLogger): Web3Interface {
  const candidate = web3Wrapper as Web3Wrapper;
  if (typeof candidate.getWeb3 !== 'function') {
    log.warn('Web3 wrapper does not expose getWeb3(); RPC requests from Web3 may not be tracked.');
    return web3Wrapper;
  }

  const web3 = candidate.getWeb3();
  if (!web3) {
    log.warn('Web3 instance is missing; RPC requests from Web3 may not be tracked.');
    return web3Wrapper;
  }

  const provider: any = (web3 as any).currentProvider || (web3 as any).provider;
  if (!provider || typeof provider !== 'object') {
    log.warn('Web3 provider is missing or invalid; RPC requests from Web3 may not be tracked.');
    return web3Wrapper;
  }

  patchProviderMethod(provider, 'request', recordRequest);
  patchProviderMethod(provider, 'send', recordRequest);
  patchProviderMethod(provider, 'sendAsync', recordRequest);

  return web3Wrapper;
}

function patchProviderMethod(
  provider: any,
  methodName: 'request' | 'send' | 'sendAsync',
  recordRequest: RequestRecorder
) {
  const current = provider[methodName];
  if (typeof current !== 'function' || current.__sanRequestTrackerPatched) {
    return;
  }

  const boundOriginal = current.bind(provider);
  const tracked: typeof current = function (payload: any, ...args: any[]) {
    const batchSize = Array.isArray(payload) ? payload.length : 1;
    recordRequest(batchSize);
    return boundOriginal(payload, ...args);
  };
  (tracked as any).__sanRequestTrackerPatched = true;
  provider[methodName] = tracked;
}
