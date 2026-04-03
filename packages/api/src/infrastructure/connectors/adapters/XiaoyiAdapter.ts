/**
 * XiaoYi (小艺) Connector Adapter — OpenClaw 模式对接华为 HAG
 *
 * 连接方向：Cat Cafe 主动连 HAG（类似 DingTalk Stream 模式）
 * 流式：status-update(working) → artifact-update 逐帧 → artifact-update(lastChunk, final:false)
 * 多猫：replyParts 聚合 → 3s debounce 后 final:true 关闭 task（sendPlaceholder 取消 timer）
 * 结束序列：status-update(completed, final:true) → artifact-update(final:true)，与参考实现一致
 *
 * Task isolation: each HAG task is tracked via per-session FIFO queue (taskQueue).
 * sendPlaceholder claims the next unclaimed task (invocation-level binding via claimTask),
 * and sendReply uses that binding — not queue-head — to route replies to the correct task.
 * This prevents cross-task contamination even when QueueProcessor starts the next
 * invocation before the previous task's 3s scheduleFinal timer fires.
 *
 * F148 | ADR-014
 */

import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';
import {
  type A2AInbound,
  APP_HEARTBEAT_MS,
  agentResponse,
  artifactUpdate,
  DEDUP_TTL_MS,
  DEFERRED_FINAL_MS,
  EDIT_THROTTLE_MS,
  type EditRecord,
  envelope,
  generateXiaoyiSignature,
  MAX_RECONNECT,
  PONG_TIMEOUT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  STATUS_KEEPALIVE_MS,
  statusUpdate,
  TASK_TIMEOUT_MS,
  type TaskRecord,
  WS_BACKUP,
  WS_PING_MS,
  WS_PRIMARY,
  type WsChannel,
  type XiaoyiAdapterOptions,
  type XiaoyiInboundMessage,
} from './xiaoyi-protocol.js';

export type { XiaoyiAdapterOptions, XiaoyiInboundMessage };
export { generateXiaoyiSignature };

export class XiaoyiAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'xiaoyi' as const;
  private readonly log: FastifyBaseLogger;
  private readonly opts: XiaoyiAdapterOptions;
  /** Per-session FIFO queue of HAG tasks */
  private readonly taskQueue = new Map<string, TaskRecord[]>();
  /** Invocation-level binding: sessionId → task claimed by the current invocation */
  private readonly activeTask = new Map<string, TaskRecord>();
  /** Set of taskIds already claimed by an invocation (prevents double-claim) */
  private readonly claimedTasks = new Set<string>();
  private readonly replyParts = new Map<string, string[]>();
  private readonly dedup = new Map<string, number>();
  private readonly editState = new Map<string, EditRecord>();
  private readonly finalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly keepaliveTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly taskTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private channels: WsChannel[] = [];
  private onMsg: ((msg: XiaoyiInboundMessage) => Promise<void>) | null = null;
  private running = false;

  constructor(log: FastifyBaseLogger, opts: XiaoyiAdapterOptions) {
    this.log = log;
    this.opts = opts;
  }

  // ── Lifecycle ──

  async startStream(onMessage: (msg: XiaoyiInboundMessage) => Promise<void>): Promise<void> {
    this.onMsg = onMessage;
    this.running = true;
    this.channels = [
      this.mkChannel(this.opts.wsUrl1 ?? WS_PRIMARY, 'primary'),
      this.mkChannel(this.opts.wsUrl2 ?? WS_BACKUP, 'backup'),
    ];
    for (const ch of this.channels) this.connect(ch);
  }

  async stopStream(): Promise<void> {
    this.running = false;
    this.onMsg = null;
    for (const ch of this.channels) this.disconnect(ch);
    this.channels = [];
    for (const t of this.taskTimeouts.values()) clearTimeout(t);
    this.taskTimeouts.clear();
    for (const t of this.finalTimers.values()) clearTimeout(t);
    this.finalTimers.clear();
    for (const t of this.keepaliveTimers.values()) clearInterval(t);
    this.keepaliveTimers.clear();
    this.taskQueue.clear();
    this.activeTask.clear();
    this.claimedTasks.clear();
    this.replyParts.clear();
    this.dedup.clear();
    this.editState.clear();
  }

  // ── IStreamableOutboundAdapter ──

  async sendReply(externalChatId: string, content: string): Promise<void> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.activeTask.get(sessionId) ?? this.claimTask(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendReply');
      return;
    }
    const parts = this.replyParts.get(rec.taskId) ?? [];
    parts.push(content);
    this.replyParts.set(rec.taskId, parts);
    const fullText = parts.join('\n\n---\n\n');
    const art = artifactUpdate(rec.taskId, fullText, { append: false, lastChunk: false, final: false });
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, art));
    this.scheduleFinal(rec.taskId, sessionId, rec);
  }

  async sendPlaceholder(externalChatId: string, _text: string): Promise<string> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.claimTask(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendPlaceholder');
      return '';
    }
    this.cancelFinal(rec.taskId);
    if (!this.replyParts.has(rec.taskId)) {
      // status-update 只设 state，不带 message（HAG 会把 message 文字渲染成持久条目）
      const st = statusUpdate(rec.taskId, 'working');
      this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, st));
      // 用 artifact-update 发占位文字，后续 editMessage(append:false) 会替换掉
      const placeholder = artifactUpdate(rec.taskId, '思考中…', { append: false, lastChunk: false, final: false });
      this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, placeholder));
    }
    this.editState.set(rec.taskId, { sessionId, source: rec.source, sentLen: 0, lastEditAt: 0 });
    this.startKeepalive(rec.taskId, sessionId, rec);
    return rec.taskId;
  }

  async editMessage(_externalChatId: string, platformMessageId: string, text: string): Promise<void> {
    const edit = this.editState.get(platformMessageId);
    if (!edit) return;
    const now = Date.now();
    if (now - edit.lastEditAt < EDIT_THROTTLE_MS) return;
    const prior = this.replyParts.get(platformMessageId);
    const prefix = prior?.length ? `${prior.join('\n\n---\n\n')}\n\n---\n\n` : '';
    const fullText = prefix + text;
    const isFirst = edit.sentLen === 0;
    const delta = isFirst ? fullText : fullText.slice(edit.sentLen);
    if (!delta) return;
    const detail = artifactUpdate(platformMessageId, delta, { append: !isFirst, lastChunk: false, final: false });
    this.sendVia(edit.source, agentResponse(this.opts.agentId, edit.sessionId, platformMessageId, detail));
    edit.sentLen = fullText.length;
    edit.lastEditAt = now;
  }

  async deleteMessage(platformMessageId: string): Promise<void> {
    this.editState.delete(platformMessageId);
  }

  // ── Connection ──

  private mkChannel(url: string, label: string): WsChannel {
    return { ws: null, url, label, appTimer: null, pingTimer: null, lastPong: 0, reconnects: 0, reconnectTimer: null };
  }

  private connect(ch: WsChannel): void {
    if (!this.running) return;
    const ts = Date.now().toString();
    const sig = generateXiaoyiSignature(this.opts.sk, ts);
    const headers = { 'x-access-key': this.opts.ak, 'x-sign': sig, 'x-ts': ts, 'x-agent-id': this.opts.agentId };
    const isIp = /^\d+\.\d+\.\d+\.\d+/.test(new URL(ch.url).hostname);
    this.log.info({ label: ch.label, url: ch.url }, '[XiaoYi] Connecting');
    const ws = new WebSocket(ch.url, { headers, rejectUnauthorized: !isIp });
    ws.on('open', () => {
      ch.reconnects = 0;
      ch.lastPong = Date.now();
      ws.send(envelope(this.opts.agentId, 'clawd_bot_init'));
      ch.appTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(envelope(this.opts.agentId, 'heartbeat'));
      }, APP_HEARTBEAT_MS);
      ch.pingTimer = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - ch.lastPong > PONG_TIMEOUT_MS) {
          this.log.warn({ label: ch.label }, '[XiaoYi] Pong timeout');
          ws.terminate();
          return;
        }
        ws.ping();
      }, WS_PING_MS);
      this.log.info({ label: ch.label }, '[XiaoYi] Connected');
    });
    ws.on('pong', () => {
      ch.lastPong = Date.now();
    });
    ws.on('message', (raw: Buffer) => this.handleInbound(raw.toString(), ch.label));
    ws.on('close', () => {
      ch.ws = null;
      this.clearWsTimers(ch);
      if (this.running) this.scheduleReconnect(ch);
    });
    ws.on('error', (err: unknown) => this.log.warn({ err, label: ch.label }, '[XiaoYi] WS error'));
    ch.ws = ws;
  }

  private disconnect(ch: WsChannel): void {
    this.clearWsTimers(ch);
    if (ch.ws) {
      ch.ws.removeAllListeners();
      ch.ws.terminate();
      ch.ws = null;
    }
  }

  private clearWsTimers(ch: WsChannel): void {
    if (ch.appTimer) {
      clearInterval(ch.appTimer);
      ch.appTimer = null;
    }
    if (ch.pingTimer) {
      clearInterval(ch.pingTimer);
      ch.pingTimer = null;
    }
    if (ch.reconnectTimer) {
      clearTimeout(ch.reconnectTimer);
      ch.reconnectTimer = null;
    }
  }

  private scheduleReconnect(ch: WsChannel): void {
    if (ch.reconnects >= MAX_RECONNECT) {
      this.log.error({ label: ch.label }, '[XiaoYi] Max reconnects');
      return;
    }
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** ch.reconnects, RECONNECT_MAX_MS);
    ch.reconnects++;
    ch.reconnectTimer = setTimeout(() => this.connect(ch), delay);
  }

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
      this.handleMessageStream(msg, source);
    } else if (msg.method === 'tasks/cancel' || msg.method === 'clearContext') {
      const sid = msg.params?.sessionId ?? msg.sessionId;
      if (sid) this.purgeSession(sid);
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

    // Queue new task — previous task continues via its own scheduleFinal/timeout
    const rec: TaskRecord = { taskId, source };
    const queue = this.taskQueue.get(sessionId) ?? [];
    queue.push(rec);
    this.taskQueue.set(sessionId, queue);
    this.startTaskTimeout(taskId, sessionId, rec);

    // If queued behind another task, send keepalive to prevent HAG timeout
    if (queue.length > 1) {
      const st = statusUpdate(taskId, 'working');
      this.sendVia(source, agentResponse(this.opts.agentId, sessionId, taskId, st));
      this.startKeepalive(taskId, sessionId, rec);
    }

    const text = (msg.params?.message?.parts ?? [])
      .filter((p): p is { kind: string; text: string } => p.kind === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    if (!text) return;
    const chatId = `${this.opts.agentId}:${sessionId}`;
    const senderId = `owner:${this.opts.agentId}`;
    this.onMsg?.({ chatId, text, messageId: taskId, taskId, senderId }).catch((err: unknown) =>
      this.log.error({ err, taskId }, '[XiaoYi] Callback failed'),
    );
  }

  // ── Task Timers ──

  private scheduleFinal(taskId: string, sessionId: string, rec: TaskRecord): void {
    this.cancelFinal(taskId);
    this.finalTimers.set(
      taskId,
      setTimeout(() => {
        this.finalTimers.delete(taskId);
        if (this.editState.has(taskId)) {
          this.scheduleFinal(taskId, sessionId, rec);
          return;
        }
        const parts = this.replyParts.get(taskId);
        if (!parts?.length) return;
        this.cancelTaskTimeout(taskId);
        this.clearKeepalive(taskId);
        this.emitFinal(sessionId, rec, parts.join('\n\n---\n\n'));
        this.replyParts.delete(taskId);
        this.dequeueTask(sessionId, taskId);
      }, DEFERRED_FINAL_MS),
    );
  }

  private startTaskTimeout(taskId: string, sessionId: string, rec: TaskRecord): void {
    this.cancelTaskTimeout(taskId);
    this.taskTimeouts.set(
      taskId,
      setTimeout(() => {
        this.taskTimeouts.delete(taskId);
        this.cancelFinal(taskId);
        this.clearKeepalive(taskId);
        const parts = this.replyParts.get(taskId);
        const text = parts?.length ? parts.join('\n\n---\n\n') : '处理超时，请重试';
        this.emitFinal(sessionId, rec, text, parts?.length ? 'completed' : 'failed');
        this.replyParts.delete(taskId);
        this.dequeueTask(sessionId, taskId);
        this.log.warn({ sessionId, taskId }, '[XiaoYi] Task timeout — force finalized');
      }, TASK_TIMEOUT_MS),
    );
  }

  /** Send status-update(completed/failed) + artifact-update(final:true) to close a task */
  private emitFinal(
    sessionId: string,
    rec: TaskRecord,
    text: string,
    state: 'completed' | 'failed' = 'completed',
  ): void {
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, statusUpdate(rec.taskId, state)));
    const art = artifactUpdate(rec.taskId, text, { append: false, lastChunk: true, final: true });
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, art));
  }

  private clearTimersForTask(taskId: string): void {
    this.cancelTaskTimeout(taskId);
    this.cancelFinal(taskId);
    this.clearKeepalive(taskId);
  }

  private cancelFinal(taskId: string): void {
    const t = this.finalTimers.get(taskId);
    if (t) {
      clearTimeout(t);
      this.finalTimers.delete(taskId);
    }
  }

  private cancelTaskTimeout(taskId: string): void {
    const t = this.taskTimeouts.get(taskId);
    if (t) {
      clearTimeout(t);
      this.taskTimeouts.delete(taskId);
    }
  }

  private clearKeepalive(taskId: string): void {
    const t = this.keepaliveTimers.get(taskId);
    if (t) {
      clearInterval(t);
      this.keepaliveTimers.delete(taskId);
    }
  }

  // ── Helpers ──

  /** Clear all task state for a cancelled/cleared session. */
  private purgeSession(sid: string): void {
    const queue = this.taskQueue.get(sid);
    if (queue) {
      for (const t of queue) {
        this.clearTimersForTask(t.taskId);
        this.replyParts.delete(t.taskId);
        this.editState.delete(t.taskId);
        this.claimedTasks.delete(t.taskId);
      }
    }
    this.taskQueue.delete(sid);
    this.activeTask.delete(sid);
  }

  /** Claim the next unclaimed task from the queue (invocation-level binding). */
  private claimTask(sessionId: string): TaskRecord | undefined {
    const queue = this.taskQueue.get(sessionId);
    if (!queue) return undefined;
    const task = queue.find((t) => !this.claimedTasks.has(t.taskId));
    if (!task) return undefined;
    this.claimedTasks.add(task.taskId);
    this.activeTask.set(sessionId, task);
    return task;
  }

  /** Remove a finalized task from its session queue and clean up bindings. */
  private dequeueTask(sessionId: string, taskId: string): void {
    const q = this.taskQueue.get(sessionId);
    if (!q) return;
    const idx = q.findIndex((t) => t.taskId === taskId);
    if (idx >= 0) q.splice(idx, 1);
    if (q.length === 0) this.taskQueue.delete(sessionId);
    this.claimedTasks.delete(taskId);
    if (this.activeTask.get(sessionId)?.taskId === taskId) {
      this.activeTask.delete(sessionId);
    }
  }

  /** Start keepalive interval for a task (idempotent). */
  private startKeepalive(taskId: string, sessionId: string, rec: TaskRecord): void {
    if (this.keepaliveTimers.has(taskId)) return;
    this.keepaliveTimers.set(
      taskId,
      setInterval(() => {
        const ka = statusUpdate(rec.taskId, 'working');
        this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, ka));
      }, STATUS_KEEPALIVE_MS),
    );
  }

  private sendVia(preferred: string, payload: string): void {
    const ch = this.channels.find((c) => c.label === preferred);
    if (ch?.ws && ch.ws.readyState === WebSocket.OPEN) {
      ch.ws.send(payload);
      return;
    }
    const fb = this.channels.find((c) => c.label !== preferred && c.ws?.readyState === WebSocket.OPEN);
    if (fb?.ws) {
      this.log.warn({ from: preferred, to: fb.label }, '[XiaoYi] Channel fallback');
      fb.ws.send(payload);
      return;
    }
    this.log.error('[XiaoYi] No channel available');
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
