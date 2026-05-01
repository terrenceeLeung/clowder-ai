import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';

describe('side question (/btw)', () => {
  it('POST /api/threads/:threadId/side-question returns an answer without appending messages', async () => {
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { messagesRoutes } = await import('../dist/routes/messages.js');

    const messageStore = new MessageStore();
    await messageStore.append({
      userId: 'default-user',
      catId: null,
      content: 'F179 里提到了 F129',
      mentions: [],
      timestamp: 1000,
      threadId: 'thread-1',
    });

    const calls = [];
    const router = {
      async answerSideQuestion(userId, threadId, question) {
        calls.push({ userId, threadId, question });
        return {
          catId: 'codex',
          catDisplayName: '缅因猫',
          answer: 'F129 是 pack system。',
          contextMessageCount: 1,
          contextEstimatedTokens: 42,
          toolUseBlocked: false,
        };
      },
    };

    const app = Fastify();
    await app.register(messagesRoutes, {
      registry: new InvocationRegistry(),
      messageStore,
      socketManager: { broadcastAgentMessage: () => {} },
      router,
    });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/side-question',
      headers: { 'content-type': 'application/json' },
      payload: { question: 'F129 是什么？' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.answer, 'F129 是 pack system。');
    assert.equal(body.catId, 'codex');
    assert.equal(body.catDisplayName, '缅因猫');
    assert.deepEqual(calls, [{ userId: 'default-user', threadId: 'thread-1', question: 'F129 是什么？' }]);

    const stored = await messageStore.getByThread('thread-1', 10, 'default-user');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].content, 'F179 里提到了 F129');

    await app.close();
  });

  it('AgentRouter.answerSideQuestion enables readonly MCP tools (not disabled)', async () => {
    const { AgentRegistry } = await import('../dist/domains/cats/services/agents/registry/AgentRegistry.js');
    const { AgentRouter } = await import('../dist/domains/cats/services/agents/routing/AgentRouter.js');
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');

    const serviceCalls = [];
    const codexService = {
      async *invoke(prompt, options) {
        serviceCalls.push({ prompt, options });
        yield { type: 'text', catId: 'codex', content: 'F129 是 pack system。', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      },
    };
    const agentRegistry = new AgentRegistry();
    agentRegistry.register('codex', codexService);
    const messageStore = new MessageStore();
    await messageStore.append({
      userId: 'default-user',
      catId: null,
      content: '我们在聊 F179，遇到了 F129 的知识。',
      mentions: [],
      timestamp: 1000,
      threadId: 'thread-1',
    });

    const router = new AgentRouter({
      agentRegistry,
      registry: new InvocationRegistry(),
      messageStore,
    });

    const result = await router.answerSideQuestion('default-user', 'thread-1', '@codex F129 是什么？');

    assert.equal(result.answer, 'F129 是 pack system。');
    assert.equal(result.catId, 'codex');
    assert.equal(serviceCalls.length, 1);

    const opts = serviceCalls[0].options;
    // Tools should NOT be disabled — readonly MCP tools are allowed
    assert.notEqual(opts.disableTools, true, 'disableTools must not be true');
    assert.notEqual(opts.disableMcp, true, 'disableMcp must not be true');
    // CAT_CAFE_READONLY must be set so MCP server filters to read-only allowlist
    assert.equal(opts.callbackEnv?.CAT_CAFE_READONLY, 'true', 'callbackEnv must set CAT_CAFE_READONLY');
    // Sandbox and approval still constrained
    assert.equal(opts.sandboxMode, 'read-only');
    assert.equal(opts.approvalPolicy, 'never');
    assert.equal(opts.ephemeral, true);
    // System prompt should mention readonly tools, not "禁止调用工具"
    assert.match(opts.systemPrompt, /只读/);
    assert.doesNotMatch(opts.systemPrompt, /不要调用工具/);
    // Still no session resume
    assert.equal(opts.sessionId, undefined);

    // No message persistence
    const stored = await messageStore.getByThread('thread-1', 10, 'default-user');
    assert.equal(stored.length, 1);
  });

  it('AgentRouter.answerSideQuestion does NOT abort on tool_use messages', async () => {
    const { AgentRegistry } = await import('../dist/domains/cats/services/agents/registry/AgentRegistry.js');
    const { AgentRouter } = await import('../dist/domains/cats/services/agents/routing/AgentRouter.js');
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');

    const agentRegistry = new AgentRegistry();
    agentRegistry.register('codex', {
      async *invoke() {
        // Simulate model calling a read-only tool, then answering
        yield { type: 'tool_use', catId: 'codex', toolName: 'cat_cafe_search_evidence', timestamp: Date.now() };
        yield { type: 'tool_result', catId: 'codex', content: 'F129 是 pack system', timestamp: Date.now() };
        yield { type: 'text', catId: 'codex', content: '根据搜索结果：F129 是 pack system。', timestamp: Date.now() };
        yield { type: 'done', catId: 'codex', timestamp: Date.now() };
      },
    });

    const router = new AgentRouter({
      agentRegistry,
      registry: new InvocationRegistry(),
      messageStore: new MessageStore(),
    });

    // Should NOT throw — tool_use is expected with readonly MCP
    const result = await router.answerSideQuestion('default-user', 'thread-1', '@codex F129 是什么？');
    assert.equal(result.answer, '根据搜索结果：F129 是 pack system。');
    assert.equal(result.toolUseBlocked, false);
  });
});
