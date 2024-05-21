export class ExporterPosition {
  blockNumber: number;
  primaryKey: number;

  constructor(blockNumber: number, primaryKey: number) {
    this.blockNumber = blockNumber;
    this.primaryKey = primaryKey;
  }
}