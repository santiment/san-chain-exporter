import xrpl from 'xrpl';

export interface XRPConnection {
  connection: xrpl.Client,
  queue: any,
  index: number
}

export interface XRPParams {
  command: string,
  ledger_index: string,
  transactions: boolean,
  expand: boolean
}