import { BeaconHttpClient } from './lib/beacon_http_client';
import { BaseWorker } from '../../lib/worker_base';
import { logger } from '../../lib/logger';

const BEACON_API = 'https://ethereum-beacon.santiment.net';
const SECONDS_PER_SLOT = 12;
const SECONDS_PER_DAY = 86400;
const SLOTS_PER_DAY = SECONDS_PER_DAY / SECONDS_PER_SLOT; 
const MAX_KAFKA_MESSAGES = 140_000;


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
  private currentDailySlot: number | null = null;
  private lastProcessedValidatorIndex: number | null = null;

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

private getLastDailySlot(dayIndex: number): number {
  const dayEndSlot = (dayIndex + 1) * SLOTS_PER_DAY - 1;
  return dayEndSlot - (dayEndSlot % 32);
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

async processSlot(slot: number): Promise<Array<BeaconBalance & { index: number }>> {
    const datetime = this.slotToDatetime(slot);

    const validatorsRes = await this.client.getValidators(slot);
    const balancesRes = await this.client.getValidatorBalances(slot);

    for (const v of validatorsRes.data) {
      if (!this.indexToPubkey.has(v.index)) {
        this.indexToPubkey.set(v.index, v.validator.pubkey);
      }
    }

  return balancesRes.data
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((b) => {
      const pubkey = this.indexToPubkey.get(b.index);
      if (!pubkey) return null;

      return {
        index: Number(b.index), // ✅ FIX HERE
        slot,
        dt: datetime,
        balance: Number(b.balance),
        oldDt: null,
        oldBalance: null,
        pubkey,
      };
    })
    .filter(Boolean) as Array<BeaconBalance & { index: number }>;
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
    this.lastConfirmedBlock = latestSlot;

    if (this.currentDailySlot === null) {
      const nextDayIndex =
        Math.floor(this.lastExportedBlock / SLOTS_PER_DAY) + 1;

      const slot = this.getLastDailySlot(nextDayIndex);
      if (slot > latestSlot) {
        this.sleepTimeMsec = this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
        return [];
      }

      this.currentDailySlot = slot;
      this.lastProcessedValidatorIndex = null;
    }

    const records = await this.processSlot(this.currentDailySlot);

    const allBalances: BeaconBalance[] = [];
    let emitted = 0;

    for (const r of records) {
      if (
        this.lastProcessedValidatorIndex !== null &&
        Number(r.index) <= Number(this.lastProcessedValidatorIndex)
      ) {
        continue;
      }

      const prevBalance = this.lastBalances.get(r.pubkey) ?? 0;
      if (prevBalance === r.balance) continue;

      const oldDt = this.lastBalanceDatetime.get(r.pubkey) ?? null;

      allBalances.push({
        slot: r.slot,
        dt: r.dt,
        balance: r.balance,
        oldBalance: prevBalance,
        oldDt,
        pubkey: r.pubkey,
      });

      this.lastBalances.set(r.pubkey, r.balance);
      this.lastBalanceDatetime.set(r.pubkey, r.dt);

      this.lastProcessedValidatorIndex = r.index;
      emitted++;

      if (emitted >= MAX_KAFKA_MESSAGES) break;
    }

    if (this.lastProcessedValidatorIndex === records.at(-1)?.index) {
      this.lastExportedBlock = this.currentDailySlot;
      this.currentDailySlot = null;
      this.lastProcessedValidatorIndex = null;
    }

    this.lastExportTime = Date.now();
    this.lastPrimaryKey += allBalances.length;

    logger.info(
      `[Beacon] daily slot=${this.currentDailySlot} emitted=${allBalances.length}`
    );

    return allBalances;
  }
}