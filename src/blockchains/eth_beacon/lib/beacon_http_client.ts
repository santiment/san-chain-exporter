export class BeaconHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async fetchJSON<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Beacon API error ${res.status}: ${path}`
      );
    }

    return res.json() as Promise<T>;
  }

  async getHeadSlot(): Promise<number> {
    const res = await this.fetchJSON<{
      data: {
        header: {
          message: {
            slot: string;
          };
        };
      };
    }>('/eth/v1/beacon/headers/head');

    return Number(res.data.header.message.slot);
  }

  async getValidatorBalances(slot: number | string) {
    return this.fetchJSON<{
      data: {
        index: string;
        balance: string;
      }[];
    }>(`/eth/v1/beacon/states/${slot}/validator_balances`);
  }
}
