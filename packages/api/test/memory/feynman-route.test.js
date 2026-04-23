import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { feynmanRoutes } from '../../dist/routes/feynman.js';

const MOCK_MAP = {
  version: 1,
  modules: {
    memory: {
      name: '记忆与知识工程',
      description: '记忆存储与检索',
      anchors: ['docs/features/F102.md', 'docs/features/F163.md'],
    },
    games: {
      name: '游戏系统',
      anchors: ['docs/features/F090.md'],
    },
  },
};

function createMockThreadStore() {
  const threads = new Map();
  let counter = 0;
  return {
    create: async (userId, title) => {
      counter++;
      const id = `thread-${counter}`;
      const thread = { id, userId, title, createdAt: Date.now() };
      threads.set(id, thread);
      return thread;
    },
    get: async (id) => threads.get(id) ?? null,
    list: async () => [...threads.values()],
    updateFeynmanState: async (id, state) => {
      const t = threads.get(id);
      if (t) t.feynmanState = state;
    },
  };
}

describe('POST /api/feynman/start', () => {
  async function setup() {
    const threadStore = createMockThreadStore();
    const app = Fastify();
    await app.register(feynmanRoutes, { threadStore, knowledgeMap: MOCK_MAP });
    await app.ready();
    return { app, threadStore };
  }

  it('creates a feynman thread for valid module', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      headers: { 'x-cat-cafe-user': 'user1' },
      payload: { module: 'memory' },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.reused, false);
    assert.equal(body.thread.feynmanState.module, 'memory');
    assert.equal(body.thread.feynmanState.status, 'active');
    assert.deepEqual(body.thread.feynmanState.anchors, MOCK_MAP.modules.memory.anchors);
  });

  it('returns 404 for unknown module', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      headers: { 'x-cat-cafe-user': 'user1' },
      payload: { module: 'nonexistent' },
    });
    assert.equal(res.statusCode, 404);
  });

  it('returns existing thread for same module (AC-A2-5)', async () => {
    const { app } = await setup();
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      headers: { 'x-cat-cafe-user': 'user1' },
      payload: { module: 'memory' },
    });
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.reused, false);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      headers: { 'x-cat-cafe-user': 'user1' },
      payload: { module: 'memory' },
    });
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.reused, true);
    assert.equal(body2.thread.id, body1.thread.id);
  });

  it('returns 401 without user identity', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      payload: { module: 'memory' },
    });
    assert.equal(res.statusCode, 401);
  });

  it('rejects prototype-polluting module ids', async () => {
    const { app } = await setup();
    for (const bad of ['__proto__', 'constructor', 'toString']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/feynman/start',
        headers: { 'x-cat-cafe-user': 'user1' },
        payload: { module: bad },
      });
      assert.ok([400, 404].includes(res.statusCode), `${bad} should be rejected (got ${res.statusCode})`);
    }
  });

  it('rejects module ids with special characters', async () => {
    const { app } = await setup();
    for (const bad of ['../etc', 'foo bar', 'a\nb']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/feynman/start',
        headers: { 'x-cat-cafe-user': 'user1' },
        payload: { module: bad },
      });
      assert.equal(res.statusCode, 400, `${JSON.stringify(bad)} should be rejected`);
    }
  });
});

describe('GET /api/feynman/threads', () => {
  it('lists feynman threads', async () => {
    const threadStore = createMockThreadStore();
    const app = Fastify();
    await app.register(feynmanRoutes, { threadStore, knowledgeMap: MOCK_MAP });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/api/feynman/start',
      headers: { 'x-cat-cafe-user': 'user1' },
      payload: { module: 'memory' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/feynman/threads',
      headers: { 'x-cat-cafe-user': 'user1' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.threads.length, 1);
    assert.equal(body.threads[0].module, 'memory');
    assert.equal(body.threads[0].status, 'active');
  });
});
