import { BeaconHttpClient } from './lib/beacon_http_client';
import { BaseWorker } from '../../lib/worker_base';
import { logger } from '../../lib/logger';
import { BeaconBalance } from './beacon_types';

const SECONDS_PER_SLOT = 12;
const SECONDS_PER_DAY = 86400;
const MAX_KAFKA_MESSAGES = 140_000;

type BalanceState = {
  balance: number;
  timestamp: number;
};

export class BeaconWorker extends BaseWorker {
  private readonly LOOP_INTERVAL_CURRENT_MODE_SEC: number;
  private readonly client: BeaconHttpClient;

  private genesisTime!: number;

  private lastState = new Map<number, BalanceState>();

  private balancesPreloaded = false;
  private currentDailySlot: number | null = null;

  private pendingBatches: BeaconBalance[][] = [];

  private processingDailySlot: number | null = null;
  private processingChangesCount = 0;

  private beaconAPI;

  constructor(settings: any) {
    super(settings);
    this.client = new BeaconHttpClient(settings.BEACON_API);
    this.beaconAPI = settings.BEACON_API;
    this.LOOP_INTERVAL_CURRENT_MODE_SEC =
      settings.LOOP_INTERVAL_CURRENT_MODE_SEC ?? 30;
  }

  async init() {
    this.genesisTime = await this.getGenesisTime();
    logger.info(`[Beacon] Genesis time: ${this.genesisTime}`);
    this.lastConfirmedBlock = await this.getLatestSlot();
  }

  private async getGenesisTime(): Promise<number> {
    const genesis = await this.client.fetchJSON<any>(
      `${this.beaconAPI}/eth/v1/beacon/genesis`
    );
    return Number(genesis.data.genesis_time);
  }

  private async getLatestSlot(): Promise<number> {
    const head = await this.client.fetchJSON<any>(
      `${this.beaconAPI}/eth/v1/beacon/headers/head`
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

    const balancesRes = await this.client.getValidatorBalances(slot);
    const ts = this.slotToTimestamp(slot);

    for (const b of balancesRes.data) {
      const index = Number(b.index);
      const balance = Number(b.balance);

      if (balance > 0) {
        this.lastState.set(index, {
          balance,
          timestamp: ts,
        });
      }
    }
  }

  async work(): Promise<BeaconBalance[]> {
    if (this.pendingBatches.length > 0) {
      const batch = this.pendingBatches.shift()!;

      if (
        this.pendingBatches.length === 0 &&
        this.processingDailySlot !== null
      ) {
        this.lastExportedBlock = this.processingDailySlot;
        this.lastPrimaryKey += this.processingChangesCount;
        this.lastExportTime = Date.now();

        logger.info(
          `[Beacon] Completed daily slot=${this.processingDailySlot}`
        );

        this.processingDailySlot = null;
        this.processingChangesCount = 0;
        this.currentDailySlot = null;
      }

      return batch;
    }

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
    }

    const dailySlot = this.currentDailySlot;
    const dailyTimestamp = this.slotToTimestamp(dailySlot);

    const balancesRes =
      await this.client.getValidatorBalances(dailySlot);

    const dayChanges: BeaconBalance[] = [];

    for (const b of balancesRes.data) {
      const index = Number(b.index);
      const balance = Number(b.balance);

      const prev = this.lastState.get(index);

      if ((prev && prev.balance === balance) || (!prev && balance === 0)) {
        continue;
      }

      dayChanges.push({
        slot: dailySlot,
        timestamp: dailyTimestamp,
        balance,
        oldBalance: prev?.balance ?? 0,
        oldTimestamp: prev?.timestamp ?? null,
        validatorIndex: index,
      });

      if (balance === 0) {
        this.lastState.delete(index);
      } else {
        this.lastState.set(index, {
          balance,
          timestamp: dailyTimestamp,
        });
      }
    }

    for (let i = 0; i < dayChanges.length; i += MAX_KAFKA_MESSAGES) {
      this.pendingBatches.push(
        dayChanges.slice(i, i + MAX_KAFKA_MESSAGES)
      );
    }

    this.processingDailySlot = dailySlot;
    this.processingChangesCount = dayChanges.length;

    logger.info(
      `[Beacon] UTC daily slot=${dailySlot} total_changes=${dayChanges.length} batches=${this.pendingBatches.length}`
    );

    return this.pendingBatches.shift() ?? [];
  }
}