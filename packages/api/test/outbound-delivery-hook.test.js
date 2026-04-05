import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { CAT_CONFIGS, catRegistry } from '@cat-cafe/shared';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';
import { OutboundDeliveryHook } from '../dist/infrastructure/connectors/OutboundDeliveryHook.js';

// Bootstrap catRegistry for tests
for (const [id, config] of Object.entries(CAT_CONFIGS)) {
  if (!catRegistry.has(id)) catRegistry.register(id, config);
}

function noopLog() {
  const noop = () => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => noopLog(),
  };
}

function mockAdapter(connectorId) {
  const sent = [];
  return {
    sent,
    adapter: {
      connectorId,
      async sendReply(externalChatId, content, metadata) {
        sent.push({ externalChatId, content, metadata });
      },
    },
  };
}

describe('OutboundDeliveryHook', () => {
  let bindingStore;
  let feishuMock;
  let hook;

  beforeEach(() => {
    bindingStore = new MemoryConnectorThreadBindingStore();
    feishuMock = mockAdapter('feishu');
    const adapters = new Map([['feishu', feishuMock.adapter]]);
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters,
      log: noopLog(),
    });
  });

  it('delivers reply to bound external chat', async () => {
    bindingStore.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello from cat!');
    assert.equal(feishuMock.sent.length, 1);
    assert.equal(feishuMock.sent[0].externalChatId, 'chat-123');
    assert.equal(feishuMock.sent[0].content, 'Hello from cat!');
  });

  it('skips delivery when no binding exists', async () => {
    await hook.deliver('thread-no-binding', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });

  it('delivers to multiple bindings for same thread', async () => {
    const telegramMock = mockAdapter('telegram');
    const adapters = new Map([
      ['feishu', feishuMock.adapter],
      ['telegram', telegramMock.adapter],
    ]);
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters,
      log: noopLog(),
    });

    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    bindingStore.bind('telegram', 'chat-2', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!');

    assert.equal(feishuMock.sent.length, 1);
    assert.equal(telegramMock.sent.length, 1);
  });

  it('does not throw when adapter.sendReply fails', async () => {
    const failAdapter = {
      connectorId: 'feishu',
      async sendReply() {
        throw new Error('network error');
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', failAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    // Should not throw — fire-and-forget with error logging
    await hook.deliver('thread-abc', 'Hello');
  });

  it('skips binding when adapter not registered', async () => {
    bindingStore.bind('discord', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });

  // Phase 2: cat identity prefix
  it('prepends cat display name prefix when catId is provided', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus');
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  it('sends plain content when catId is omitted (backward compat)', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!');
    assert.equal(feishuMock.sent[0].content, 'Hello!');
  });

  it('sends plain content when catId is unknown', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'nonexistent-cat');
    assert.equal(feishuMock.sent[0].content, 'Hello!');
  });

  // Phase 3: rich block delivery
  it('calls sendRichMessage when adapter supports it and blocks provided', async () => {
    const richSent = [];
    const richAdapter = {
      connectorId: 'feishu',
      async sendReply(externalChatId, content) {
        feishuMock.sent.push({ externalChatId, content });
      },
      async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
        richSent.push({ externalChatId, textContent, blocks, catDisplayName });
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', richAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
    await hook.deliver('thread-abc', 'Summary text', 'opus', blocks);

    assert.equal(richSent.length, 1);
    assert.equal(richSent[0].catDisplayName, '布偶猫');
    assert.equal(richSent[0].blocks.length, 1);
    assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
  });

  it('falls back to sendReply with plaintext when adapter lacks sendRichMessage', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
    await hook.deliver('thread-abc', 'Summary', 'opus', blocks);

    assert.equal(feishuMock.sent.length, 1);
    // Should contain both text prefix and plaintext-rendered block
    assert.ok(feishuMock.sent[0].content.includes('【布偶猫🐱】'));
    assert.ok(feishuMock.sent[0].content.includes('Review'));
    assert.ok(feishuMock.sent[0].content.includes('LGTM'));
  });

  it('sends text via sendReply when no rich blocks (backward compat)', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus', undefined);
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  it('sends text via sendReply when rich blocks is empty array', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus', []);
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  // P1-1: block-only responses (empty content) must still trigger delivery
  it('delivers rich blocks even when text content is empty', async () => {
    const richSent = [];
    const richAdapter = {
      connectorId: 'feishu',
      async sendReply(externalChatId, content) {
        feishuMock.sent.push({ externalChatId, content });
      },
      async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
        richSent.push({ externalChatId, textContent, blocks, catDisplayName });
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', richAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
    await hook.deliver('thread-abc', '', 'opus', blocks);

    assert.equal(richSent.length, 1);
    assert.equal(richSent[0].blocks.length, 1);
    assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
  });

  it('falls back to plaintext for block-only when adapter lacks sendRichMessage', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
    await hook.deliver('thread-abc', '', 'opus', blocks);

    assert.equal(feishuMock.sent.length, 1);
    assert.ok(feishuMock.sent[0].content.includes('Status'));
    assert.ok(feishuMock.sent[0].content.includes('Done'));
  });

  // Phase A: MessageEnvelope formatted reply
  describe('sendFormattedReply (MessageEnvelope)', () => {
    it('calls sendFormattedReply when adapter supports it and threadMeta provided', async () => {
      const formattedCalls = [];
      const richAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendFormattedReply(chatId, envelope) {
          formattedCalls.push({ chatId, envelope });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', richAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Hello from cat!', 'opus', undefined, {
        threadShortId: 'T42',
        threadTitle: '飞书登录bug排查',
        featId: 'F088',
      });

      assert.equal(formattedCalls.length, 1);
      assert.equal(feishuMock.sent.length, 0, 'sendReply should NOT be called');
      assert.equal(formattedCalls[0].chatId, 'oc_chat_1');
      const env = formattedCalls[0].envelope;
      assert.ok(env.header.includes('布偶猫'), 'header should contain cat display name');
      assert.ok(env.subtitle.includes('T42'), 'subtitle should have thread short ID');
      assert.ok(env.subtitle.includes('F088'), 'subtitle should have feat ID');
      assert.equal(env.body, 'Hello from cat!');
    });

    it('falls back to sendReply when adapter has no sendFormattedReply', async () => {
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Hello!', 'opus', undefined, {
        threadShortId: 'T1',
      });

      assert.equal(feishuMock.sent.length, 1);
      assert.ok(feishuMock.sent[0].content.includes('Hello!'));
    });

    it('uses sendFormattedReply even without threadMeta (Phase E: card identity)', async () => {
      const formattedCalls = [];
      const richAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendFormattedReply(chatId, envelope) {
          formattedCalls.push({ chatId, envelope });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', richAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      // No threadMeta → should STILL use card for visual identity separation
      await hook.deliver('thread-1', 'Old style message', 'opus');

      assert.equal(formattedCalls.length, 1, 'sendFormattedReply SHOULD be called even without threadMeta');
      assert.equal(feishuMock.sent.length, 0, 'sendReply should NOT be called');
      const env = formattedCalls[0].envelope;
      assert.ok(env.header.includes('布偶猫'), 'header should contain cat display name');
      assert.equal(env.body, 'Old style message');
    });
  });

  // Phase 6: Audio block → sendMedia delivery
  describe('audio block delivery via sendMedia', () => {
    it('calls sendMedia for audio blocks with url when adapter supports it', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc123.wav', text: 'Hello voice' }];
      await hook.deliver('thread-abc', 'Text reply', 'opus', blocks);

      assert.equal(mediaSent.length, 1, 'sendMedia should be called for audio block with url');
      assert.equal(mediaSent[0].chatId, 'chat-1');
      assert.equal(mediaSent[0].payload.type, 'audio');
      assert.ok(mediaSent[0].payload.url.includes('abc123.wav'));
    });

    it('does not call sendMedia when adapter lacks sendMedia (graceful fallback)', async () => {
      const richSent = [];
      const noMediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', noMediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc123.wav', text: 'Hello voice' }];
      // Should not throw, falls back to rich message rendering
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);
      assert.equal(richSent.length, 1, 'should fall back to sendRichMessage');
    });

    it('skips sendMedia for audio blocks without url (text-only = not yet synthesized)', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, text: 'Hello voice' }];
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);

      assert.equal(mediaSent.length, 0, 'sendMedia should NOT be called for audio without url');
      assert.equal(richSent.length, 1, 'should still send via sendRichMessage');
    });

    it('sends media for each audio block in mixed blocks', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [
        { id: 'c1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' },
        { id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc.wav', text: 'Voice 1' },
        { id: 'a2', kind: 'audio', v: 1, url: '/api/tts/audio/def.wav', text: 'Voice 2' },
      ];
      await hook.deliver('thread-abc', 'Mixed content', 'opus', blocks);

      assert.equal(mediaSent.length, 2, 'sendMedia called for each audio block with url');
      assert.equal(richSent.length, 1, 'sendRichMessage still called for all blocks');
    });
  });

  // Phase J: File block → sendMedia delivery
  describe('file block delivery via sendMedia', () => {
    it('calls sendMedia for file blocks with url', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => {
          if (url.startsWith('/uploads/')) return `/abs${url}`;
          return undefined;
        },
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: '调研报告.pdf' }];
      await hook.deliver('thread-abc', 'Here is the report', 'opus', blocks);

      assert.equal(mediaSent.length, 1, 'sendMedia should be called for file block');
      assert.equal(mediaSent[0].chatId, 'chat-1');
      assert.equal(mediaSent[0].payload.type, 'file');
      assert.equal(mediaSent[0].payload.absPath, '/abs/uploads/report.pdf');
    });

    it('resolves absPath via mediaPathResolver for file blocks', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => {
          if (url.startsWith('/uploads/')) return `/abs/path${url}`;
          return undefined;
        },
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/doc.docx', fileName: 'doc.docx' }];
      await hook.deliver('thread-abc', 'Doc attached', 'opus', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.absPath, '/abs/path/uploads/doc.docx');
    });

    it('does not call sendMedia when adapter lacks sendMedia', async () => {
      const richSent = [];
      const noMediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', noMediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: 'report.pdf' }];
      // Should not throw
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);
      assert.equal(richSent.length, 1, 'should fall back to sendRichMessage');
    });

    // P0 security: when resolver fails, do NOT pass raw url to adapter
    it('does not pass unresolved url to sendMedia (prevents file exfiltration)', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: () => undefined, // resolver rejects all paths
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/secret.pdf', fileName: 'secret.pdf' }];
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);

      // File blocks should ONLY be sent when resolver succeeds (unlike images which have URL fallback)
      assert.equal(mediaSent.length, 0, 'file block must not be sent when resolver fails');
    });

    // P2: fileName should be passed through to adapter
    it('passes fileName to sendMedia for file blocks', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => `/abs${url}`,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: '调研报告.pdf' }];
      await hook.deliver('thread-abc', 'Report', 'opus', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.fileName, '调研报告.pdf', 'fileName should be passed through');
    });
  });

  describe('F134 replyToSender regression (P1 fixes)', () => {
    it('passes replyToSender metadata when messageLookup returns source.sender (AC-C1)', async () => {
      const messageLookup = async (_id) => ({
        source: { sender: { id: 'ou_abc123', name: 'Alice' } },
      });
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'group-chat-1', 'thread-grp', 'user-1');

      await hook.deliver('thread-grp', 'Reply', 'opus', undefined, undefined, undefined, 'msg-456');

      assert.equal(feishuMock.sent.length, 1);
      assert.deepEqual(feishuMock.sent[0].metadata, {
        replyToSender: { id: 'ou_abc123', name: 'Alice' },
      });
    });

    it('does NOT pass replyToSender when source has no sender — DM path (AC-C2)', async () => {
      const messageLookup = async (_id) => ({
        source: { connector: 'feishu', label: '飞书' },
      });
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-dm', 'thread-dm', 'user-1');

      await hook.deliver('thread-dm', 'DM reply', 'opus', undefined, undefined, undefined, 'msg-dm-1');

      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'DM replies must not include replyToSender');
    });

    it('does NOT call messageLookup when triggerMessageId is undefined', async () => {
      let lookupCalled = false;
      const messageLookup = async (_id) => {
        lookupCalled = true;
        return { source: { sender: { id: 'ou_xyz', name: 'Bob' } } };
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Reply without trigger');

      assert.equal(lookupCalled, false, 'messageLookup must not be called when triggerMessageId is undefined');
      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'no replyToSender without triggerMessageId');
    });

    it('does NOT pass replyToSender when messageLookup throws (graceful degradation)', async () => {
      const messageLookup = async (_id) => {
        throw new Error('Redis connection lost');
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Reply', 'opus', undefined, undefined, undefined, 'msg-err');

      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'failed lookup should not produce replyToSender');
    });
  });

  // F151: delivery serialization — fire-and-forget calls must preserve chronological order
  describe('per-thread delivery serialization', () => {
    it('concurrent fire-and-forget delivers arrive in call order', async () => {
      const order = [];
      const slowAdapter = {
        connectorId: 'feishu',
        async sendReply(_chatId, content) {
          // Simulate variable async delay — earlier calls are slower
          const delay = content === 'first' ? 50 : content === 'second' ? 30 : 10;
          await new Promise((r) => setTimeout(r, delay));
          order.push(content);
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', slowAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      // Fire-and-forget: call deliver() without awaiting (like callbacks.ts does)
      const p1 = hook.deliver('thread-1', 'first');
      const p2 = hook.deliver('thread-1', 'second');
      const p3 = hook.deliver('thread-1', 'third');
      await Promise.all([p1, p2, p3]);

      assert.deepEqual(order, ['first', 'second', 'third'], 'deliveries must complete in call order');
    });

    it('different threads are not serialized against each other', async () => {
      const order = [];
      const trackAdapter = {
        connectorId: 'feishu',
        async sendReply(_chatId, content) {
          order.push(content);
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', trackAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-A', 'user-1');
      bindingStore.bind('feishu', 'chat-2', 'thread-B', 'user-1');

      await Promise.all([
        hook.deliver('thread-A', 'A1'),
        hook.deliver('thread-B', 'B1'),
        hook.deliver('thread-A', 'A2'),
      ]);

      // A1 before A2 guaranteed; B1 can be anywhere
      const aOrder = order.filter((x) => x.startsWith('A'));
      assert.deepEqual(aOrder, ['A1', 'A2']);
    });

    it('a failed delivery does not block subsequent deliveries', async () => {
      let callCount = 0;
      const failOnceAdapter = {
        connectorId: 'feishu',
        async sendReply(_chatId, content) {
          callCount++;
          if (content === 'fail') throw new Error('boom');
          feishuMock.sent.push({ content });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', failOnceAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      // First delivery fails, second should still succeed
      const p1 = hook.deliver('thread-1', 'fail').catch(() => {});
      const p2 = hook.deliver('thread-1', 'success');
      await Promise.all([p1, p2]);

      assert.equal(callCount, 2, 'both deliveries should have been attempted');
      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].content, 'success');
    });

    it('hung adapter does not block subsequent deliveries (HOL timeout)', async () => {
      const order = [];
      let releaseHang;
      const hangAdapter = {
        connectorId: 'feishu',
        async sendReply(_chatId, content) {
          if (content === 'hang') {
            await new Promise((r) => {
              releaseHang = r;
            });
            return; // don't push to order after release
          }
          order.push(content);
        },
      };
      // Use a short chainTimeoutMs for fast test execution
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', hangAdapter]]),
        log: noopLog(),
        chainTimeoutMs: 200,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      const p1 = hook.deliver('thread-1', 'hang').catch(() => {});
      const p2 = hook.deliver('thread-1', 'after-hang').catch(() => {});
      await Promise.all([p1, p2]);

      assert.deepEqual(order, ['after-hang'], 'delivery after hung adapter should proceed');
      // Release the hung promise so the test process exits cleanly
      releaseHang?.();
    });

    it('chain entry is cleaned up after last delivery settles (CAS)', async () => {
      const trackAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', trackAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'msg');
      // After delivery settles, the CAS cleanup microtask should have run
      await new Promise((r) => setTimeout(r, 10));

      // Access private Map via bracket notation for test verification
      const chains = hook['deliveryChains'];
      assert.equal(chains.has('thread-1'), false, 'chain entry should be cleaned up after settling');
    });
  });
});
