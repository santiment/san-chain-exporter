export class ExporterPosition {
  blockNumber: number;
  primaryKey: number;

  constructor(blockNumber: number, primaryKey: number) {
    this.blockNumber = blockNumber;
    this.primaryKey = primaryKey;
  }
}

export interface HTTPRequest {
  method: string;
  params: Array<any>;
  id: string;
}

// This interface is modeled agains the jayson Client that we actually use
export interface HTTPClientInterface {
  request(method: string, params: any[], id?: string | number): Promise<any>;
  request(method: string, params: any[], id: string | number, shouldCall: boolean): HTTPRequest;
}