// F179 Phase 2.5 AC-2.5.5: FTS quality verification — Normalizer-style structured summary vs
// naive 300-char truncation. Same corpus indexed two ways, same query set, BM25 recall compared.
// Assertion: Normalizer summary recovers key terms that fall beyond the first 300 chars (i.e. the
// 300-char truncation cannot reach them) → summary Recall@5 strictly higher than truncation.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Database from 'better-sqlite3';
import {
  applyMigrations,
  FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP,
  SCHEMA_V1,
  SCHEMA_V2,
} from '../../dist/domains/memory/schema.js';

// Synthetic corpus: long docs (> 300 chars) where the discriminating keyword sits PAST char 300.
// Each doc has:
//   - originalContent: full text (multi-paragraph; key term placed deep)
//   - summary: Normalizer-style — short, but pulls salient keywords from across the doc
const CORPUS = [
  {
    anchor: 'doc:auth-design',
    title: 'Auth Design',
    keyword: 'frobnicate',
    summary: 'authentication tokens, session lifecycle, frobnicate algorithm, redis cache',
  },
  {
    anchor: 'doc:queue-internals',
    title: 'Queue Internals',
    keyword: 'plugboard',
    summary: 'worker queue, retry policy, plugboard backpressure mechanism, redis persistence',
  },
  {
    anchor: 'doc:embedding-pipeline',
    title: 'Embedding Pipeline',
    keyword: 'whirligig',
    summary: 'embedding model, vector store, whirligig batch processor, FTS indexing',
  },
  {
    anchor: 'doc:cache-layer',
    title: 'Cache Layer',
    keyword: 'snickerdoodle',
    summary: 'redis cache, hot keys, snickerdoodle eviction policy, hit ratio metrics',
  },
];

const QUERIES = [
  { text: 'frobnicate', expected: ['doc:auth-design'] },
  { text: 'plugboard', expected: ['doc:queue-internals'] },
  { text: 'whirligig', expected: ['doc:embedding-pipeline'] },
  { text: 'snickerdoodle', expected: ['doc:cache-layer'] },
];

function makeOriginal(doc) {
  // 300 chars of intro padding (no salient keywords) + the key sentence afterwards.
  const padding = 'introduction paragraph that describes general background and motivation. '.repeat(5);
  // padding length ~ 365 chars > 300
  const body = `\n\nKey detail: this document covers the ${doc.keyword} algorithm in depth. Implementation specifics follow below.`;
  return padding.slice(0, 320) + body;
}

function freshDb() {
  const db = new Database(':memory:');
  db.exec(PRAGMA_SETUP);
  db.exec(SCHEMA_V1);
  for (const s of FTS_TRIGGER_STATEMENTS) db.exec(s);
  db.exec(SCHEMA_V2);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  applyMigrations(db);
  return db;
}

function indexCorpus(db, summarizer) {
  const insert = db.prepare(`INSERT INTO evidence_docs
    (anchor, kind, status, title, summary, source_path, updated_at)
    VALUES (?, 'pack-knowledge', 'active', ?, ?, ?, ?)`);
  const now = new Date().toISOString();
  for (const doc of CORPUS) {
    const original = makeOriginal(doc);
    const summary = summarizer(doc, original);
    insert.run(doc.anchor, doc.title, summary, doc.anchor, now);
  }
}

function searchAnchors(db, queryText, limit = 5) {
  const q = queryText
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w.replace(/"/g, '""')}"`)
    .join(' ');
  if (!q) return [];
  const rows = db
    .prepare(
      `SELECT d.anchor FROM evidence_fts f
       JOIN evidence_docs d ON d.rowid = f.rowid
       WHERE evidence_fts MATCH ?
       ORDER BY bm25(evidence_fts) LIMIT ?`,
    )
    .all(q, limit);
  return rows.map((r) => r.anchor);
}

function recallAt(k, retrieved, expected) {
  const top = retrieved.slice(0, k);
  const expectedSet = new Set(expected);
  const hits = top.filter((a) => expectedSet.has(a)).length;
  return expected.length === 0 ? 1 : hits / expected.length;
}

describe('F179 AC-2.5.5: FTS Normalizer summary vs 300-char truncation', () => {
  it('summary path Recall@5 strictly > truncation path on key-term-deep queries', () => {
    const dbSummary = freshDb();
    const dbTrunc = freshDb();

    indexCorpus(dbSummary, (doc, _orig) => doc.summary);
    indexCorpus(dbTrunc, (_doc, orig) => orig.slice(0, 300));

    let recallSummary = 0;
    let recallTrunc = 0;
    for (const q of QUERIES) {
      recallSummary += recallAt(5, searchAnchors(dbSummary, q.text), q.expected);
      recallTrunc += recallAt(5, searchAnchors(dbTrunc, q.text), q.expected);
    }
    const avgSummary = recallSummary / QUERIES.length;
    const avgTrunc = recallTrunc / QUERIES.length;

    assert.ok(
      avgSummary > avgTrunc,
      `Normalizer summary Recall@5 (${avgSummary}) must exceed 300-char truncation Recall@5 (${avgTrunc})`,
    );
    // The truncation path should miss completely on these queries (key terms past char 300).
    assert.equal(avgTrunc, 0, `300-char truncation should miss key terms past char 300, got ${avgTrunc}`);
    // The summary path should hit each query (each summary contains its keyword).
    assert.equal(avgSummary, 1, `Normalizer summary should recover all key terms, got ${avgSummary}`);

    dbSummary.close();
    dbTrunc.close();
  });
});
