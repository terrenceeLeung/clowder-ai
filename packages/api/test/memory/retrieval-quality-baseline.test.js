// F179 Phase 2.5 AC-2.5.4: Retrieval quality baseline.
// Loads a fixed corpus + query set, computes Recall@5 / Precision@5 across modes
// (lexical / semantic / hybrid), with and without packId. Asserts relative invariants
// so the test is robust across embedding implementations:
//   - hybrid Recall >= max(lexical, semantic) on the mixed query set
//   - packId-scoped recall does not drop versus unscoped on intra-pack queries
//   - cross-pack docs never leak under packId filter

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'retrieval-quality', 'corpus.json');

function recallAt(k, retrieved, expected) {
  const top = retrieved.slice(0, k);
  const expectedSet = new Set(expected);
  const hits = top.filter((a) => expectedSet.has(a)).length;
  return expected.length === 0 ? 1 : hits / expected.length;
}

function precisionAt(k, retrieved, expected) {
  const top = retrieved.slice(0, k);
  const expectedSet = new Set(expected);
  const hits = top.filter((a) => expectedSet.has(a)).length;
  return top.length === 0 ? 0 : hits / top.length;
}

async function setupStoreWithFixture() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
  const VEC_DIM = fixture.vocabulary.length;

  const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
  const store = new SqliteEvidenceStore(':memory:');
  await store.initialize();
  const db = store.getDb();

  sqliteVec.load(db);
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS passage_vectors USING vec0(passage_id TEXT PRIMARY KEY, embedding float[${VEC_DIM}])`,
  );
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS evidence_vectors USING vec0(anchor TEXT PRIMARY KEY, embedding float[${VEC_DIM}])`,
  );

  // Insert docs + passages
  const now = new Date().toISOString();
  for (const doc of fixture.docs) {
    await store.upsert([
      {
        anchor: doc.anchor,
        kind: 'pack-knowledge',
        status: 'active',
        title: doc.title,
        summary: doc.summary,
        updatedAt: now,
        packId: doc.packId,
      },
    ]);
    db.prepare("UPDATE evidence_docs SET governance_status = 'active' WHERE anchor = ?").run(doc.anchor);

    const insP = db.prepare(`INSERT INTO evidence_passages
      (doc_anchor, passage_id, content, position, created_at, passage_kind)
      VALUES (?, ?, ?, ?, ?, 'domain_chunk')`);
    const insV = db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)');
    let pos = 0;
    for (const chunk of doc.chunks) {
      insP.run(doc.anchor, chunk.id, chunk.content, pos, now);
      insV.run(chunk.id, new Float32Array(chunk.vector));
      pos++;
    }
  }

  // Build a deterministic query→vector map so the mock embedder can return the right vector.
  const queryVecMap = new Map();
  for (const q of fixture.queries) {
    queryVecMap.set(q.text, new Float32Array(q.queryVector));
  }
  store.setEmbedDeps({
    embedding: {
      isReady: () => true,
      embed: async (texts) => texts.map((t) => queryVecMap.get(t) ?? new Float32Array(VEC_DIM)),
      getModelInfo: () => ({ modelId: 'fixture-mock', modelRev: '1', dim: VEC_DIM }),
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

  return { store, db, fixture, VEC_DIM };
}

describe('F179 AC-2.5.4: retrieval quality baseline', () => {
  it('hybrid Recall@5 >= max(lexical, semantic) on the mixed query set', async () => {
    const { store, fixture } = await setupStoreWithFixture();

    const sums = { lexical: 0, semantic: 0, hybrid: 0 };
    for (const q of fixture.queries) {
      for (const mode of ['lexical', 'semantic', 'hybrid']) {
        const results = await store.search(q.text, {
          depth: 'raw',
          mode,
          limit: 5,
          packId: 'retrieval-pack',
        });
        const anchors = results.map((r) => r.anchor);
        sums[mode] += recallAt(5, anchors, q.expectedAnchors);
      }
    }
    const avg = {
      lexical: sums.lexical / fixture.queries.length,
      semantic: sums.semantic / fixture.queries.length,
      hybrid: sums.hybrid / fixture.queries.length,
    };

    // Hybrid is supposed to be >= max(lexical, semantic). Allow small floating slack.
    const SLACK = 1e-9;
    assert.ok(avg.hybrid + SLACK >= avg.lexical, `avg Recall@5 hybrid (${avg.hybrid}) < lexical (${avg.lexical})`);
    assert.ok(avg.hybrid + SLACK >= avg.semantic, `avg Recall@5 hybrid (${avg.hybrid}) < semantic (${avg.semantic})`);

    // Sanity: hybrid average recall is non-trivial (corpus is built so >= 0.5 is achievable).
    assert.ok(avg.hybrid >= 0.5, `hybrid Recall@5 too low: ${avg.hybrid}`);
  });

  it('packId filter does not reduce intra-pack recall', async () => {
    const { store, fixture } = await setupStoreWithFixture();

    let withPack = 0;
    let withoutPack = 0;
    for (const q of fixture.queries) {
      const scoped = await store.search(q.text, { depth: 'raw', mode: 'hybrid', limit: 5, packId: 'retrieval-pack' });
      const unscoped = await store.search(q.text, { depth: 'raw', mode: 'hybrid', limit: 5 });
      withPack += recallAt(
        5,
        scoped.map((r) => r.anchor),
        q.expectedAnchors,
      );
      withoutPack += recallAt(
        5,
        unscoped.map((r) => r.anchor),
        q.expectedAnchors,
      );
    }
    const avgScoped = withPack / fixture.queries.length;
    const avgUnscoped = withoutPack / fixture.queries.length;

    // Scoped recall should not drop below unscoped (the only difference is filtering out
    // cross-pack docs which are never expected hits in this fixture).
    assert.ok(
      avgScoped + 1e-9 >= avgUnscoped,
      `packId-scoped recall (${avgScoped}) < unscoped recall (${avgUnscoped})`,
    );
  });

  it('cross-pack docs never leak under packId filter (packId precision check)', async () => {
    const { store, fixture } = await setupStoreWithFixture();

    let leaks = 0;
    for (const q of fixture.queries) {
      const results = await store.search(q.text, { depth: 'raw', mode: 'hybrid', limit: 5, packId: 'retrieval-pack' });
      for (const r of results) {
        if (!r.anchor.startsWith('dk:retrieval-pack:')) leaks++;
      }
    }
    assert.equal(leaks, 0, `cross-pack docs leaked into packId-scoped results: ${leaks}`);
  });

  it('Recall@5 / Precision@5 regression floors per mode (CI baseline)', async () => {
    const { store, fixture } = await setupStoreWithFixture();

    function f1(p, r) {
      return p + r === 0 ? 0 : (2 * p * r) / (p + r);
    }

    const acc = {
      lexical: { recall: 0, precision: 0, f1: 0 },
      semantic: { recall: 0, precision: 0, f1: 0 },
      hybrid: { recall: 0, precision: 0, f1: 0 },
    };
    for (const q of fixture.queries) {
      for (const mode of ['lexical', 'semantic', 'hybrid']) {
        const r = await store.search(q.text, { depth: 'raw', mode, limit: 5, packId: 'retrieval-pack' });
        const anchors = r.map((x) => x.anchor);
        const p = precisionAt(5, anchors, q.expectedAnchors);
        const rec = recallAt(5, anchors, q.expectedAnchors);
        acc[mode].precision += p;
        acc[mode].recall += rec;
        acc[mode].f1 += f1(p, rec);
      }
    }
    const n = fixture.queries.length;
    const summary = {
      lexical: { recall: acc.lexical.recall / n, precision: acc.lexical.precision / n, f1: acc.lexical.f1 / n },
      semantic: { recall: acc.semantic.recall / n, precision: acc.semantic.precision / n, f1: acc.semantic.f1 / n },
      hybrid: { recall: acc.hybrid.recall / n, precision: acc.hybrid.precision / n, f1: acc.hybrid.f1 / n },
    };

    // Regression floors — trip if quality drops below these. Numbers calibrated to current
    // fixture/algorithms; raise them only after a confirmed quality improvement.
    const FLOORS = {
      lexical: { recall: 0.6, precision: 0.6, f1: 0.6 },
      semantic: { recall: 0.4, precision: 0.3, f1: 0.4 },
      hybrid: { recall: 0.6, precision: 0.3, f1: 0.5 },
    };
    for (const mode of ['lexical', 'semantic', 'hybrid']) {
      assert.ok(
        summary[mode].recall + 1e-9 >= FLOORS[mode].recall,
        `${mode} Recall@5 ${summary[mode].recall} below floor ${FLOORS[mode].recall}`,
      );
      assert.ok(
        summary[mode].precision + 1e-9 >= FLOORS[mode].precision,
        `${mode} Precision@5 ${summary[mode].precision} below floor ${FLOORS[mode].precision}`,
      );
      assert.ok(
        summary[mode].f1 + 1e-9 >= FLOORS[mode].f1,
        `${mode} F1@5 ${summary[mode].f1} below floor ${FLOORS[mode].f1}`,
      );
    }
  });
});
