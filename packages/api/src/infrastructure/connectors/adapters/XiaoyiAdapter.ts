/**
 * XiaoYi (小艺) Connector Adapter — OpenClaw 模式对接华为 HAG
 *
 * 连接方向：Cat Cafe 主动连 HAG（类似 DingTalk Stream 模式）
 * 协议：A2A JSON-RPC 2.0，出站需两层信封（WebSocket frame + stringified msgDetail）
 * 流式：status-update(working) → artifact-update 逐帧 → artifact-update(final:true)
 * 注意：不发 status-update(completed)，与 @ynhcj/xiaoyi 参考实现一致
 *
 * F148 | ADR-014
 */

import { createHmac } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';

// ── Constants ──

const WS_PRIMARY = 'wss://hag.cloud.huawei.com/openclaw/v1/ws/link';
const WS_BACKUP = 'wss://116.63.174.231/openclaw/v1/ws/link';
const APP_HEARTBEAT_MS = 20_000;
const WS_PING_MS = 30_000;
const PONG_TIMEOUT_MS = 90_000;
const MAX_RECONNECT = 10;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const DEDUP_TTL_MS = 5 * 60_000;
const EDIT_THROTTLE_MS = 300;

// ── Types ──

interface A2AInbound {
  jsonrpc?: string;
  method?: string;
  id?: string;
  agentId?: string;
  sessionId?: string;
  params?: {
    id?: string;
    sessionId?: string;
    agentId?: string;
    message?: { role?: string; parts?: Array<{ kind?: string; text?: string }> };
  };
}

interface WsChannel {
  ws: WebSocket | null;
  url: string;
  label: string;
  appTimer: ReturnType<typeof setInterval> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  lastPong: number;
  reconnects: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

interface TaskRecord {
  taskId: string;
  source: string;
}

interface EditRecord {
  sessionId: string;
  source: string;
  sentLen: number;
  lastEditAt: number;
}

export interface XiaoyiInboundMessage {
  chatId: string;
  text: string;
  messageId: string;
  taskId: string;
}

export interface XiaoyiAdapterOptions {
  agentId: string;
  ak: string;
  sk: string;
  wsUrl1?: string;
  wsUrl2?: string;
}

// ── Auth (exported for testing) ──

export function generateXiaoyiSignature(sk: string, timestamp: string): string {
  return createHmac('sha256', sk).update(timestamp).digest('base64');
}

// ── Protocol Helpers ──

function envelope(agentId: string, msgType: string): string {
  return JSON.stringify({ msgType, agentId });
}

function agentResponse(agentId: string, sessionId: string, taskId: string, detail: Record<string, unknown>): string {
  return JSON.stringify({ msgType: 'agent_response', agentId, sessionId, taskId, msgDetail: JSON.stringify(detail) });
}

function artifactUpdate(
  taskId: string,
  text: string,
  opts: { append: boolean; lastChunk: boolean; final: boolean },
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: `msg_${Date.now()}`,
    result: {
      taskId,
      kind: 'artifact-update',
      append: opts.append,
      lastChunk: opts.lastChunk,
      final: opts.final,
      artifact: { artifactId: `artifact_${Date.now()}`, parts: [{ kind: 'text', text }] },
    },
  };
}

function statusUpdate(
  taskId: string,
  state: 'working' | 'completed' | 'failed',
  message?: string,
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: `msg_${Date.now()}`,
    result: {
      taskId,
      kind: 'status-update',
      final: state !== 'working',
      status: { state, ...(message ? { message: { role: 'agent', parts: [{ kind: 'text', text: message }] } } : {}) },
    },
  };
}

// ── Adapter ──

export class XiaoyiAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'xiaoyi' as const;
  private readonly log: FastifyBaseLogger;
  private readonly opts: XiaoyiAdapterOptions;
  /** Latest task per session — never consumed, overwritten by new inbound messages */
  private readonly latestTask = new Map<string, TaskRecord>();
  /** Accumulated reply parts per session — enables multi-cat aggregation */
  private readonly replyParts = new Map<string, string[]>();
  private readonly dedup = new Map<string, number>();
  private readonly editState = new Map<string, EditRecord>();
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
    // Aggregate multi-cat replies: each sendReply appends, then we send the
    // accumulated text as a single artifact (replace mode, append:false).
    const parts = this.replyParts.get(sessionId) ?? [];
    parts.push(content);
    this.replyParts.set(sessionId, parts);
    const fullText = parts.join('\n\n---\n\n');
    // No status-update(completed) — artifact-update(final:true) is sufficient
    // (matches @ynhcj/xiaoyi reference implementation)
    const art = artifactUpdate(rec.taskId, fullText, { append: false, lastChunk: true, final: true });
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, art));
  }

  async sendPlaceholder(externalChatId: string, _text: string): Promise<string> {
    const sessionId = this.sessionFrom(externalChatId);
    const rec = this.latestTask.get(sessionId);
    if (!rec) {
      this.log.warn({ sessionId }, '[XiaoYi] No task for sendPlaceholder');
      return '';
    }
    const st = statusUpdate(rec.taskId, 'working', '思考中…');
    this.sendVia(rec.source, agentResponse(this.opts.agentId, sessionId, rec.taskId, st));
    this.editState.set(rec.taskId, { sessionId, source: rec.source, sentLen: 0, lastEditAt: 0 });
    return rec.taskId;
  }

  async editMessage(_externalChatId: string, platformMessageId: string, text: string): Promise<void> {
    const edit = this.editState.get(platformMessageId);
    if (!edit) return;
    const now = Date.now();
    if (now - edit.lastEditAt < EDIT_THROTTLE_MS) return;

    const isFirst = edit.sentLen === 0;
    const delta = isFirst ? text : text.slice(edit.sentLen);
    if (!delta) return;

    const detail = artifactUpdate(platformMessageId, delta, { append: !isFirst, lastChunk: false, final: false });
    this.sendVia(edit.source, agentResponse(this.opts.agentId, edit.sessionId, platformMessageId, detail));
    edit.sentLen = text.length;
    edit.lastEditAt = now;
  }

  async deleteMessage(platformMessageId: string): Promise<void> {
    // Only clean up edit tracking — sendReply is the sole completion path,
    // so we do not send final artifact or status-update(completed) here.
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
      this.log.error({ label: ch.label }, '[XiaoYi] Max reconnects reached');
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

    this.latestTask.set(sessionId, { taskId, source });
    // New user message resets reply aggregation
    this.replyParts.delete(sessionId);

    const text = (msg.params?.message?.parts ?? [])
      .filter((p): p is { kind: string; text: string } => p.kind === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    if (!text) return;

    const chatId = `${this.opts.agentId}:${sessionId}`;
    this.onMsg?.({ chatId, text, messageId: taskId, taskId }).catch((err: unknown) =>
      this.log.error({ err, taskId }, '[XiaoYi] Callback failed'),
    );
  }

  // ── Helpers ──

  private sendVia(preferred: string, payload: string): void {
    const ch = this.channels.find((c) => c.label === preferred);
    if (ch?.ws && ch.ws.readyState === WebSocket.OPEN) {
      ch.ws.send(payload);
      return;
    }
    const fallback = this.channels.find((c) => c.label !== preferred && c.ws?.readyState === WebSocket.OPEN);
    if (fallback?.ws) {
      this.log.warn({ from: preferred, to: fallback.label }, '[XiaoYi] Channel fallback');
      fallback.ws.send(payload);
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
