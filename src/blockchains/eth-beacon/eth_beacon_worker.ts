import { BeaconHttpClient } from './lib/beacon_http_client';
import { BaseWorker } from '../../lib/worker_base';
import { logger } from '../../lib/logger';

const BEACON_API = 'https://ethereum-beacon.santiment.net';
const SECONDS_PER_SLOT = 12;

type GenesisResponse = {
  data: {
    genesis_time: string;
  };
};

export type BeaconBalance = {
  slot: number;
  dt: string;
  balance: number;
  oldDt: string | null;
  oldBalance: number | null;
  pubkey: string;
};

export class BeaconWorker extends BaseWorker {
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private readonly client: BeaconHttpClient;

  private genesisTime!: number;
  private lastBalances = new Map<string, number>();
  private indexToPubkey = new Map<string, string>();
  private lastBalanceDatetime = new Map<string, string>();
  private balancesPreloaded = false;

  private readonly MAX_CONCURRENT_SLOTS: number;

  constructor(settings: any) {
    super(settings);
    this.client = new BeaconHttpClient(
      settings.BEACON_API || 'https://ethereum-beacon.santiment.net'
    );
    this.LOOP_INTERVAL_CURRENT_MODE_SEC =
      settings.LOOP_INTERVAL_CURRENT_MODE_SEC ?? 30;
    this.MAX_CONCURRENT_SLOTS = settings.MAX_CONCURRENT_SLOTS ?? 8;  
  }

  private async preloadLastBalances(slot: number): Promise<void> {
    logger.info(`[Beacon] Preloading balances at slot ${slot}`);

    const validatorsRes = await this.client.getValidators(slot);
    const balancesRes = await this.client.getValidatorBalances(slot);

    for (const v of validatorsRes.data) {
      if (!this.indexToPubkey.has(v.index)) {
        this.indexToPubkey.set(v.index, v.validator.pubkey);
      }
    }

    let count = 0;
    for (const b of balancesRes.data) {
      const pubkey = this.indexToPubkey.get(b.index);
      if (!pubkey) continue;

      this.lastBalances.set(pubkey, Number(b.balance));
      count++;
    }

    logger.info(
      `[Beacon] Preloaded ${count} validator balances from slot ${slot}`
    );
  }


  async init() {
    this.genesisTime = await this.getGenesisTime();
    logger.info(`Beacon genesis time: ${this.genesisTime}`);

    this.lastConfirmedBlock = await this.getLatestSlot();
  }

  private async fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${url}`);
    }

    return res.json() as Promise<T>;
  }

  private withdrawalCredentialsToAddress(
    creds: string
  ): string | null {
    if (!creds.startsWith('0x01')) return null;
    return '0x' + creds.slice(-40);
  }

  private async getGenesisTime(): Promise<number> {
    const genesis = await this.fetchJSON<GenesisResponse>(
      `${BEACON_API}/eth/v1/beacon/genesis`
    );
    return Number(genesis.data.genesis_time);
  }

  private async getLatestSlot(): Promise<number> {
    const head = await this.fetchJSON<any>(
      `${BEACON_API}/eth/v1/beacon/headers/head`
    );
    return Number(head.data.header.message.slot);
  }

  private slotToDatetime(slot: number): string {
    const ts =
      this.genesisTime + slot * SECONDS_PER_SLOT;
    return new Date(ts * 1000).toISOString();
  }

  async processSlot(slot: number): Promise<BeaconBalance[]> {
    const datetime = this.slotToDatetime(slot);

    const validatorsRes = await this.client.getValidators(slot);
    const balancesRes = await this.client.getValidatorBalances(slot);

    for (const v of validatorsRes.data) {
      if (!this.indexToPubkey.has(v.index)) {
        this.indexToPubkey.set(v.index, v.validator.pubkey);
      }
    }

    const records: BeaconBalance[] = [];

    for (const b of balancesRes.data) {
      const pubkey = this.indexToPubkey.get(b.index);
      if (!pubkey) continue;

      records.push({
        slot,
        dt: datetime,
        balance: Number(b.balance),
        oldDt: null,
        oldBalance: null,
        pubkey,
      });
    }

    logger.info(
      `[Beacon] slot=${slot} fetched=${records.length}`
    );

    return records;
  }


  async work(): Promise<BeaconBalance[]> {
    if (!this.balancesPreloaded) {
      const preloadSlot = this.lastExportedBlock;
      if (preloadSlot > 0) {
        await this.preloadLastBalances(preloadSlot);
      }
      this.balancesPreloaded = true;
    }

    const latestSlot = await this.client.getHeadSlot();

    if (latestSlot === this.lastConfirmedBlock) {
      this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
      return [];
    }

    this.sleepTimeMsec = 0;
    this.lastConfirmedBlock = latestSlot;

    const slotsAvailable = this.lastConfirmedBlock - this.lastExportedBlock;
    if (slotsAvailable <= 0) return [];

    const slotsToProcess: number[] = [];

    let slot = this.lastExportedBlock + (16 - (this.lastExportedBlock % 16 || 16));

    while (slot <= this.lastConfirmedBlock && slotsToProcess.length < this.MAX_CONCURRENT_SLOTS) {
      slotsToProcess.push(slot);
      slot += 16;
    }

    const slotResults = await Promise.all(
      slotsToProcess.map((slot) => this.processSlot(slot))
    );

    const allRecords: BeaconBalance[] = slotResults.flat();
    allRecords.sort((a, b) => a.slot - b.slot);

    const allBalances: BeaconBalance[] = [];

    for (const r of allRecords) {
      const prevBalance = this.lastBalances.get(r.pubkey) ?? 0;
      if (prevBalance === r.balance) continue;

      const oldDt = this.lastBalanceDatetime.get(r.pubkey) ?? null;

      allBalances.push({
        ...r,
        oldBalance: prevBalance,
        oldDt,
      });

      this.lastBalances.set(r.pubkey, r.balance);
      this.lastBalanceDatetime.set(r.pubkey, r.dt);
    }

    this.lastExportedBlock = slotsToProcess.at(-1)!;
    this.lastExportTime = Date.now();
    this.lastPrimaryKey += allBalances.length;

    logger.info(
      `[Beacon] slots=${slotsToProcess.join(',')} changes=${allBalances.length}`
    );

    return allBalances;
  }
}