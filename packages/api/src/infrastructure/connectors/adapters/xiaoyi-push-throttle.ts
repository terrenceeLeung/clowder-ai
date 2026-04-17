/**
 * XiaoYi Push Throttle — FIFO rate-limited queue for Push delivery.
 *
 * Enforces minimum 15s interval between Push API calls (HAG rate limit).
 * Failure: no retry. This throttle is only used for async/no-task outbound;
 * active conversation replies bypass Push and use WS artifact-update.
 *
 * F151 Phase D
 */

import type { FastifyBaseLogger } from 'fastify';
import type { PushResult, XiaoyiPushService } from './xiaoyi-push.js';
import type { XiaoyiPushIdManager } from './xiaoyi-pushid.js';

export const DEFAULT_PUSH_MIN_INTERVAL_MS = 15_000;

export interface PushJob {
  text: string;
  resolve: (result: PushDeliveryResult) => void;
}

export interface PushDeliveryResult {
  ok: boolean;
  pushCount: number;
  failCount: number;
}

export class XiaoyiPushThrottle {
  private readonly log: FastifyBaseLogger;
  private readonly pushService: XiaoyiPushService;
  private readonly pushIdManager: XiaoyiPushIdManager;
  private readonly minIntervalMs: number;
  private readonly queue: PushJob[] = [];
  private lastSendTime = 0;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    log: FastifyBaseLogger,
    pushService: XiaoyiPushService,
    pushIdManager: XiaoyiPushIdManager,
    minIntervalMs?: number,
  ) {
    this.log = log;
    this.pushService = pushService;
    this.pushIdManager = pushIdManager;
    this.minIntervalMs = minIntervalMs ?? DEFAULT_PUSH_MIN_INTERVAL_MS;
  }

  enqueue(text: string): Promise<PushDeliveryResult> {
    return new Promise<PushDeliveryResult>((resolve) => {
      this.queue.push({ text, resolve });
      this.scheduleDrain();
    });
  }

  private scheduleDrain(): void {
    if (this.drainTimer) return;
    const elapsed = Date.now() - this.lastSendTime;
    const delay = Math.max(0, this.minIntervalMs - elapsed);
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.drainNext();
    }, delay);
  }

  private async drainNext(): Promise<void> {
    const job = this.queue.shift();
    if (!job) return;

    const pushIds = await this.pushIdManager.getAllPushIds();
    if (pushIds.length === 0) {
      this.log.warn('[XiaoYi:Throttle] No pushIds available, delivery failed');
      job.resolve({ ok: false, pushCount: 0, failCount: 0 });
      this.drainRemaining();
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const pushId of pushIds) {
      try {
        const result = await this.pushService.sendPush(pushId, job.text);
        if (result.ok) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
        this.log.error({ err, pushId: pushId.slice(0, 20) }, '[XiaoYi:Throttle] Push failed');
      }
    }

    this.lastSendTime = Date.now();
    job.resolve({ ok: successCount > 0, pushCount: successCount, failCount });
    this.drainRemaining();
  }

  private drainRemaining(): void {
    if (this.queue.length > 0) {
      this.scheduleDrain();
    }
  }

  /** Pending job count (for status reporting) */
  get pendingCount(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
    for (const job of this.queue) {
      job.resolve({ ok: false, pushCount: 0, failCount: 0 });
    }
    this.queue.length = 0;
  }
}
