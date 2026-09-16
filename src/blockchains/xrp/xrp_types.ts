import xrpl from 'xrpl';

export type XRPConnection = {
  connection: xrpl.Client,
  queue: any,
  index: number,
  /** Timestamp (ms) until which the request queue is paused because the endpoint rate limited us. */
  pausedUntil?: number
}
