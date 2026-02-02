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
    this.MAX_CONCURRENT_SLOTS = settings.MAX_CONCURRENT_SLOTS ?? 16;  
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

    const totalValidators = validatorsRes.data.length;

    for (const v of validatorsRes.data) {
      const existing = this.indexToPubkey.get(v.index);
      if (!existing) {
        this.indexToPubkey.set(v.index, v.validator.pubkey);
      }
    }

    const newBalances: BeaconBalance[] = [];

    for (const b of balancesRes.data) {
      const pubkey = this.indexToPubkey.get(b.index);
      if (!pubkey) continue;

      const previousBalance = this.lastBalances.get(pubkey) ?? 0;
      const currentBalnce = Number(b.balance);
      if (slot > 0 && previousBalance === currentBalnce) continue;

      const oldDt = this.lastBalanceDatetime.get(pubkey) ?? null;
      const dt = datetime;

      const record: BeaconBalance = {
        slot,
        dt,
        balance: currentBalnce,
        oldDt,
        oldBalance: previousBalance,
        pubkey,
      };

      newBalances.push(record);
      this.lastBalances.set(pubkey, currentBalnce);
      this.lastBalanceDatetime.set(pubkey, dt);
    }

    logger.info(
      `[Beacon] slot=${slot} validators=${totalValidators} inserted=${newBalances.length}`
    );

    return newBalances;
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
    const numSlots = Math.min( this.MAX_CONCURRENT_SLOTS, slotsAvailable ); 
    const slots = Array.from( 
      { length: numSlots },
      (_, i) => this.lastExportedBlock + 1 + i 
    ); 
    let allBalances: BeaconBalance[] = [];

    for (const slot of slots) { 
      if (slot % 16 !== 0) { 
        this.lastExportedBlock = slot; 
        continue; 
      } 
      const changedBalances = await this.processSlot(slot); 
      if (changedBalances.length > 0) { 
        allBalances.push(...changedBalances); 
      } 
      this.lastExportedBlock = slot; 
    }

    this.lastExportTime = Date.now();
    this.lastPrimaryKey += allBalances.length;

    return allBalances;
  }
}