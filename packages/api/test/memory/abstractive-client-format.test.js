import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

const baseInput = {
  previousSummary: null,
  messages: [
    { id: 'msg-1', content: '讨论知识数据源方案', catId: 'opus', timestamp: Date.now() - 60000 },
    { id: 'msg-2', content: '同意用 YAML', timestamp: Date.now() },
  ],
  threadId: 'thread_format_test',
};

const MOCK_ANTHROPIC_RESPONSE = {
  ok: true,
  json: async () => ({
    content: [{ type: 'text', text: '# Test Summary\n\nSummary of the discussion about data sources.' }],
  }),
};

const MOCK_OPENAI_RESPONSE = {
  ok: true,
  json: async () => ({
    choices: [{ message: { content: '# Test Summary\n\nSummary of the discussion about data sources.' } }],
  }),
};

describe('createAbstractiveClient format dispatch', () => {
  it('openai format sends to /v1/chat/completions with Bearer auth', async () => {
    const { createAbstractiveClient } = await import('../../dist/domains/memory/AbstractiveSummaryClient.js');
    const calls = [];
    const mockFetch = mock.fn(async (url, opts) => {
      calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
      return MOCK_OPENAI_RESPONSE;
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const client = createAbstractiveClient(
        async () => ({ mode: 'api_key', baseUrl: 'https://relay.example', apiKey: 'sk-test', format: 'openai', model: 'gpt-4o' }),
        { info: () => {}, error: () => {} },
      );
      const result = await client(baseInput);
      assert.ok(result);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes('/v1/chat/completions'));
      assert.equal(calls[0].headers.Authorization, 'Bearer sk-test');
      assert.equal(calls[0].body.model, 'gpt-4o');
      assert.ok(calls[0].body.messages.some((m) => m.role === 'system'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('anthropic format sends to /v1/messages with x-api-key', async () => {
    const { createAbstractiveClient } = await import('../../dist/domains/memory/AbstractiveSummaryClient.js');
    const calls = [];
    const mockFetch = mock.fn(async (url, opts) => {
      calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
      return MOCK_ANTHROPIC_RESPONSE;
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const client = createAbstractiveClient(
        async () => ({ mode: 'api_key', baseUrl: 'https://api.anthropic.com', apiKey: 'ant-key', format: 'anthropic' }),
        { info: () => {}, error: () => {} },
      );
      const result = await client(baseInput);
      assert.ok(result);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes('/v1/messages'));
      assert.equal(calls[0].headers['x-api-key'], 'ant-key');
      assert.ok(calls[0].body.system);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('openai format with missing choices returns null', async () => {
    const { createAbstractiveClient } = await import('../../dist/domains/memory/AbstractiveSummaryClient.js');
    const mockFetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [] }),
    }));
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const errors = [];
      const client = createAbstractiveClient(
        async () => ({ mode: 'api_key', baseUrl: 'https://relay.example', apiKey: 'sk-test', format: 'openai', model: 'gpt-4o' }),
        { info: () => {}, error: (m) => errors.push(m) },
      );
      const result = await client(baseInput);
      assert.equal(result, null);
      assert.ok(errors.some((e) => e.includes('no text')));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('invalid format returns null with error log', async () => {
    const { createAbstractiveClient } = await import('../../dist/domains/memory/AbstractiveSummaryClient.js');
    const errors = [];
    const client = createAbstractiveClient(
      async () => ({ mode: 'api_key', baseUrl: 'https://example.com', apiKey: 'key', format: 'open-ai' }),
      { info: () => {}, error: (m) => errors.push(m) },
    );
    const result = await client(baseInput);
    assert.equal(result, null);
    assert.ok(errors.some((e) => e.includes('invalid API format')));
  });

  it('default format (undefined) falls back to anthropic', async () => {
    const { createAbstractiveClient } = await import('../../dist/domains/memory/AbstractiveSummaryClient.js');
    const calls = [];
    const mockFetch = mock.fn(async (url, opts) => {
      calls.push({ url });
      return MOCK_ANTHROPIC_RESPONSE;
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const client = createAbstractiveClient(
        async () => ({ mode: 'api_key', baseUrl: 'https://api.anthropic.com', apiKey: 'key' }),
        { info: () => {}, error: () => {} },
      );
      await client(baseInput);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes('/v1/messages'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
