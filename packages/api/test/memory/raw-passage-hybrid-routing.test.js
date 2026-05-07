// F179 Phase 2.5 AC-2.5.1: depth=raw + mode=hybrid/semantic routes to searchPassagesHybrid().
// Vector-only passage matches (BM25 misses, vec0 hits) must surface in raw-depth searches when
// embedding is available; lexical mode keeps the old BM25-only behavior.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import * as sqliteVec from 'sqlite-vec';

describe('F179 AC-2.5.1: depth=raw routes to searchPassagesHybrid for hybrid/semantic', () => {
  let store;
  let db;
  const VEC_DIM = 3;

  function setupVecMockEmbed(targetVec) {
    store.setEmbedDeps({
      embedding: {
        isReady: () => true,
        embed: async () => [targetVec],
        getModelInfo: () => ({ modelId: 'mock', modelRev: '1', dim: VEC_DIM }),
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
  }

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();
    // Load sqlite-vec + create passage_vectors table so vec0 hits actually go through.
    sqliteVec.load(db);
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS passage_vectors USING vec0(passage_id TEXT PRIMARY KEY, embedding float[${VEC_DIM}])`,
    );

    const now = new Date().toISOString();
    // IMPORTANT: vec-doc must have ZERO BM25 overlap with the test query so that
    // surfacing it requires the passage-level vector path (AC-2.5.1).
    await store.upsert([
      {
        anchor: 'dk:packA:lex-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Tunneling Doc',
        summary: 'tunneling protocol description',
        updatedAt: now,
        packId: 'packA',
      },
      {
        anchor: 'dk:packA:vec-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Alpha Beta Gamma',
        summary: 'qqzx wwzx eezx rrzx',
        updatedAt: now,
        packId: 'packA',
      },
    ]);
    db.prepare("UPDATE evidence_docs SET governance_status = 'active' WHERE anchor LIKE 'dk:packA:%'").run();

    const insertPassage = db.prepare(`INSERT INTO evidence_passages
      (doc_anchor, passage_id, content, position, created_at, passage_kind)
      VALUES (?, ?, ?, ?, ?, 'domain_chunk')`);
    insertPassage.run('dk:packA:lex-doc', 'lex-1', 'tunneling protocol description', 0, now);
    insertPassage.run('dk:packA:vec-doc', 'vec-1', 'qqzx wwzx eezx rrzx ttzx', 0, now);
  });

  it('depth=raw + mode=lexical: BM25 only (no vector path called)', async () => {
    let embedCalled = false;
    store.setEmbedDeps({
      embedding: {
        isReady: () => true,
        embed: async () => {
          embedCalled = true;
          return [new Float32Array(VEC_DIM)];
        },
        getModelInfo: () => ({ modelId: 'mock', modelRev: '1', dim: VEC_DIM }),
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

    const results = await store.search('tunneling', { depth: 'raw', mode: 'lexical', limit: 5, packId: 'packA' });
    assert.equal(embedCalled, false, 'lexical mode must not call embed');
    const lexResult = results.find((r) => r.anchor === 'dk:packA:lex-doc');
    assert.ok(lexResult, 'BM25 hit returned');
    assert.ok(lexResult.passages?.length > 0, 'passages attached to result');
  });

  it('depth=raw + mode=hybrid: vector-only passages also surface', async () => {
    const targetVec = new Float32Array([0.1, 0.2, 0.3]);
    setupVecMockEmbed(targetVec);
    db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('vec-1', targetVec);

    const results = await store.search('tunneling', { depth: 'raw', mode: 'hybrid', limit: 5, packId: 'packA' });
    // BM25 finds lex-1 via 'tunneling'; vec0 nn brings in vec-1 even though BM25 missed it.
    const hasVecOnly = results.some(
      (r) => r.anchor === 'dk:packA:vec-doc' && r.passages?.some((p) => p.passageId === 'vec-1'),
    );
    assert.ok(hasVecOnly, 'vector-only passage surfaces under hybrid mode at depth=raw');
  });

  it('depth=raw + mode=semantic + packId: BM25 miss + vector hit returns the doc', async () => {
    const targetVec = new Float32Array([0.1, 0.2, 0.3]);
    setupVecMockEmbed(targetVec);
    db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('vec-1', targetVec);

    // Query that BM25 cannot match — no overlap with any title/summary/passage content.
    const results = await store.search('xenobotic floccinaucinihilipilification', {
      depth: 'raw',
      mode: 'semantic',
      limit: 5,
      packId: 'packA',
    });
    const hasVecOnly = results.some((r) => r.anchor === 'dk:packA:vec-doc');
    assert.ok(hasVecOnly, 'mode=semantic surfaces vec-1 even with zero BM25 hits');
  });

  it('depth=raw + mode=hybrid: embedding unavailable → degrades to BM25-only (no error)', async () => {
    // No embedDeps wired
    const results = await store.search('tunneling', { depth: 'raw', mode: 'hybrid', limit: 5, packId: 'packA' });
    assert.ok(Array.isArray(results), 'returns array, not throws');
    const lexResult = results.find((r) => r.anchor === 'dk:packA:lex-doc');
    assert.ok(lexResult, 'BM25 hit still returned during degradation');
  });
});
