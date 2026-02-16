import { BeaconHttpClient } from './lib/beacon_http_client';
import { BaseWorker } from '../../lib/worker_base';
import { logger } from '../../lib/logger';
import { BeaconBalance, GenesisResponse } from './beacon_types';

const BEACON_API = 'https://ethereum-beacon.santiment.net';
const SECONDS_PER_SLOT = 12;
const SECONDS_PER_DAY = 86400;
const MAX_KAFKA_MESSAGES = 140_000;

export class BeaconWorker extends BaseWorker {
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private readonly client: BeaconHttpClient;

  private genesisTime!: number;

  private lastBalances = new Map<string, number>();
  private lastBalanceTimestamp = new Map<string, number>();
  private indexToPubkey = new Map<string, string>();

  private balancesPreloaded = false;

  private currentDailySlot: number | null = null;
  private lastProcessedValidatorIndex: number | null = null;

  constructor(settings: any) {
    super(settings);
    this.client = new BeaconHttpClient(
      settings.BEACON_API || BEACON_API
    );
    this.LOOP_INTERVAL_CURRENT_MODE_SEC =
      settings.LOOP_INTERVAL_CURRENT_MODE_SEC ?? 30;
  }

  async init() {
    this.genesisTime = await this.getGenesisTime();
    logger.info(`[Beacon] Genesis time: ${this.genesisTime}`);
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

  private slotToTimestamp(slot: number): number {
    return this.genesisTime + slot * SECONDS_PER_SLOT;
  }

  private getLastUtcDaySlot(dayIndex: number): number {
    const utcDayEnd = dayIndex * SECONDS_PER_DAY + SECONDS_PER_DAY - 1;
    const slot = Math.floor(
      (utcDayEnd - this.genesisTime) / SECONDS_PER_SLOT
    );
    return slot - (slot % 32);
  }

  private async preloadLastBalances(slot: number): Promise<void> {
    logger.info(`[Beacon] Preloading balances at slot ${slot}`);

    const validatorsRes = await this.client.getValidators(slot);
    const balancesRes = await this.client.getValidatorBalances(slot);

    for (const v of validatorsRes.data) {
      this.indexToPubkey.set(v.index, v.validator.pubkey);
    }

    for (const b of balancesRes.data) {
      const pubkey = this.indexToPubkey.get(b.index);
      if (pubkey) {
        this.lastBalances.set(pubkey, Number(b.balance));
      }
    }
  }

  async processSlot(
    slot: number
  ): Promise<Array<{ index: number; pubkey: string; balance: number }>> {
    const validatorsRes = await this.client.getValidators(slot);
    const balancesRes = await this.client.getValidatorBalances(slot);

    for (const v of validatorsRes.data) {
      this.indexToPubkey.set(v.index, v.validator.pubkey);
    }

    return balancesRes.data
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((b) => {
        const pubkey = this.indexToPubkey.get(b.index);
        if (!pubkey) return null;
        return {
          index: Number(b.index),
          pubkey,
          balance: Number(b.balance),
        };
      })
      .filter(Boolean) as Array<{
      index: number;
      pubkey: string;
      balance: number;
    }>;
  }

  async work(): Promise<BeaconBalance[]> {
    let exportedDailySlot: number | null = null;

    if (!this.balancesPreloaded) {
      if (this.lastExportedBlock > 0) {
        await this.preloadLastBalances(this.lastExportedBlock);
      }
      this.balancesPreloaded = true;
    }

    const latestSlot = await this.client.getHeadSlot();
    this.lastConfirmedBlock = latestSlot;

    if (this.currentDailySlot === null) {
      const genesisUtcDayIndex = Math.floor(
        this.genesisTime / SECONDS_PER_DAY
      );

      const nextDayIndex =
        this.lastExportedBlock === 0
          ? genesisUtcDayIndex
          : Math.floor(
              this.slotToTimestamp(this.lastExportedBlock) /
                SECONDS_PER_DAY
            ) + 1;

      const slot = this.getLastUtcDaySlot(nextDayIndex);

      if (slot > latestSlot) {
        this.sleepTimeMsec =
          this.LOOP_INTERVAL_CURRENT_MODE_SEC * 1000;
        return [];
      }

      this.currentDailySlot = slot;
      this.lastProcessedValidatorIndex = null;
    }

    exportedDailySlot = this.currentDailySlot;

    const dailyTimestamp = this.slotToTimestamp(exportedDailySlot);
    const records = await this.processSlot(exportedDailySlot);

    const allBalances: BeaconBalance[] = [];
    let emitted = 0;

    for (const r of records) {
      if (
        this.lastProcessedValidatorIndex !== null &&
        r.index <= this.lastProcessedValidatorIndex
      ) {
        continue;
      }

      const prevBalance = this.lastBalances.get(r.pubkey) ?? 0;
      if (prevBalance === r.balance) continue;

      const oldTimestamp =
        this.lastBalanceTimestamp.get(r.pubkey) ?? null;

      allBalances.push({
        slot: exportedDailySlot,
        timestamp: dailyTimestamp,
        balance: r.balance,
        oldBalance: prevBalance,
        oldTimestamp,
        pubkey: r.pubkey,
      });

      this.lastBalances.set(r.pubkey, r.balance);
      this.lastBalanceTimestamp.set(r.pubkey, dailyTimestamp);

      this.lastProcessedValidatorIndex = r.index;
      emitted++;

      if (emitted >= MAX_KAFKA_MESSAGES) break;
    }

    if (
      this.lastProcessedValidatorIndex ===
      records.at(-1)?.index
    ) {
      this.lastExportedBlock = exportedDailySlot;
      this.currentDailySlot = null;
      this.lastProcessedValidatorIndex = null;
    }

    this.lastExportTime = Date.now();
    this.lastPrimaryKey += allBalances.length;

    logger.info(
      `[Beacon] UTC daily slot=${exportedDailySlot} emitted=${allBalances.length}`
    );

    return allBalances;
  }
}
