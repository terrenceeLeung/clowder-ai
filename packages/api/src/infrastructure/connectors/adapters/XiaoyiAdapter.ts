/**
 * XiaoYi (小艺) Connector Adapter — OpenClaw 模式对接华为 HAG
 *
 * 连接方向：Cat Cafe 主动连 HAG（类似 DingTalk Stream 模式）
 * 流式：status-update(working) → artifact-update 逐帧 → artifact-update(lastChunk, final:false)
 * 多猫：replyParts 聚合 → 3s debounce 后 final:true 关闭 task（sendPlaceholder 取消 timer）
 * 结束序列：status-update(completed, final:false) → artifact-update(final:true)，与参考实现一致
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
  private readonly latestTask = new Map<string, TaskRecord>();
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
    this.latestTask.clear();
    this.replyParts.clear();
    this.dedup.clear();
    this.editState.clear();
  }

  // ── IStreamableOutboundAdapter ──

  async sendReply(externalChatId: string, content: string): Promise<void> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.latestTask.get(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendReply');
      return;
    }
    const parts = this.replyParts.get(sessionId) ?? [];
    parts.push(content);
    this.replyParts.set(sessionId, parts);
    const fullText = parts.join('\n\n---\n\n');
    const art = artifactUpdate(rec.taskId, fullText, { append: false, lastChunk: false, final: false });
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, art));
    this.scheduleFinal(sessionId, rec);
  }

  async sendPlaceholder(externalChatId: string, _text: string): Promise<string> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.latestTask.get(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendPlaceholder');
      return '';
    }
    this.cancelFinal(sessionId);
    if (!this.replyParts.has(sessionId)) {
      const st = statusUpdate(rec.taskId, 'working', '思考中…');
      this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, st));
    }
    this.editState.set(rec.taskId, { sessionId, source: rec.source, sentLen: 0, lastEditAt: 0 });
    if (!this.keepaliveTimers.has(sessionId)) {
      this.keepaliveTimers.set(
        sessionId,
        setInterval(() => {
          const r = this.latestTask.get(sessionId);
          if (!r) return;
          const ka = statusUpdate(r.taskId, 'working', '处理中…');
          this.sendVia(r.source, agentResponse(this.opts.agentId, sessionId, r.taskId, ka));
        }, STATUS_KEEPALIVE_MS),
      );
    }
    return rec.taskId;
  }

  async editMessage(_externalChatId: string, platformMessageId: string, text: string): Promise<void> {
    const edit = this.editState.get(platformMessageId);
    if (!edit) return;
    const now = Date.now();
    if (now - edit.lastEditAt < EDIT_THROTTLE_MS) return;
    const prior = this.replyParts.get(edit.sessionId);
    const prefix = prior?.length ? prior.join('\n\n---\n\n') + '\n\n---\n\n' : '';
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
      this.clearTimers(ch);
      if (this.running) this.scheduleReconnect(ch);
    });
    ws.on('error', (err: unknown) => this.log.warn({ err, label: ch.label }, '[XiaoYi] WS error'));
    ch.ws = ws;
  }

  private disconnect(ch: WsChannel): void {
    this.clearTimers(ch);
    if (ch.ws) {
      ch.ws.removeAllListeners();
      ch.ws.terminate();
      ch.ws = null;
    }
  }

  private clearTimers(ch: WsChannel): void {
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
      if (sid) {
        this.clearAllTimersFor(sid);
        this.latestTask.delete(sid);
        this.replyParts.delete(sid);
      }
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

    // Finalize previous task before accepting new one
    this.clearAllTimersFor(sessionId);
    const prevTask = this.latestTask.get(sessionId);
    const prevParts = this.replyParts.get(sessionId);
    if (prevTask && prevParts?.length) {
      this.emitFinal(sessionId, prevTask, prevParts.join('\n\n---\n\n'));
    }

    this.latestTask.set(sessionId, { taskId, source });
    this.replyParts.delete(sessionId);
    this.startTaskTimeout(sessionId, { taskId, source });

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

  private scheduleFinal(sessionId: string, rec: TaskRecord): void {
    this.cancelFinal(sessionId);
    this.finalTimers.set(
      sessionId,
      setTimeout(() => {
        this.finalTimers.delete(sessionId);
        if (this.editState.has(rec.taskId)) {
          this.scheduleFinal(sessionId, rec);
          return;
        }
        const parts = this.replyParts.get(sessionId);
        if (!parts?.length) return;
        this.cancelTaskTimeout(sessionId);
        this.clearKeepalive(sessionId);
        this.emitFinal(sessionId, rec, parts.join('\n\n---\n\n'));
        this.replyParts.delete(sessionId);
      }, DEFERRED_FINAL_MS),
    );
  }

  private startTaskTimeout(sessionId: string, rec: TaskRecord): void {
    this.cancelTaskTimeout(sessionId);
    this.taskTimeouts.set(
      sessionId,
      setTimeout(() => {
        this.taskTimeouts.delete(sessionId);
        this.cancelFinal(sessionId);
        this.clearKeepalive(sessionId);
        const parts = this.replyParts.get(sessionId);
        const text = parts?.length ? parts.join('\n\n---\n\n') : '处理超时，请重试';
        this.emitFinal(sessionId, rec, text, parts?.length ? 'completed' : 'failed');
        this.replyParts.delete(sessionId);
        this.log.warn({ sessionId, taskId: rec.taskId }, '[XiaoYi] Task timeout — force finalized');
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

  private clearAllTimersFor(sid: string): void {
    this.cancelTaskTimeout(sid);
    this.cancelFinal(sid);
    this.clearKeepalive(sid);
  }

  private cancelFinal(sid: string): void {
    const t = this.finalTimers.get(sid);
    if (t) {
      clearTimeout(t);
      this.finalTimers.delete(sid);
    }
  }

  private cancelTaskTimeout(sid: string): void {
    const t = this.taskTimeouts.get(sid);
    if (t) {
      clearTimeout(t);
      this.taskTimeouts.delete(sid);
    }
  }

  private clearKeepalive(sid: string): void {
    const t = this.keepaliveTimers.get(sid);
    if (t) {
      clearInterval(t);
      this.keepaliveTimers.delete(sid);
    }
  }

  // ── Helpers ──

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
