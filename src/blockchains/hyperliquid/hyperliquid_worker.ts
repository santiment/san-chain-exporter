'use strict';
import * as grpc from '@grpc/grpc-js';
import { logger } from '../../lib/logger';
import { BaseWorker } from '../../lib/worker_base';
import { createGatewayClient, parseEndpoint } from './lib/dwellir_client';
import { parseLiquidations } from './lib/fills';
import { FeedRecord, HyperliquidLiquidation } from './hyperliquid_types';

// Statuses after which the stream is reopened from the last exported block. Everything else (NOT_FOUND for a
// position outside the retained history, UNAUTHENTICATED, INVALID_ARGUMENT, ...) is thrown.
const RETRYABLE_STATUSES = new Set([
  grpc.status.UNAVAILABLE, grpc.status.DEADLINE_EXCEEDED, grpc.status.ABORTED, grpc.status.RESOURCE_EXHAUSTED,
  grpc.status.INTERNAL, grpc.status.UNKNOWN, grpc.status.CANCELLED,
]);

const MAX_RECONNECT_WAIT_MS = 30000;

/**
 * Exports Hyperliquid liquidations from the Dwellir gRPC raw feed HyperliquidL1Gateway/StreamFills (node_fills_by_block).
 *
 * The feed is a server stream positioned by block number: it replays from the requested block and then tails live
 * blocks. A single stream is kept open from lastExportedBlock + 1; records are buffered as they arrive and each
 * work() call drains the buffer, so the exported position always advances block by block and a restart or a
 * reconnect resumes exactly after the last block committed to Kafka.
 */
export class HyperliquidWorker extends BaseWorker {
  private client: any;
  private metadata: grpc.Metadata;
  private call: grpc.ClientReadableStream<FeedRecord> | null;
  private buffer: FeedRecord[];
  private streamError: grpc.ServiceError | null;
  private streamEnded: boolean;
  private lastRecordTime: number;
  private reconnects: number;
  private recordsSinceLastCount: number;
  private readonly coins: string[];

  constructor(settings: any) {
    super(settings);
    this.coins = settings.HYPERLIQUID_COINS.split(',').map((coin: string) => coin.trim()).filter((coin: string) => coin);
    this.metadata = new grpc.Metadata();
    this.call = null;
    this.buffer = [];
    this.streamError = null;
    this.streamEnded = false;
    this.lastRecordTime = Date.now();
    this.reconnects = 0;
    this.recordsSinceLastCount = 0;
  }

  async init() {
    const { address, apiKey } = parseEndpoint(this.settings.HYPERLIQUID_GRPC_ENDPOINT, this.settings.DWELLIR_API_KEY);
    this.metadata.set('x-api-key', apiKey);
    this.client = createGatewayClient(address);
    logger.info(`Using Dwellir Hyperliquid gRPC endpoint ${address}, coins: ${this.coins.length > 0 ? this.coins.join(',') : 'all'}`);
    await this.checkFillsFeed();
  }

  /** Fail fast on a wrong endpoint or key, and on an endpoint which cannot position the fills feed by block. */
  async checkFillsFeed() {
    const response: any = await new Promise((resolve, reject) => {
      this.client.ListFeeds({}, this.metadata, { deadline: Date.now() + this.settings.GRPC_UNARY_TIMEOUT_MSEC },
        (err: grpc.ServiceError | null, result: any) => err ? reject(err) : resolve(result));
    });
    const fills = (response.feeds || []).find((feed: any) => feed.id === 'fills');
    if (!fills) {
      throw new Error(`Endpoint has no 'fills' feed, available: ${(response.feeds || []).map((feed: any) => feed.id)}`);
    }
    if (!(fills.position_kinds || []).includes('POSITION_KIND_BLOCK_NUMBER')) {
      throw new Error(`The 'fills' feed cannot be positioned by block number: ${JSON.stringify(fills)}`);
    }
  }

  openStream() {
    const request: any = {};
    if (this.lastExportedBlock >= 0) {
      request.position = { block_number: this.lastExportedBlock + 1 };
    }
    if (this.coins.length > 0) {
      request.filter = { fields: [{ field: 'coins', op: 'FILTER_OP_IN', values: this.coins }] };
    }
    logger.info(`Opening fills stream from ${request.position ? `block ${request.position.block_number}` : 'the live tail'}`);

    this.buffer = [];
    this.streamError = null;
    this.streamEnded = false;
    this.lastRecordTime = Date.now();
    const call: grpc.ClientReadableStream<FeedRecord> = this.client.StreamFills(request, this.metadata);
    this.call = call;
    // Events of a replaced (cancelled) call are ignored.
    call.on('data', (record: FeedRecord) => {
      if (call !== this.call) return;
      this.buffer.push(record);
      this.lastRecordTime = Date.now();
      this.recordsSinceLastCount++;
      if (this.buffer.length >= this.settings.MAX_BUFFERED_RECORDS) {
        call.pause();
      }
    });
    call.on('error', (err: grpc.ServiceError) => {
      if (call === this.call) this.streamError = err;
    });
    call.on('end', () => {
      if (call === this.call) this.streamEnded = true;
    });
  }

  closeStream() {
    const call = this.call;
    this.call = null;
    this.buffer = [];
    if (call !== null) {
      call.cancel();
    }
  }

  /**
   * Reopen a failed, ended or silent stream from the block after the last exported one. Records buffered before the
   * failure are valid and are exported first.
   */
  async recoverStreamIfNeeded() {
    const silentMs = Date.now() - this.lastRecordTime;
    const idle = silentMs > this.settings.STREAM_IDLE_TIMEOUT_MSEC;
    if (this.buffer.length > 0 || (!this.streamError && !this.streamEnded && !idle)) {
      return;
    }
    const error = this.streamError;
    if (error !== null && !RETRYABLE_STATUSES.has(error.code)) {
      const hint = error.code === grpc.status.NOT_FOUND
        ? ` Block ${this.lastExportedBlock + 1} is outside the endpoint's retained history.` : '';
      throw new Error(`Hyperliquid fills stream failed: ${grpc.status[error.code]} ${error.details}.${hint}`);
    }
    this.reconnects++;
    if (this.reconnects > this.settings.STREAM_MAX_RECONNECTS) {
      throw new Error(`Hyperliquid fills stream could not be recovered after ${this.reconnects - 1} reconnects`);
    }
    const reason = error !== null ? `${grpc.status[error.code]} ${error.details}`
      : (this.streamEnded ? 'stream ended' : `no record for ${silentMs} ms`);
    const waitMs = Math.min(1000 * 2 ** (this.reconnects - 1), MAX_RECONNECT_WAIT_MS);
    logger.warn(`Hyperliquid fills stream interrupted (${reason}), reopening in ${waitMs} ms ` +
      `(attempt ${this.reconnects}/${this.settings.STREAM_MAX_RECONNECTS})`);
    this.closeStream();
    await this.sleep(waitMs);
    this.openStream();
  }

  async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async work(): Promise<HyperliquidLiquidation[]> {
    if (this.call === null) {
      this.openStream();
    }
    await this.recoverStreamIfNeeded();

    const records = this.buffer.splice(0, this.settings.MAX_BLOCKS_PER_BATCH);
    if (this.call !== null && this.call.isPaused() && this.buffer.length < this.settings.MAX_BUFFERED_RECORDS / 2) {
      this.call.resume();
    }

    const events: HyperliquidLiquidation[] = [];
    for (const record of records) {
      const block = parseLiquidations(record.data, record.block_number, record.timestamp);
      // Positioned streams replay the requested block inclusively; never export a block twice.
      if (block.blockNumber <= this.lastExportedBlock) {
        continue;
      }
      for (const event of block.liquidations) {
        events.push(event);
        this.lastPrimaryKey = event.primaryKey;
      }
      this.lastExportedBlock = block.blockNumber;
    }
    if (records.length > 0) {
      this.reconnects = 0;
    }

    const lastBuffered = this.buffer.length > 0 ? this.buffer[this.buffer.length - 1].block_number : undefined;
    this.lastConfirmedBlock = Math.max(this.lastConfirmedBlock, lastBuffered ?? this.lastExportedBlock);
    this.sleepTimeMsec = this.buffer.length > 0 ? 0 : this.settings.LOOP_INTERVAL_CURRENT_MODE_MSEC;
    if (records.length > 0) {
      logger.info(`Exported blocks up to ${this.lastExportedBlock}: ${records.length} records, ${events.length} liquidations, ` +
        `${this.buffer.length} records buffered`);
    }
    return events;
  }

  /** Streamed records since the last call. Dwellir bills one API credit per streamed record. */
  getNewRequestsCount(): number {
    const count = this.recordsSinceLastCount;
    this.recordsSinceLastCount = 0;
    return count;
  }

  async stop() {
    this.closeStream();
    if (this.client) {
      this.client.close();
    }
  }
}
