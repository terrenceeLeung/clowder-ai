// F179 Phase 2.5 AC-2.5.3: searchPassages and searchPassagesHybrid add packId + governance filter.
// Cross-pack passages must not leak when packId is set; stale docs' passages must not return.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('F179 AC-2.5.3: passage search packId + governance filter', () => {
  let store;
  let db;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();

    const now = new Date().toISOString();
    await store.upsert([
      {
        anchor: 'dk:packA:doc1',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack A Doc',
        summary: 'doc in pack A',
        updatedAt: now,
        packId: 'packA',
      },
      {
        anchor: 'dk:packB:doc2',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Pack B Doc',
        summary: 'doc in pack B',
        updatedAt: now,
        packId: 'packB',
      },
      {
        anchor: 'dk:packA:stale-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Stale Pack A Doc',
        summary: 'a stale doc in pack A',
        updatedAt: now,
        packId: 'packA',
      },
    ]);

    db.prepare(
      "UPDATE evidence_docs SET governance_status = 'active' WHERE anchor IN ('dk:packA:doc1', 'dk:packB:doc2')",
    ).run();
    db.prepare("UPDATE evidence_docs SET governance_status = 'stale' WHERE anchor = 'dk:packA:stale-doc'").run();

    const insertPassage = db.prepare(`INSERT INTO evidence_passages
      (doc_anchor, passage_id, content, position, created_at, passage_kind)
      VALUES (?, ?, ?, ?, ?, 'domain_chunk')`);

    insertPassage.run('dk:packA:doc1', 'pA-1', 'neural network architecture details', 0, now);
    insertPassage.run('dk:packA:doc1', 'pA-2', 'neural network training procedure', 1, now);
    insertPassage.run('dk:packB:doc2', 'pB-1', 'neural network database schema', 0, now);
    insertPassage.run('dk:packA:stale-doc', 'pA-stale-1', 'stale neural network notes', 0, now);
  });

  it('searchPassages without packId: returns active across packs (excludes stale)', () => {
    const results = store.searchPassages('neural network', 10);
    const ids = results.map((r) => r.passageId);
    assert.ok(ids.includes('pA-1'), 'packA active passage included');
    assert.ok(ids.includes('pB-1'), 'packB active passage included');
    assert.ok(!ids.includes('pA-stale-1'), 'stale passage excluded by governance filter');
  });

  it('searchPassages with packId=packA: only returns packA active passages', () => {
    const results = store.searchPassages('neural network', 10, undefined, { packId: 'packA' });
    const ids = results.map((r) => r.passageId);
    assert.ok(ids.includes('pA-1'), 'packA passage included');
    assert.ok(ids.includes('pA-2'), 'packA second passage included');
    assert.ok(!ids.includes('pB-1'), 'packB passage excluded');
    assert.ok(!ids.includes('pA-stale-1'), 'stale packA passage excluded');
  });

  it('searchPassages with packId=packB: only returns packB passages', () => {
    const results = store.searchPassages('neural network', 10, undefined, { packId: 'packB' });
    const ids = results.map((r) => r.passageId);
    assert.deepEqual(ids.sort(), ['pB-1']);
  });

  it('searchPassagesHybrid with packId=packA: BM25 path excludes packB', async () => {
    // No embedDeps wired → hybrid degrades to BM25-only — but packId filter still applies.
    const results = await store.searchPassagesHybrid('neural network', 10, { packId: 'packA' });
    const ids = results.map((r) => r.passageId);
    assert.ok(ids.includes('pA-1'), 'packA passage included');
    assert.ok(!ids.includes('pB-1'), 'packB passage excluded from hybrid');
    assert.ok(!ids.includes('pA-stale-1'), 'stale passage excluded from hybrid');
  });

  it('searchPassagesHybrid with packId=packA: vector path also filtered', async () => {
    // Inject mock embedDeps so vector path runs.
    const mockVec = new Float32Array([0.1, 0.2, 0.3]);
    store.setEmbedDeps({
      embedding: {
        isReady: () => true,
        embed: async () => [mockVec],
        getModelInfo: () => ({ modelId: 'mock', modelRev: '1', dim: 3 }),
        load: async () => {},
        dispose: () => {},
      },
      vectorStore: {
        upsert: () => {},
        delete: () => {},
        search: () => [],
        initMeta: () => {},
        getMeta: () => ({}),
        checkMetaConsistency: () => ({ consistent: true, reason: 'ok' }),
        clearAll: () => {},
        count: () => 0,
      },
      mode: 'on',
    });

    // Manually populate passage_vectors so vec0 nn returns hits across packs.
    try {
      db.exec(
        'CREATE VIRTUAL TABLE IF NOT EXISTS passage_vectors USING vec0(passage_id TEXT PRIMARY KEY, embedding float[3])',
      );
      const insV = db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)');
      insV.run('pA-1', mockVec);
      insV.run('pB-1', mockVec); // would otherwise rank — packId filter must drop it
      insV.run('pA-stale-1', mockVec); // stale — governance filter must drop it
    } catch {
      // sqlite-vec unavailable on this platform — skip vector assertion
      return;
    }

    const results = await store.searchPassagesHybrid('neural network', 10, { packId: 'packA' });
    const ids = results.map((r) => r.passageId);
    assert.ok(!ids.includes('pB-1'), 'packB vector hit excluded by packId filter');
    assert.ok(!ids.includes('pA-stale-1'), 'stale vector hit excluded by governance filter');
  });
});
