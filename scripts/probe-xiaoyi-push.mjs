#!/usr/bin/env node
/**
 * XiaoYi Push API 探针 — F151 真机 payload 变体验证。
 *
 * 用途：真机观察到 Push 到达后聊天界面不立即显示，怀疑是 payload 字段问题。
 * 本脚本切换 payload 变体逐一发送，配合真机观察定位偏差。
 *
 * 用法：
 *   node scripts/probe-xiaoyi-push.mjs --env <path>                  列出变体
 *   node scripts/probe-xiaoyi-push.mjs --env <path> --variant V0     发送 V0
 *   node scripts/probe-xiaoyi-push.mjs --env <path> --variant V0 --text "自定义"
 *   node scripts/probe-xiaoyi-push.mjs --env <path> --variant V0 --pushid <id>
 *
 * pushId 默认从 Redis (6399) `cat-cafe:xiaoyi:pushIds:{agentId}` 读取。
 * 多次发送之间请间隔 ≥15s（华为 Push 限流）。
 */

import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const PUSH_ENDPOINT = 'https://hag.cloud.huawei.com/open-ability-agent/v1/agent-webhook';
const REDIS_PORT = 6399;
const PUSH_TIMEOUT_MS = 10_000;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}

async function loadEnv(path) {
  const text = await readFile(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trimStart().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

function sign(sk, ts) {
  return createHmac('sha256', sk).update(ts).digest('base64');
}

function readPushIdsFromRedis(agentId) {
  const out = execSync(
    `redis-cli -p ${REDIS_PORT} SMEMBERS 'cat-cafe:xiaoyi:pushIds:${agentId}'`,
    { encoding: 'utf8' },
  );
  return out.trim().split('\n').filter(Boolean);
}

// ---------- Variants ----------
// Each variant returns { body, tsOverride? }. tsOverride lets V7 use seconds.

function buildV0({ text, cfg, pushId }) {
  const title = text.split('\n')[0].slice(0, 57);
  return {
    body: {
      jsonrpc: '2.0',
      id: randomUUID(),
      result: {
        id: randomUUID(),
        apiId: cfg.apiId,
        pushId,
        pushText: title,
        kind: 'task',
        artifacts: [{ artifactId: randomUUID(), parts: [{ kind: 'text', text }] }],
        status: { state: 'completed' },
      },
    },
  };
}

function buildV1({ text, cfg, pushId }) {
  // 删掉 pushText —— 看通知栏是否消失，反推 pushText 是否=通知摘要
  const v0 = buildV0({ text, cfg, pushId });
  delete v0.body.result.pushText;
  return v0;
}

function buildV2({ text, cfg, pushId }) {
  // pushText = 全文（不截 57 字）
  const v0 = buildV0({ text, cfg, pushId });
  v0.body.result.pushText = text;
  return v0;
}

function buildV3({ text, cfg, pushId }) {
  // kind = "message"（A2A inbound 用 message，不是 task）
  const v0 = buildV0({ text, cfg, pushId });
  v0.body.result.kind = 'message';
  return v0;
}

function buildV4({ text, cfg, pushId }) {
  // artifactId 用确定性命名（含 sessionId/taskId 关联）
  const v0 = buildV0({ text, cfg, pushId });
  const sessionId = randomUUID();
  const taskId = randomUUID();
  v0.body.result.sessionId = sessionId;
  v0.body.result.taskId = taskId;
  v0.body.result.artifacts[0].artifactId = `${taskId}:1`;
  return v0;
}

function buildV5({ text, cfg, pushId }) {
  // parts 显式声明 mimeType: text/markdown
  const v0 = buildV0({ text, cfg, pushId });
  v0.body.result.artifacts[0].parts = [
    { kind: 'text', text, mimeType: 'text/markdown' },
  ];
  return v0;
}

function buildV6({ text, cfg, pushId }) {
  // status 嵌入 message 子字段（A2A task 完成态完整结构）
  const v0 = buildV0({ text, cfg, pushId });
  v0.body.result.status = {
    state: 'completed',
    message: {
      role: 'agent',
      parts: [{ kind: 'text', text }],
    },
  };
  return v0;
}

function buildV7({ text, cfg, pushId }) {
  // result 用 messages 数组替代 artifacts（模仿入站协议结构）
  return {
    body: {
      jsonrpc: '2.0',
      id: randomUUID(),
      result: {
        id: randomUUID(),
        apiId: cfg.apiId,
        pushId,
        pushText: text.split('\n')[0].slice(0, 57),
        kind: 'message',
        messages: [
          {
            messageId: randomUUID(),
            role: 'agent',
            parts: [{ kind: 'text', text }],
          },
        ],
      },
    },
  };
}

const VARIANTS = {
  V0: { name: 'baseline (当前生产 payload)', build: buildV0 },
  V1: { name: '删掉 pushText 字段', build: buildV1 },
  V2: { name: 'pushText = 全文（不截 57）', build: buildV2 },
  V3: { name: 'kind="message" (替代 task)', build: buildV3 },
  V4: { name: '加 sessionId/taskId + artifactId 含 taskId', build: buildV4 },
  V5: { name: 'parts 加 mimeType: text/markdown', build: buildV5 },
  V6: { name: 'status 嵌 message 子字段（完整 A2A 结构）', build: buildV6 },
  V7: { name: '用 messages 数组替代 artifacts', build: buildV7 },
};

// ---------- Main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.env) {
    console.error('Usage: node scripts/probe-xiaoyi-push.mjs --env <path> [--variant V0..V7] [--text ...] [--pushid ...]');
    process.exit(2);
  }

  const env = await loadEnv(args.env);
  const cfg = {
    ak: env.XIAOYI_AK,
    sk: env.XIAOYI_SK,
    apiId: env.XIAOYI_API_ID,
    agentId: env.XIAOYI_AGENT_ID,
  };
  const missing = Object.entries(cfg).filter(([_, v]) => !v).map(([k]) => `XIAOYI_${k.toUpperCase().replace('AGENTID', 'AGENT_ID').replace('APIID', 'API_ID')}`);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}`);
    process.exit(2);
  }

  if (!args.variant) {
    console.log('Variants:');
    for (const [k, v] of Object.entries(VARIANTS)) console.log(`  ${k}: ${v.name}`);
    console.log('\n再传 --variant Vx 发送。');
    return;
  }

  const variant = VARIANTS[args.variant];
  if (!variant) {
    console.error(`Unknown variant ${args.variant}. Available: ${Object.keys(VARIANTS).join(', ')}`);
    process.exit(2);
  }

  let pushId = args.pushid;
  if (!pushId) {
    const ids = readPushIdsFromRedis(cfg.agentId);
    if (ids.length === 0) {
      console.error(`No pushId in redis (key: cat-cafe:xiaoyi:pushIds:${cfg.agentId}). 让真机先发一条消息。`);
      process.exit(2);
    }
    pushId = ids[0];
    if (ids.length > 1) console.log(`(${ids.length} pushIds in set, using first: ${pushId.slice(0, 12)}...)`);
  }

  const text = args.text || `**Probe ${args.variant}** — ${variant.name}\n\n时间: ${new Date().toLocaleTimeString()}`;
  const { body, tsOverride } = variant.build({ text, cfg, pushId });
  const ts = tsOverride ?? String(Date.now());

  console.log(`\n=== Variant ${args.variant}: ${variant.name} ===`);
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('---');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PUSH_TIMEOUT_MS);
  let res, respBody;
  try {
    res = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-hag-trace-id': randomUUID(),
        'X-Access-Key': cfg.ak,
        'X-Sign': sign(cfg.sk, ts),
        'X-Ts': ts,
      },
      body: JSON.stringify(body),
    });
    respBody = await res.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Push timeout (10s)');
      process.exit(1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  console.log(`HTTP ${res.status} ${res.statusText}`);
  console.log('Resp:', respBody);
  console.log('---');
  console.log(`观察清单：`);
  console.log(`  [ ] 通知栏是否出现？`);
  console.log(`  [ ] 聊天界面是否立刻显示？`);
  console.log(`  [ ] 点开通知后聊天界面是否补显？`);
  console.log(`  [ ] markdown 渲染是否正确？`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
