import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('Pack-scoped search — semantic/hybrid paths (P1 fix)', () => {
  let store;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();

    // Insert pack-knowledge docs
    await store.upsert([
      {
        anchor: 'dk:packA:semantic-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack A Semantic Doc',
        summary: 'knowledge about neural networks',
        updatedAt: new Date().toISOString(),
        packId: 'packA',
      },
      {
        anchor: 'dk:packA:vector-only',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack A Vector Only',
        summary: 'completely unrelated summary xyzzy',
        updatedAt: new Date().toISOString(),
        packId: 'packA',
      },
      {
        anchor: 'dk:packB:other-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack B Other Doc',
        summary: 'knowledge about databases',
        updatedAt: new Date().toISOString(),
        packId: 'packB',
      },
    ]);

    // Mock embedDeps: fake embedding + vector store
    // Returns packA docs (one found by lexical, one vector-only) + packB doc
    const mockEmbedDeps = {
      embedding: {
        isReady: () => true,
        embed: async () => [new Float32Array([0.1, 0.2, 0.3])],
        getModelInfo: () => ({ modelId: 'mock', modelRev: '1', dim: 3 }),
        load: async () => {},
        dispose: () => {},
      },
      vectorStore: {
        search: () => [
          { anchor: 'dk:packA:semantic-doc', distance: 0.1 },
          { anchor: 'dk:packA:vector-only', distance: 0.15 },
          { anchor: 'dk:packB:other-doc', distance: 0.2 },
        ],
      },
      mode: 'on',
    };

    store.setEmbedDeps(mockEmbedDeps);
  });

  it('mode=semantic with packId returns pack-knowledge docs', async () => {
    const results = await store.search('neural networks', {
      limit: 10,
      mode: 'semantic',
      packId: 'packA',
    });
    const anchors = results.map((r) => r.anchor);
    assert.ok(anchors.includes('dk:packA:semantic-doc'), 'packA doc should be returned in semantic mode');
    assert.ok(!anchors.includes('dk:packB:other-doc'), 'packB doc should be excluded');
  });

  it('mode=semantic without packId excludes pack-knowledge', async () => {
    const results = await store.search('neural networks', {
      limit: 10,
      mode: 'semantic',
    });
    const anchors = results.map((r) => r.anchor);
    assert.ok(!anchors.includes('dk:packA:semantic-doc'), 'packA doc excluded from global semantic');
    assert.ok(!anchors.includes('dk:packB:other-doc'), 'packB doc excluded from global semantic');
  });

  it('mode=hybrid with packId returns pack-knowledge docs including vector-only hits', async () => {
    const results = await store.search('neural networks', {
      limit: 10,
      mode: 'hybrid',
      packId: 'packA',
    });
    const anchors = results.map((r) => r.anchor);
    assert.ok(anchors.includes('dk:packA:semantic-doc'), 'packA lexical+vector doc returned');
    assert.ok(anchors.includes('dk:packA:vector-only'), 'packA vector-only doc returned via NN hydration');
    assert.ok(!anchors.includes('dk:packB:other-doc'), 'packB doc excluded in hybrid');
  });

  it('mode=hybrid without packId excludes pack-knowledge', async () => {
    const results = await store.search('neural networks', {
      limit: 10,
      mode: 'hybrid',
    });
    const anchors = results.map((r) => r.anchor);
    assert.ok(!anchors.includes('dk:packA:semantic-doc'), 'packA doc excluded from global hybrid');
  });
});
