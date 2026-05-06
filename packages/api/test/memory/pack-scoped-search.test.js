import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('Pack-scoped evidence search (AC-205)', () => {
  let store;
  let db;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();

    await store.upsert([
      {
        anchor: 'dk:packA:doc1',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack A Document',
        summary: 'knowledge about cats',
        updatedAt: new Date().toISOString(),
        packId: 'packA',
      },
      {
        anchor: 'dk:packB:doc1',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack B Document',
        summary: 'knowledge about dogs',
        updatedAt: new Date().toISOString(),
        packId: 'packB',
      },
      {
        anchor: 'regular-doc',
        kind: 'feature',
        status: 'active',
        title: 'Regular Feature Doc',
        summary: 'knowledge about features',
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  it('search without packId excludes pack-knowledge', async () => {
    const results = await store.search('knowledge', { limit: 10 });
    const anchors = results.map(r => r.anchor);
    assert.ok(!anchors.includes('dk:packA:doc1'), 'packA doc excluded');
    assert.ok(!anchors.includes('dk:packB:doc1'), 'packB doc excluded');
    assert.ok(anchors.includes('regular-doc'), 'regular doc included');
  });

  it('search with packId returns only that pack docs', async () => {
    const results = await store.search('knowledge', { limit: 10, packId: 'packA' });
    const anchors = results.map(r => r.anchor);
    assert.ok(anchors.includes('dk:packA:doc1'), 'packA doc included');
    assert.ok(!anchors.includes('dk:packB:doc1'), 'packB doc excluded');
  });

  it('search with packId returns empty for non-existent pack', async () => {
    const results = await store.search('knowledge', { limit: 10, packId: 'nonexistent' });
    assert.equal(results.length, 0);
  });

  it('packId filter works via API route', async () => {
    const Fastify = (await import('fastify')).default;
    const { evidenceRoutes } = await import('../../dist/routes/evidence.js');

    const app = Fastify();
    await app.register(evidenceRoutes, { evidenceStore: store });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/search?q=knowledge&packId=packA',
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.degraded, false);
    const anchors = body.results.map(r => r.anchor);
    assert.ok(anchors.some(a => a.includes('packA')), 'packA doc returned via API');
    assert.ok(!anchors.some(a => a.includes('packB')), 'packB doc not returned via API');

    await app.close();
  });
});
