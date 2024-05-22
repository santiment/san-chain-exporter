export class ExporterPosition {
  blockNumber: number;
  primaryKey: number;

  constructor(blockNumber: number, primaryKey: number) {
    this.blockNumber = blockNumber;
    this.primaryKey = primaryKey;
  }
}

// This interface is modeled agains the jayson Client that we actually use
export interface HTTPClientInterface {
  request(method: string, params: any[], id?: string | number): Promise<any>;
  requestBulk(requests: any[]): Promise<any>;
  generateRequest(method: string, params: any[]): any;
}