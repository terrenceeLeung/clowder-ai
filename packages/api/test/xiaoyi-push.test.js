import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ── PushIdManager tests ──

describe('XiaoyiPushIdManager', () => {
  const mkLog = () => ({
    info() {},
    warn() {},
    error() {},
    debug() {},
    trace() {},
    fatal() {},
    child() {
      return this;
    },
  });

  it('extractPushId from data part with systemVariables', async () => {
    const { XiaoyiPushIdManager } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-pushid.js');
    const mgr = new XiaoyiPushIdManager(mkLog(), 'agent-1');

    const pushId = mgr.extractPushId({
      message: {
        parts: [
          { kind: 'text', text: 'hello' },
          {
            kind: 'data',
            data: {
              variables: {
                systemVariables: { push_id: 'pid-abc123' },
              },
            },
          },
        ],
      },
    });
    assert.equal(pushId, 'pid-abc123');
  });

  it('extractPushId from top-level params.data (flattened)', async () => {
    const { XiaoyiPushIdManager } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-pushid.js');
    const mgr = new XiaoyiPushIdManager(mkLog(), 'agent-1');

    const pushId = mgr.extractPushId({
      data: {
        variables: {
          systemVariables: { push_id: 'pid-flat' },
        },
      },
    });
    assert.equal(pushId, 'pid-flat');
  });

  it('extractPushId returns undefined when missing', async () => {
    const { XiaoyiPushIdManager } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-pushid.js');
    const mgr = new XiaoyiPushIdManager(mkLog(), 'agent-1');

    assert.equal(mgr.extractPushId({}), undefined);
    assert.equal(mgr.extractPushId({ message: { parts: [] } }), undefined);
  });

  it('addPushId + getAllPushIds (memory mode, no Redis)', async () => {
    const { XiaoyiPushIdManager } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-pushid.js');
    const mgr = new XiaoyiPushIdManager(mkLog(), 'agent-1');

    await mgr.addPushId('pid-1');
    await mgr.addPushId('pid-2');
    await mgr.addPushId('pid-1'); // dedup

    const ids = await mgr.getAllPushIds();
    assert.equal(ids.length, 2);
    assert.ok(ids.includes('pid-1'));
    assert.ok(ids.includes('pid-2'));
  });

  it('addPushId ignores empty string', async () => {
    const { XiaoyiPushIdManager } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-pushid.js');
    const mgr = new XiaoyiPushIdManager(mkLog(), 'agent-1');

    await mgr.addPushId('');
    const count = await mgr.getPushIdCount();
    assert.equal(count, 0);
  });
});

// ── PushThrottle tests ──

describe('XiaoyiPushThrottle', () => {
  const mkLog = () => ({
    info() {},
    warn() {},
    error() {},
    debug() {},
    trace() {},
    fatal() {},
    child() {
      return this;
    },
  });

  it('enqueue delivers to all pushIds via pushService', async () => {
    const { XiaoyiPushThrottle } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-push-throttle.js');

    const sent = [];
    const mockPushService = {
      sendPush: async (pushId, text) => {
        sent.push({ pushId, text });
        return { ok: true, status: 200 };
      },
    };
    const mockPushIdManager = {
      getAllPushIds: async () => ['pid-1', 'pid-2'],
    };

    const throttle = new XiaoyiPushThrottle(mkLog(), mockPushService, mockPushIdManager, 0);

    const result = await throttle.enqueue('Hello world');
    assert.equal(result.ok, true);
    assert.equal(result.pushCount, 2);
    assert.equal(result.failCount, 0);
    assert.equal(sent.length, 2);
    assert.equal(sent[0].pushId, 'pid-1');
    assert.equal(sent[1].pushId, 'pid-2');

    throttle.destroy();
  });

  it('returns ok=false when no pushIds available', async () => {
    const { XiaoyiPushThrottle } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-push-throttle.js');

    const mockPushService = { sendPush: async () => ({ ok: true, status: 200 }) };
    const mockPushIdManager = { getAllPushIds: async () => [] };

    const throttle = new XiaoyiPushThrottle(mkLog(), mockPushService, mockPushIdManager, 0);
    const result = await throttle.enqueue('test');
    assert.equal(result.ok, false);
    assert.equal(result.pushCount, 0);

    throttle.destroy();
  });

  it('counts failures correctly when some pushIds fail', async () => {
    const { XiaoyiPushThrottle } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-push-throttle.js');

    let callCount = 0;
    const mockPushService = {
      sendPush: async () => {
        callCount++;
        if (callCount === 1) return { ok: true, status: 200 };
        return { ok: false, status: 500 };
      },
    };
    const mockPushIdManager = {
      getAllPushIds: async () => ['pid-1', 'pid-2'],
    };

    const throttle = new XiaoyiPushThrottle(mkLog(), mockPushService, mockPushIdManager, 0);
    const result = await throttle.enqueue('test');
    assert.equal(result.ok, true, 'at least one succeeded');
    assert.equal(result.pushCount, 1);
    assert.equal(result.failCount, 1);

    throttle.destroy();
  });

  it('destroy resolves pending jobs with ok=false', async () => {
    const { XiaoyiPushThrottle } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-push-throttle.js');

    const mockPushService = {
      sendPush: async () => ({ ok: true, status: 200 }),
    };
    const mockPushIdManager = { getAllPushIds: async () => ['pid-1'] };

    const throttle = new XiaoyiPushThrottle(mkLog(), mockPushService, mockPushIdManager, 60_000);
    const p1 = throttle.enqueue('first');
    // Second job won't drain because interval is 60s
    const p2 = throttle.enqueue('second');

    // Wait for first to drain
    const r1 = await p1;
    assert.equal(r1.ok, true);

    // Destroy flushes pending
    throttle.destroy();
    const r2 = await p2;
    assert.equal(r2.ok, false);
  });
});

// ── Adapter Push/WS routing tests ──

describe('XiaoyiAdapter: active WS replies + async Push outbound', () => {
  const mkLog = () => ({
    info() {},
    warn() {},
    error() {},
    debug() {},
    trace() {},
    fatal() {},
    child() {
      return this;
    },
  });

  const mkOpts = (apiId) => ({
    agentId: 'agent-1',
    ak: 'ak',
    sk: 'sk',
    apiId,
  });

  function mkInbound(taskId, sessionId, text, pushId) {
    const parts = [{ kind: 'text', text }];
    if (pushId) {
      parts.push({
        kind: 'data',
        data: { variables: { systemVariables: { push_id: pushId } } },
      });
    }
    return JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/stream',
      id: `msg-${taskId}`,
      params: {
        id: taskId,
        sessionId,
        message: { role: 'user', parts },
      },
    });
  }

  function parseDetail(frame) {
    return JSON.parse(JSON.parse(JSON.stringify(frame)).msgDetail);
  }

  function captureSent(adapter) {
    const sent = [];
    adapter.ws.send = (_p, payload) => sent.push(JSON.parse(payload));
    return sent;
  }

  it('delivers active conversation replies via WS when Push is unavailable', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const warns = [];
    const errors = [];
    const log = mkLog();
    log.warn = (obj) => warns.push(obj);
    log.error = (obj) => errors.push(obj);

    const adapter = new XiaoyiAdapter(log, mkOpts(undefined));
    const sent = captureSent(adapter);
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');

    await adapter.sendReply('agent-1:sess-1', 'reply text');

    const artifacts = sent
      .map((f) => parseDetail(f))
      .filter((d) => d.result?.kind === 'artifact-update' && d.result?.artifact?.parts?.[0]?.kind === 'text');
    assert.equal(artifacts.length, 1, 'WS delivers artifact');
    assert.equal(artifacts[0].result.append, false);
    assert.equal(artifacts[0].result.artifact.parts[0].text, 'reply text');

    await adapter.stopStream();
  });

  it('delivers active conversation replies via WS even when Push is configured', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts('api-id'));
    const sent = captureSent(adapter);
    let pushCalls = 0;
    adapter.pushThrottle = {
      enqueue: async () => {
        pushCalls++;
        return { ok: true, pushCount: 1, failCount: 0 };
      },
      destroy() {},
    };
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello', 'my-push-id'), 'primary');
    await adapter.sendReply('agent-1:sess-1', 'reply text');

    assert.equal(pushCalls, 0, 'active task replies must not be diverted to Push');
    const artifacts = sent
      .map((f) => parseDetail(f))
      .filter((d) => d.result?.kind === 'artifact-update' && d.result?.artifact?.parts?.[0]?.kind === 'text');
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].result.artifact.parts[0].text, 'reply text');

    await adapter.stopStream();
  });

  it('uses Push for async replies when no active WS task exists', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts('api-id'));
    const sent = captureSent(adapter);
    const pushed = [];
    adapter.pushThrottle = {
      enqueue: async (text) => {
        pushed.push(text);
        return { ok: true, pushCount: 1, failCount: 0 };
      },
      destroy() {},
    };

    await adapter.sendReply('agent-1:sess-1', 'async notice');

    assert.deepEqual(pushed, ['async notice']);
    assert.equal(sent.length, 0, 'no WS frame can be sent without an active task');

    await adapter.stopStream();
  });

  it('extracts pushId from inbound messages', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts(undefined));
    captureSent(adapter);
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello', 'my-push-id'), 'primary');

    const ids = await adapter.pushIdManager.getAllPushIds();
    assert.ok(ids.includes('my-push-id'), 'pushId collected from inbound');

    await adapter.stopStream();
  });

  it('onDeliveryBatchDone sends completed close frame after WS delivery', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts(undefined));
    const sent = captureSent(adapter);
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');
    await adapter.sendReply('agent-1:sess-1', 'reply');

    sent.length = 0;
    await adapter.onDeliveryBatchDone('agent-1:sess-1', true);
    const closeDetail = parseDetail(sent[0]);
    assert.equal(closeDetail.result.kind, 'status-update');
    assert.equal(closeDetail.result.status.state, 'completed');
    assert.equal(closeDetail.result.final, true);

    await adapter.stopStream();
  });

  it('onDeliveryBatchDone sends failed close frame when no delivery happened', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts(undefined));
    const sent = captureSent(adapter);
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');

    // Don't send any reply, just close
    await adapter.onDeliveryBatchDone('agent-1:sess-1', true);
    const closeDetail = parseDetail(sent[sent.length - 1]);
    assert.equal(closeDetail.result.kind, 'status-update');
    assert.equal(closeDetail.result.status.state, 'failed');

    await adapter.stopStream();
  });

  it('sendPlaceholder sends working status + thinking bubble', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts(undefined));
    const sent = captureSent(adapter);
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');
    await adapter.sendPlaceholder('agent-1:sess-1', '...');

    const details = sent.map((f) => parseDetail(f));
    assert.ok(details.some((d) => d.result?.kind === 'status-update' && d.result?.status?.state === 'working'));
    assert.ok(
      details.some(
        (d) => d.result?.kind === 'artifact-update' && d.result?.artifact?.parts?.[0]?.kind === 'reasoningText',
      ),
    );

    await adapter.stopStream();
  });
});
