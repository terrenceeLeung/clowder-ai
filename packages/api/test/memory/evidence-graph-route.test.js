import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { evidenceGraphRoutes } from '../../dist/routes/evidence-graph.js';

function createMockStore(overrides = {}) {
  return {
    search: async () => [],
    health: async () => true,
    initialize: async () => {},
    upsert: async () => {},
    deleteByAnchor: async () => {},
    getByAnchor: async () => null,
    ...overrides,
  };
}

const MOCK_MAP = {
  version: 1,
  modules: {
    memory: {
      name: '记忆与知识工程',
      anchors: ['docs/features/F102.md', 'docs/features/F163.md'],
    },
    games: {
      name: '游戏系统',
      anchors: ['docs/features/F090.md'],
    },
  },
};

describe('GET /api/evidence/explore', () => {
  async function setup(storeOverrides = {}) {
    const app = Fastify();
    await app.register(evidenceGraphRoutes, {
      evidenceStore: createMockStore(storeOverrides),
      knowledgeMap: MOCK_MAP,
    });
    await app.ready();
    return app;
  }

  it('returns module overview list', async () => {
    const app = await setup({
      getByAnchor: async (anchor) => ({
        anchor,
        kind: 'feature',
        status: 'active',
        title: anchor,
        updatedAt: '2026-01-01',
      }),
    });

    const res = await app.inject({ method: 'GET', url: '/api/evidence/explore' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.modules.length, 2);
    const mem = body.modules.find((m) => m.id === 'memory');
    assert.equal(mem.name, '记忆与知识工程');
    assert.equal(mem.anchorCount, 2);
    assert.equal(mem.evidenceCount, 2);
  });

  it('counts only anchors with evidence docs', async () => {
    const app = await setup({
      getByAnchor: async (anchor) =>
        anchor.includes('F102')
          ? { anchor, kind: 'feature', status: 'active', title: 'F102', updatedAt: '2026-01-01' }
          : null,
    });

    const res = await app.inject({ method: 'GET', url: '/api/evidence/explore' });
    const body = res.json();
    const mem = body.modules.find((m) => m.id === 'memory');
    assert.equal(mem.anchorCount, 2);
    assert.equal(mem.evidenceCount, 1);
  });
});

describe('GET /api/evidence/graph', () => {
  async function setup(storeOverrides = {}) {
    const app = Fastify();
    await app.register(evidenceGraphRoutes, {
      evidenceStore: createMockStore(storeOverrides),
      knowledgeMap: MOCK_MAP,
    });
    await app.ready();
    return app;
  }

  it('returns module graph with nodes', async () => {
    const app = await setup({
      getByAnchor: async (anchor) => ({
        anchor,
        kind: 'feature',
        status: 'active',
        title: anchor.includes('F102') ? 'Memory Adapter' : 'Entropy Reduction',
        authority: 'validated',
        updatedAt: '2026-04-22',
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=memory',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.module, 'memory');
    assert.equal(body.moduleName, '记忆与知识工程');
    assert.equal(body.nodes.length, 2);
    assert.ok(body.nodes[0].title);
    assert.ok(body.nodes[0].authority);
  });

  it('returns 400 for missing module param', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/evidence/graph' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 for unknown module', async () => {
    const app = await setup();
    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=nonexistent',
    });
    assert.equal(res.statusCode, 404);
  });

  it('skips anchors without evidence docs', async () => {
    const app = await setup({
      getByAnchor: async (anchor) =>
        anchor.includes('F102')
          ? { anchor, kind: 'feature', status: 'active', title: 'F102', updatedAt: '2026-01-01' }
          : null,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=memory',
    });
    const body = res.json();
    assert.equal(body.nodes.length, 1);
    assert.equal(body.nodes[0].title, 'F102');
  });

  it('collects edges within module anchors', async () => {
    const mockDb = {
      prepare: () => ({
        all: (anchor) => {
          if (anchor === 'docs/features/F102.md') {
            return [{ other_anchor: 'docs/features/F163.md', relation: 'related' }];
          }
          return [];
        },
      }),
    };
    const app = await setup({
      getByAnchor: async (anchor) => ({
        anchor,
        kind: 'feature',
        status: 'active',
        title: anchor,
        updatedAt: '2026-01-01',
      }),
      getDb: () => mockDb,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=memory',
    });
    const body = res.json();
    assert.ok(Array.isArray(body.edges));
  });
});
