import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ── Phase B: Inbound media attachment tests ──

describe('XiaoyiAdapter: inbound media attachments', () => {
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

  function mkInboundWithFiles(taskId, sessionId, textParts, fileParts) {
    const parts = [
      ...textParts.map((t) => ({ kind: 'text', text: t })),
      ...fileParts.map((f) => ({ kind: 'file', file: f })),
    ];
    return JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/stream',
      id: `msg-${taskId}`,
      params: { id: taskId, sessionId, message: { role: 'user', parts } },
    });
  }

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

  it('inbound message with image attachment builds correct payload', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(
      mkInboundWithFiles(
        'task-1',
        'sess-1',
        ['check this'],
        [{ name: 'photo.jpg', mimeType: 'image/jpeg', uri: 'https://hag.example.com/files/abc123' }],
      ),
      'primary',
    );

    assert.equal(received.length, 1);
    assert.equal(received[0].text, 'check this');
    assert.ok(received[0].attachments);
    assert.equal(received[0].attachments.length, 1);
    assert.equal(received[0].attachments[0].type, 'image');
    assert.equal(received[0].attachments[0].xiaoyiUri, 'https://hag.example.com/files/abc123');
    assert.equal(received[0].attachments[0].fileName, 'photo.jpg');
    assert.equal(received[0].attachments[0].mimeType, 'image/jpeg');

    await adapter.stopStream();
  });

  it('inbound message with file attachment (non-image) uses type=file', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(
      mkInboundWithFiles(
        'task-1',
        'sess-1',
        ['see doc'],
        [{ name: 'report.pdf', mimeType: 'application/pdf', uri: 'https://hag.example.com/files/pdf456' }],
      ),
      'primary',
    );

    assert.equal(received[0].attachments[0].type, 'file');
    assert.equal(received[0].attachments[0].mimeType, 'application/pdf');

    await adapter.stopStream();
  });

  it('image-only message (no text) gets fallback text from filenames', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(
      mkInboundWithFiles(
        'task-1',
        'sess-1',
        [],
        [
          { name: 'sunset.png', mimeType: 'image/png', uri: 'https://hag.example.com/a' },
          { name: 'doc.pdf', mimeType: 'application/pdf', uri: 'https://hag.example.com/b' },
        ],
      ),
      'primary',
    );

    assert.equal(received.length, 1);
    assert.equal(received[0].text, '[sunset.png, doc.pdf]', 'fallback text from filenames');
    assert.equal(received[0].attachments.length, 2);

    await adapter.stopStream();
  });

  it('mixed text + multiple files builds combined payload', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(
      mkInboundWithFiles(
        'task-1',
        'sess-1',
        ['analyze these'],
        [
          { name: 'a.jpg', mimeType: 'image/jpeg', uri: 'https://hag.example.com/1' },
          { name: 'b.csv', mimeType: 'text/csv', uri: 'https://hag.example.com/2' },
        ],
      ),
      'primary',
    );

    assert.equal(received[0].text, 'analyze these');
    assert.equal(received[0].attachments.length, 2);
    assert.equal(received[0].attachments[0].type, 'image');
    assert.equal(received[0].attachments[1].type, 'file');

    await adapter.stopStream();
  });

  it('inbound with no text and no files is dropped', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    adapter.handleInbound(mkInboundWithFiles('task-1', 'sess-1', [], []), 'primary');
    assert.equal(received.length, 0, 'empty message should be dropped');

    await adapter.stopStream();
  });

  it('empty message does not block subsequent messages on same session (P2 review fix)', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    // Send empty message first — should NOT enter queue
    adapter.handleInbound(mkInboundWithFiles('task-empty', 'sess-1', [], []), 'primary');
    assert.equal(received.length, 0);

    // Subsequent valid message on same session should dispatch immediately
    adapter.handleInbound(mkInbound('task-real', 'sess-1', 'hello'), 'primary');
    assert.equal(received.length, 1, 'valid message must dispatch without waiting for empty task timeout');
    assert.equal(received[0].taskId, 'task-real');

    await adapter.stopStream();
  });

  it('file parts with missing uri are filtered out', async () => {
    const { XiaoyiAdapter } = await import('../dist/infrastructure/connectors/adapters/XiaoyiAdapter.js');
    const adapter = new XiaoyiAdapter(mkLog(), mkOpts());
    adapter.ws.send = () => {};
    const received = [];
    adapter.onMsg = async (msg) => received.push(msg);

    // Craft raw message with a malformed file part (no uri)
    adapter.handleInbound(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/stream',
        id: 'msg-t1',
        params: {
          id: 'task-1',
          sessionId: 'sess-1',
          message: {
            role: 'user',
            parts: [
              { kind: 'text', text: 'hi' },
              { kind: 'file', file: { name: 'bad.jpg', mimeType: 'image/jpeg' } },
              { kind: 'file', file: { name: 'good.png', mimeType: 'image/png', uri: 'https://hag.example.com/ok' } },
            ],
          },
        },
      }),
      'primary',
    );

    assert.equal(received.length, 1);
    assert.equal(received[0].attachments.length, 1, 'only valid file part kept');
    assert.equal(received[0].attachments[0].fileName, 'good.png');

    await adapter.stopStream();
  });
});
