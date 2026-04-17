/**
 * XiaoYi Push Service — HTTP Push API for outbound text delivery.
 *
 * Push replaces WS append accumulation for text replies (Phase D).
 * Media/file delivery still requires WS (out of Phase D scope).
 *
 * F151 Phase D
 */

import { createHmac } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

const PUSH_ENDPOINT = 'https://hag.cloud.huawei.com/open-ability-agent/v1/agent-webhook';
const PUSH_TEXT_TITLE_MAX = 57;
const PUSH_TEXT_MAX = 4000;

export interface XiaoyiPushConfig {
  ak: string;
  sk: string;
  apiId: string;
  agentId: string;
}

export interface PushResult {
  ok: boolean;
  status: number;
  body?: string;
}

function sign(sk: string, ts: string): string {
  return createHmac('sha256', sk).update(ts).digest('base64');
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class XiaoyiPushService {
  private readonly config: XiaoyiPushConfig;
  private readonly log: FastifyBaseLogger;

  constructor(log: FastifyBaseLogger, config: XiaoyiPushConfig) {
    this.log = log;
    this.config = config;
  }

  async sendPush(pushId: string, text: string): Promise<PushResult> {
    const ts = String(Date.now());
    const title = text.split('\n')[0].slice(0, PUSH_TEXT_TITLE_MAX);
    const pushText = text.length > PUSH_TEXT_MAX ? text.slice(0, PUSH_TEXT_MAX) : text;

    const body = {
      jsonrpc: '2.0',
      id: uuid(),
      result: {
        id: uuid(),
        apiId: this.config.apiId,
        pushId,
        pushText: title,
        kind: 'task',
        artifacts: [
          {
            artifactId: uuid(),
            parts: [{ kind: 'text', text: pushText }],
          },
        ],
        status: { state: 'completed' },
      },
    };

    const res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-hag-trace-id': uuid(),
        'X-Access-Key': this.config.ak,
        'X-Sign': sign(this.config.sk, ts),
        'X-Ts': ts,
      },
      body: JSON.stringify(body),
    });

    const resBody = await res.text();
    this.log.info({ status: res.status, pushId: pushId.slice(0, 20) }, '[XiaoYi:Push] sent');

    return { ok: res.ok, status: res.status, body: resBody };
  }
}
