export class BeaconHttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async fetchJSON<T>(path: string): Promise<T> {
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

  async getGenesisTime(): Promise<number> {
    const res = await this.fetchJSON<{
      data: { genesis_time: string };
    }>('/eth/v1/beacon/genesis');

    return Number(res.data.genesis_time);
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

  async getValidators(slot: number | string) {
    return this.fetchJSON<{
      data: {
        index: string;
        status: string;
        validator: {
          pubkey: string;
          withdrawal_credentials: string;
          effective_balance: string;
        };
      }[];
    }>(`/eth/v1/beacon/states/${slot}/validators`);
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
