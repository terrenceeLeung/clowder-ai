import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ── Protocol layer tests ──

describe('xiaoyi-protocol: generateXiaoyiSignature', () => {
  it('produces consistent HMAC-SHA256 base64', async () => {
    const { generateXiaoyiSignature } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const sig = generateXiaoyiSignature('test-sk', '1234567890');
    assert.match(sig, /^[A-Za-z0-9+/]+=*$/);
    assert.equal(sig, generateXiaoyiSignature('test-sk', '1234567890'), 'deterministic');
    assert.notEqual(sig, generateXiaoyiSignature('other-sk', '1234567890'), 'different SK');
    assert.notEqual(sig, generateXiaoyiSignature('test-sk', '9999999999'), 'different timestamp');
  });

  it('input is timestamp only (not ak=...&timestamp=...)', async () => {
    const { createHmac } = await import('node:crypto');
    const { generateXiaoyiSignature } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const ts = '1234567890';
    const expected = createHmac('sha256', 'sk').update(ts).digest('base64');
    assert.equal(generateXiaoyiSignature('sk', ts), expected);
  });
});

describe('xiaoyi-protocol: envelope', () => {
  it('builds correct JSON', async () => {
    const { envelope } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const msg = JSON.parse(envelope('agent-1', 'heartbeat'));
    assert.deepEqual(msg, { msgType: 'heartbeat', agentId: 'agent-1' });
  });
});

describe('xiaoyi-protocol: agentResponse', () => {
  it('wraps detail with stringified msgDetail', async () => {
    const { agentResponse } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const detail = { kind: 'test', value: 42 };
    const parsed = JSON.parse(agentResponse('agent-1', 'session-1', 'task-1', detail));
    assert.equal(parsed.msgType, 'agent_response');
    assert.equal(parsed.agentId, 'agent-1');
    assert.equal(parsed.sessionId, 'session-1');
    assert.equal(parsed.taskId, 'task-1');
    assert.equal(typeof parsed.msgDetail, 'string', 'msgDetail must be stringified');
    assert.deepEqual(JSON.parse(parsed.msgDetail), detail);
  });
});

describe('xiaoyi-protocol: artifactUpdate', () => {
  it('builds A2A artifact-update with correct fields', async () => {
    const { artifactUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const art = artifactUpdate('task-1', 'hello', { append: false, lastChunk: true, final: true });
    assert.equal(art.jsonrpc, '2.0');
    assert.match(String(art.id), /^msg_\d+_\d+$/);
    assert.equal(art.result.taskId, 'task-1');
    assert.equal(art.result.kind, 'artifact-update');
    assert.equal(art.result.append, false);
    assert.equal(art.result.lastChunk, true);
    assert.equal(art.result.final, true);
    assert.equal(art.result.artifact.parts[0].kind, 'text');
    assert.equal(art.result.artifact.parts[0].text, 'hello');
  });

  it('append mode', async () => {
    const { artifactUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const art = artifactUpdate('t', 'chunk', { append: true, lastChunk: false, final: false });
    assert.equal(art.result.append, true);
    assert.equal(art.result.lastChunk, false);
    assert.equal(art.result.final, false);
  });
});

describe('xiaoyi-protocol: statusUpdate', () => {
  it('working → final:false', async () => {
    const { statusUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const st = statusUpdate('task-1', 'working');
    assert.equal(st.result.final, false);
    assert.equal(st.result.status.state, 'working');
    assert.equal(st.result.status.message, undefined);
  });

  it('completed → final:true', async () => {
    const { statusUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const st = statusUpdate('task-1', 'completed');
    assert.equal(st.result.final, true);
    assert.equal(st.result.status.state, 'completed');
  });

  it('failed → final:true', async () => {
    const { statusUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const st = statusUpdate('task-1', 'failed');
    assert.equal(st.result.final, true);
  });

  it('with message includes parts', async () => {
    const { statusUpdate } = await import('../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js');
    const st = statusUpdate('task-1', 'working', 'thinking...');
    assert.equal(st.result.status.message.role, 'agent');
    assert.equal(st.result.status.message.parts[0].text, 'thinking...');
  });
});

describe('xiaoyi-protocol: message ID uniqueness', () => {
  it('consecutive calls produce unique IDs', async () => {
    const { artifactUpdate, statusUpdate } = await import(
      '../dist/infrastructure/connectors/adapters/xiaoyi-protocol.js'
    );
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(artifactUpdate('t', 'x', { append: false, lastChunk: false, final: false }).id);
      ids.add(statusUpdate('t', 'working').id);
    }
    assert.equal(ids.size, 20, 'all 20 IDs must be unique');
  });
});

// ── Adapter task lifecycle tests ──

describe('XiaoyiAdapter: task lifecycle', () => {
  /** Minimal logger stub matching FastifyBaseLogger shape */
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

  const mkOpts = () => ({ agentId: 'agent-1', ak: 'ak', sk: 'sk' });

  function mkInbound(taskId, sessionId, text) {
    return JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/stream',
      id: `msg-${taskId}`,
      params: {
        id: taskId,
        sessionId,
        message: { role: 'user', parts: [{ kind: 'text', text }] },
      },
    });
  }

  it('claim → placeholder → reply → final sequence', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());

    const sent = [];
    adapter.ws.send = (_preferred, payload) => sent.push(JSON.parse(payload));

    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    // Simulate inbound message
    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');
    assert.equal(received.length, 1);
    assert.equal(received[0].text, 'hello');
    assert.equal(received[0].taskId, 'task-1');
    assert.equal(received[0].chatId, 'agent-1:sess-1');
    assert.equal(received[0].senderId, 'owner:agent-1');

    // sendPlaceholder claims the task
    const msgId = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(msgId, 'task-1');

    // Should have sent status-update(working) + artifact-update(placeholder)
    const statusMsg = sent.find(
      (m) =>
        JSON.parse(m.msgDetail)?.result?.kind === 'status-update' &&
        JSON.parse(m.msgDetail)?.result?.status?.state === 'working',
    );
    assert.ok(statusMsg, 'should send status-update(working)');
    const placeholderMsg = sent.find(
      (m) =>
        JSON.parse(m.msgDetail)?.result?.kind === 'artifact-update' &&
        JSON.parse(m.msgDetail)?.result?.artifact?.parts?.[0]?.text === '思考中…',
    );
    assert.ok(placeholderMsg, 'should send artifact-update placeholder');

    sent.length = 0;

    // sendReply
    await adapter.sendReply('agent-1:sess-1', 'world');
    assert.ok(sent.length > 0, 'should send artifact-update reply');
    const replyMsg = sent.find((m) => {
      const detail = JSON.parse(m.msgDetail);
      return detail?.result?.kind === 'artifact-update' && detail?.result?.artifact?.parts?.[0]?.text === 'world';
    });
    assert.ok(replyMsg, 'reply text should be in artifact-update');

    await adapter.stopStream();
  });

  it('dedup prevents double processing of same task', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};

    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'first'), 'primary');
    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'dupe'), 'backup');
    assert.equal(received.length, 1, 'duplicate should be dropped');

    await adapter.stopStream();
  });

  it('ignores messages for wrong agentId', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};

    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    const wrong = JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/stream',
      agentId: 'other-agent',
      params: { id: 'task-1', sessionId: 'sess-1', message: { parts: [{ kind: 'text', text: 'hi' }] } },
    });
    adapter.handleInbound(wrong, 'primary');
    assert.equal(received.length, 0);

    await adapter.stopStream();
  });

  it('tasks/cancel purges session state', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hi'), 'primary');
    await adapter.sendPlaceholder('agent-1:sess-1', '...');

    // Cancel
    adapter.handleInbound(JSON.stringify({ method: 'tasks/cancel', params: { sessionId: 'sess-1' } }), 'primary');

    // Task should be gone — sendReply should warn
    const warns = [];
    adapter.log = { ...mkLog(), warn: (obj) => warns.push(obj) };
    await adapter.sendReply('agent-1:sess-1', 'late');
    assert.ok(warns.length > 0, 'should warn about missing task');

    await adapter.stopStream();
  });

  it('multi-cat: second cat reuses task via activeTask fallback', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    const sent = [];
    adapter.ws.send = (_p, payload) => sent.push(JSON.parse(payload));
    adapter.onMsg = async () => {};

    // HAG sends one task
    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'hello'), 'primary');

    // Cat A claims and replies
    const idA = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(idA, 'task-1');
    await adapter.sendReply('agent-1:sess-1', 'Cat A says hi');

    // Cat B: sendPlaceholder should reuse task-1 (not return empty)
    const idB = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(idB, 'task-1', 'Cat B must reuse same taskId');

    // Cat B: finalTimer should be cancelled (cancelFinal called)
    assert.equal(adapter.finalTimers.has('task-1'), false, 'cancelFinal should clear timer');

    // Cat B: sendReply should append to replyParts
    sent.length = 0;
    await adapter.sendReply('agent-1:sess-1', 'Cat B says world');
    const parts = adapter.replyParts.get('task-1');
    assert.deepEqual(parts, ['Cat A says hi', 'Cat B says world'], 'replyParts should aggregate both cats');

    // Verify the artifact sent contains both parts joined
    const replyArt = sent.find((m) => {
      const d = JSON.parse(m.msgDetail);
      return d?.result?.kind === 'artifact-update' && d?.result?.artifact?.parts?.[0]?.text?.includes('Cat A');
    });
    assert.ok(replyArt, 'aggregated artifact should contain Cat A text');
    const artText = JSON.parse(replyArt.msgDetail).result.artifact.parts[0].text;
    assert.ok(artText.includes('Cat B says world'), 'aggregated artifact should contain Cat B text');

    await adapter.stopStream();
  });

  it('serial dispatch: task B waits until task A dequeues', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};

    const dispatched = [];
    adapter.onMsg = async (msg) => dispatched.push(msg.taskId);

    // Two tasks arrive for the same session
    adapter.handleInbound(mkInbound('task-A', 'sess-1', 'msg1'), 'primary');
    adapter.handleInbound(mkInbound('task-B', 'sess-1', 'msg2'), 'primary');

    // Only task-A should be dispatched (queue head)
    assert.deepEqual(dispatched, ['task-A'], 'task-B must NOT dispatch while A is active');

    // Cat 1 of chain A: claims task-A
    const idA1 = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(idA1, 'task-A');

    // Cat 2 of chain A: must reuse task-A (not claim task-B)
    await adapter.sendReply('agent-1:sess-1', 'A1 done');
    const idA2 = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(idA2, 'task-A', 'chain A cat 2 must reuse task-A');

    // task-B still not dispatched
    assert.deepEqual(dispatched, ['task-A'], 'task-B still pending');

    // Simulate chain A finalization (scheduleFinal would call emitFinal → dequeueTask)
    // Directly call dequeueTask to simulate
    adapter.dequeueTask('sess-1', 'task-A');
    assert.deepEqual(dispatched, ['task-A', 'task-B'], 'task-B dispatched after A dequeues');

    // Now task-B can be claimed
    const idB = await adapter.sendPlaceholder('agent-1:sess-1', '...');
    assert.equal(idB, 'task-B', 'task-B is now claimable');

    await adapter.stopStream();
  });

  it('multi-cat: sendPlaceholder skips duplicate status/placeholder after first cat', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    const sent = [];
    adapter.ws.send = (_p, payload) => sent.push(JSON.parse(payload));
    adapter.onMsg = async () => {};

    adapter.handleInbound(mkInbound('task-1', 'sess-1', 'go'), 'primary');

    // Cat A: sendPlaceholder sends status(working) + artifact(placeholder)
    await adapter.sendPlaceholder('agent-1:sess-1', '...');
    const countAfterA = sent.length;
    assert.ok(countAfterA >= 2, 'Cat A placeholder should send status + artifact');

    // Cat A replies (replyParts now has content)
    await adapter.sendReply('agent-1:sess-1', 'A done');

    // Cat B: sendPlaceholder should NOT re-send status(working)/placeholder
    // because replyParts already has content
    const countBeforeB = sent.length;
    await adapter.sendPlaceholder('agent-1:sess-1', '...');
    const newMsgs = sent.slice(countBeforeB);
    const hasNewPlaceholder = newMsgs.some((m) => {
      const d = JSON.parse(m.msgDetail);
      return d?.result?.artifact?.parts?.[0]?.text === '思考中…';
    });
    assert.equal(hasNewPlaceholder, false, 'should not re-send placeholder after replyParts exist');

    await adapter.stopStream();
  });

  it('HAG JSON-RPC error is logged', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const warnings = [];
    const log = { ...mkLog(), warn: (...args) => warnings.push(args) };
    const adapter = new XiaoyiAdapter(log, mkOpts());
    adapter.ws.send = () => {};

    adapter.handleInbound(JSON.stringify({ error: { code: -32600, message: 'Invalid Request' } }), 'primary');
    assert.ok(warnings.length > 0, 'should log JSON-RPC error');
  });
});
