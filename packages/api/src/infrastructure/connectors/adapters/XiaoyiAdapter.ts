/**
 * XiaoYi (小艺) Connector Adapter — OpenClaw A2A over dual-WS + Push.
 *
 * Phase D: text replies delivered via Push HTTP API (independent per-cat messages).
 * WS handles: inbound, thinking bubble, keepalive, task close frame.
 * WS fallback: if Push fails and active task exists, single artifact delivery.
 * Task closure via close frame driven by onDeliveryBatchDone signal (D11).
 *
 * F151 | ADR-014
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import type { FastifyBaseLogger } from 'fastify';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';
import {
  type A2AInbound,
  agentResponse,
  artifactUpdate,
  DEDUP_TTL_MS,
  extractFileParts,
  generateXiaoyiSignature,
  STATUS_KEEPALIVE_MS,
  statusUpdate,
  TASK_TIMEOUT_MS,
  type TaskRecord,
  type XiaoyiAdapterOptions,
  type XiaoyiAttachment,
  type XiaoyiInboundMessage,
} from './xiaoyi-protocol.js';
import { type XiaoyiPushConfig, XiaoyiPushService } from './xiaoyi-push.js';
import { XiaoyiPushThrottle } from './xiaoyi-push-throttle.js';
import { XiaoyiPushIdManager } from './xiaoyi-pushid.js';
import { XiaoyiWsManager } from './xiaoyi-ws.js';

export type { XiaoyiAdapterOptions, XiaoyiInboundMessage };
export { generateXiaoyiSignature };

export interface XiaoyiAdapterDeps {
  redis?: RedisClient;
  pushMinIntervalMs?: number;
}

export class XiaoyiAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'xiaoyi' as const;
  private readonly log: FastifyBaseLogger;
  private readonly opts: XiaoyiAdapterOptions;
  private readonly ws: XiaoyiWsManager;
  private readonly pushService: XiaoyiPushService | null;
  readonly pushIdManager: XiaoyiPushIdManager;
  private readonly pushThrottle: XiaoyiPushThrottle | null;
  private readonly taskQueue = new Map<string, TaskRecord[]>();
  private readonly dedup = new Map<string, number>();
  private readonly keepaliveTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly taskTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingDispatch = new Map<string, XiaoyiInboundMessage>();
  /** Track whether a Push was delivered for this task (for close frame state) */
  private readonly hasPushDelivery = new Set<string>();

  constructor(log: FastifyBaseLogger, opts: XiaoyiAdapterOptions, deps?: XiaoyiAdapterDeps) {
    this.log = log;
    this.opts = opts;
    this.ws = new XiaoyiWsManager(log, opts);
    this.pushIdManager = new XiaoyiPushIdManager(log, opts.agentId, deps?.redis);

    if (opts.apiId) {
      const pushConfig: XiaoyiPushConfig = {
        ak: opts.ak,
        sk: opts.sk,
        apiId: opts.apiId,
        agentId: opts.agentId,
      };
      this.pushService = new XiaoyiPushService(log, pushConfig);
      this.pushThrottle = new XiaoyiPushThrottle(log, this.pushService, this.pushIdManager, deps?.pushMinIntervalMs);
    } else {
      this.pushService = null;
      this.pushThrottle = null;
      log.warn('[XiaoYi] No apiId configured — Push disabled, WS-only mode');
    }
  }

  // ── Lifecycle ──

  async startStream(onMessage: (msg: XiaoyiInboundMessage) => Promise<void>): Promise<void> {
    this.onMsg = onMessage;
    this.ws.start((raw, source) => this.handleInbound(raw, source));
  }

  async stopStream(): Promise<void> {
    this.onMsg = null;
    this.ws.stop();
    this.pushThrottle?.destroy();
    for (const t of this.taskTimeouts.values()) clearTimeout(t);
    this.taskTimeouts.clear();
    for (const t of this.keepaliveTimers.values()) clearInterval(t);
    this.keepaliveTimers.clear();
    this.taskQueue.clear();
    this.dedup.clear();
    this.pendingDispatch.clear();
    this.hasPushDelivery.clear();
  }

  private onMsg: ((msg: XiaoyiInboundMessage) => Promise<void>) | null = null;

  // ── Helpers ──

  private taskKey(sessionId: string, taskId: string): string {
    return `${sessionId}:${taskId}`;
  }

  // ── IStreamableOutboundAdapter ──

  async sendReply(externalChatId: string, content: string): Promise<void> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.currentTask(sessionId);

    // Push delivery — works with or without active WS task
    if (this.pushThrottle) {
      const result = await this.pushThrottle.enqueue(content);
      if (result.ok) {
        if (rec) this.hasPushDelivery.add(this.taskKey(sessionId, rec.taskId));
        return;
      }
      this.log.warn({ sessionId }, '[XiaoYi] Push failed, attempting WS fallback');
    }

    // WS fallback — only possible with active task
    if (!rec) {
      this.log.error({ sessionId }, '[XiaoYi] Push failed and no active WS task — delivery_failed');
      return;
    }
    const artId = `${rec.taskId}:fallback`;
    const art = artifactUpdate(rec.taskId, artId, content, { append: false, lastChunk: true });
    this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, art));
    this.hasPushDelivery.add(this.taskKey(sessionId, rec.taskId));
  }

  async onDeliveryBatchDone(externalChatId: string, chainDone: boolean): Promise<void> {
    if (!chainDone) return;
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.currentTask(sessionId);
    if (!rec) return;
    const tk = this.taskKey(sessionId, rec.taskId);
    this.cancelTaskTimeout(sessionId, rec.taskId);
    this.clearKeepalive(sessionId, rec.taskId);
    this.pendingDispatch.delete(tk);
    const state = this.hasPushDelivery.has(tk) ? 'completed' : 'failed';
    const close = statusUpdate(rec.taskId, state);
    this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, close));
    this.dequeueTask(sessionId, rec.taskId);
  }

  async sendPlaceholder(externalChatId: string, _text: string): Promise<string> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.currentTask(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendPlaceholder');
      return '';
    }
    const st = statusUpdate(rec.taskId, 'working');
    this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, st));
    const thinkId = `${rec.taskId}:think`;
    const thinking = artifactUpdate(rec.taskId, thinkId, '', {
      append: false,
      lastChunk: true,
      partKind: 'reasoningText',
    });
    this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, thinking));
    this.startKeepalive(rec.taskId, sessionId, rec);
    return '';
  }

  async editMessage(): Promise<void> {}

  async deleteMessage(): Promise<void> {}

  // ── Inbound ──

  private handleInbound(raw: string, source: string): void {
    let msg: A2AInbound;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const inboundAgentId = msg.agentId ?? msg.params?.agentId;
    if (inboundAgentId && inboundAgentId !== this.opts.agentId) return;
    if (msg.method === 'message/stream' && msg.params) {
      try {
        this.handleMessageStream(msg, source);
      } catch (err) {
        this.log.error({ err, source }, '[XiaoYi] handleMessageStream failed — message dropped');
      }
    } else if (msg.method === 'tasks/cancel' || msg.method === 'clearContext') {
      const sid = msg.params?.sessionId ?? msg.sessionId;
      if (sid) this.purgeSession(sid);
    } else if ((msg as Record<string, unknown>).error) {
      this.log.warn({ error: (msg as Record<string, unknown>).error, source }, '[XiaoYi] HAG JSON-RPC error');
    }
  }

  private handleMessageStream(msg: A2AInbound, source: string): void {
    const taskId = msg.params?.id;
    const sessionId = msg.params?.sessionId;
    if (!taskId || !sessionId) return;
    const key = `${sessionId}:${taskId}`;
    if (this.dedup.has(key)) return;
    this.dedup.set(key, Date.now());
    this.gcDedup();

    const parts = msg.params?.message?.parts ?? [];
    const text = parts
      .filter((p): p is { kind: string; text: string } => p.kind === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');

    const fileParts = extractFileParts(parts);
    const attachments: XiaoyiAttachment[] = fileParts.map((fp) => ({
      type: fp.mimeType.startsWith('image/')
        ? ('image' as const)
        : fp.mimeType.startsWith('audio/')
          ? ('audio' as const)
          : ('file' as const),
      xiaoyiUri: fp.uri,
      fileName: fp.name,
      mimeType: fp.mimeType,
    }));

    if (!text && attachments.length === 0) return;

    // Extract pushId from inbound message (Phase D)
    const pushId = this.pushIdManager.extractPushId(msg.params as Record<string, unknown>);
    if (pushId) {
      this.pushIdManager.addPushId(pushId).catch((err: unknown) => {
        this.log.error({ err }, '[XiaoYi] Failed to persist pushId');
      });
    }

    const rec: TaskRecord = { taskId, source };
    const queue = this.taskQueue.get(sessionId) ?? [];
    queue.push(rec);
    this.taskQueue.set(sessionId, queue);
    this.startTaskTimeout(taskId, sessionId, rec);
    const chatId = `${this.opts.agentId}:${sessionId}`;
    const senderId = `owner:${this.opts.agentId}`;
    const payload: XiaoyiInboundMessage = {
      chatId,
      text: text || (attachments.length > 0 ? `[${attachments.map((a) => a.fileName ?? a.type).join(', ')}]` : ''),
      messageId: taskId,
      taskId,
      senderId,
      ...(attachments.length > 0 ? { attachments } : {}),
    };

    if (queue.length > 1) {
      const st = statusUpdate(taskId, 'working');
      this.ws.send(source, agentResponse(this.opts.agentId, sessionId, taskId, st));
      this.startKeepalive(taskId, sessionId, rec);
      this.pendingDispatch.set(this.taskKey(sessionId, taskId), payload);
      return;
    }
    this.onMsg?.(payload).catch((err: unknown) => this.log.error({ err, taskId }, '[XiaoYi] Callback failed'));
  }

  // ── Task Timeout (safety net) ──

  private startTaskTimeout(taskId: string, sessionId: string, rec: TaskRecord): void {
    const tk = this.taskKey(sessionId, taskId);
    this.cancelTaskTimeout(sessionId, taskId);
    this.taskTimeouts.set(
      tk,
      setTimeout(() => {
        this.taskTimeouts.delete(tk);
        this.clearKeepalive(sessionId, taskId);
        this.pendingDispatch.delete(tk);
        const state = this.hasPushDelivery.has(tk) ? 'completed' : 'failed';
        const close = statusUpdate(rec.taskId, state);
        this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, close));
        this.dequeueTask(sessionId, taskId);
        this.log.warn({ sessionId, taskId }, '[XiaoYi] Task timeout — force closed');
      }, TASK_TIMEOUT_MS),
    );
  }

  private cancelTaskTimeout(sessionId: string, taskId: string): void {
    const tk = this.taskKey(sessionId, taskId);
    const t = this.taskTimeouts.get(tk);
    if (t) {
      clearTimeout(t);
      this.taskTimeouts.delete(tk);
    }
  }

  // ── Keepalive ──

  private startKeepalive(taskId: string, sessionId: string, rec: TaskRecord): void {
    const tk = this.taskKey(sessionId, taskId);
    if (this.keepaliveTimers.has(tk)) return;
    this.keepaliveTimers.set(
      tk,
      setInterval(() => {
        const ka = statusUpdate(rec.taskId, 'working');
        this.ws.send(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, ka));
      }, STATUS_KEEPALIVE_MS),
    );
  }

  private clearKeepalive(sessionId: string, taskId: string): void {
    const tk = this.taskKey(sessionId, taskId);
    const t = this.keepaliveTimers.get(tk);
    if (t) {
      clearInterval(t);
      this.keepaliveTimers.delete(tk);
    }
  }

  // ── Queue Management ──

  private currentTask(sessionId: string): TaskRecord | undefined {
    return this.taskQueue.get(sessionId)?.[0];
  }

  private dequeueTask(sessionId: string, taskId: string): void {
    const q = this.taskQueue.get(sessionId);
    if (!q) return;
    const idx = q.findIndex((t) => t.taskId === taskId);
    if (idx >= 0) q.splice(idx, 1);
    if (q.length === 0) this.taskQueue.delete(sessionId);
    const tk = this.taskKey(sessionId, taskId);
    this.hasPushDelivery.delete(tk);
    const next = q?.[0];
    const nextTk = next && this.taskKey(sessionId, next.taskId);
    const pending = nextTk && this.pendingDispatch.get(nextTk);
    if (pending) {
      this.pendingDispatch.delete(nextTk);
      this.onMsg?.(pending).catch((e: unknown) => this.log.error({ err: e }, '[XiaoYi] Dispatch failed'));
    }
  }

  private purgeSession(sid: string): void {
    for (const t of this.taskQueue.get(sid) ?? []) {
      const tk = this.taskKey(sid, t.taskId);
      this.cancelTaskTimeout(sid, t.taskId);
      this.clearKeepalive(sid, t.taskId);
      this.hasPushDelivery.delete(tk);
      this.pendingDispatch.delete(tk);
    }
    this.taskQueue.delete(sid);
  }

  private sessionFrom(externalChatId: string): string {
    const idx = externalChatId.indexOf(':');
    return idx >= 0 ? externalChatId.slice(idx + 1) : externalChatId;
  }

  private gcDedup(): void {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [k, ts] of this.dedup) {
      if (ts < cutoff) this.dedup.delete(k);
    }
  }
}
