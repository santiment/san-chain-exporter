import xrpl from 'xrpl';

export type XRPConnection = {
  connection: xrpl.Client,
  queue: any,
  index: number
}
