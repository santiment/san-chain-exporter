import xrpl from 'xrpl';

export interface XRPConnection {
  connection: xrpl.Client,
  queue: any,
  index: number
}
