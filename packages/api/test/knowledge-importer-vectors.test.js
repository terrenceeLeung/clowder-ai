// F179 Phase 2.5 AC-2.5.2: KnowledgeImporter writes evidence_vectors + passage_vectors on import.
// Root-cause fix for the asymmetry where pack-knowledge was indexed in 5/6 tables,
// missing the two vector tables (because embedder was never wired into KnowledgeImporter).

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { DomainPackManager } from '../dist/domains/knowledge/DomainPackManager.js';
import { GovernanceStateMachine } from '../dist/domains/knowledge/GovernanceStateMachine.js';
import { KnowledgeImporter } from '../dist/domains/knowledge/KnowledgeImporter.js';
import { KnowledgeStorage } from '../dist/domains/knowledge/KnowledgeStorage.js';
import { Normalizer } from '../dist/domains/knowledge/Normalizer.js';
import { PiiDetector } from '../dist/domains/knowledge/PiiDetector.js';
import {
  applyMigrations,
  ensurePassageVectorTable,
  ensureVectorTable,
  FTS_TRIGGER_STATEMENTS,
  PASSAGE_FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3_FTS,
  SCHEMA_V3_TABLE,
} from '../dist/domains/memory/schema.js';

const VEC_DIM = 3;

function freshDb() {
  const db = new Database(':memory:');
  db.exec(PRAGMA_SETUP);
  db.exec(SCHEMA_V1);
  for (const s of FTS_TRIGGER_STATEMENTS) db.exec(s);
  db.exec(SCHEMA_V2);
  db.exec(SCHEMA_V3_TABLE);
  db.exec(SCHEMA_V3_FTS);
  for (const s of PASSAGE_FTS_TRIGGER_STATEMENTS) db.exec(s);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  applyMigrations(db);
  // Load sqlite-vec extension and create vec0 tables (matches factory wiring)
  try {
    sqliteVec.load(db);
    ensureVectorTable(db, VEC_DIM);
    ensurePassageVectorTable(db, VEC_DIM);
  } catch {
    // fail-open if extension unavailable on this platform
  }
  return db;
}

const SAMPLE_LLM_RESPONSE = {
  title: 'Vector Test',
  summary: 'A document for vector write verification',
  docKind: 'guide',
  authority: 'candidate',
  extractionConfidence: 0.9,
  keywords: ['vector', 'test'],
  topics: ['retrieval'],
  language: 'en',
  chunks: [
    {
      headingPath: ['Vector Test'],
      contentMarkdown: 'First chunk content about vectors.',
      plainText: 'First chunk content about vectors.',
      charStart: 14,
      charEnd: 48,
      tokenCount: 6,
      dedupeKey: 'vec-1',
    },
    {
      headingPath: ['Vector Test', 'Section'],
      contentMarkdown: 'Second chunk in another section.',
      plainText: 'Second chunk in another section.',
      charStart: 60,
      charEnd: 92,
      tokenCount: 6,
      dedupeKey: 'vec-2',
    },
  ],
};

function mockLlm(response = SAMPLE_LLM_RESPONSE) {
  return {
    async generate() {
      return JSON.stringify(response);
    },
  };
}

function makeMockEmbedder() {
  let callCount = 0;
  const calls = [];
  return {
    embedder: {
      async embed(texts) {
        callCount++;
        calls.push(texts);
        return texts.map((_, i) => new Float32Array([0.1, 0.2 + callCount * 0.01, 0.3 + i * 0.01]));
      },
    },
    getCallCount: () => callCount,
    getCalls: () => calls,
  };
}

function makeMockVectorStore() {
  const upserts = [];
  const deletes = [];
  return {
    store: {
      upsert(anchor, vec) {
        upserts.push({ anchor, dim: vec.length });
      },
      delete(anchor) {
        deletes.push(anchor);
      },
    },
    getUpserts: () => upserts,
    getDeletes: () => deletes,
  };
}

describe('F179 AC-2.5.2: KnowledgeImporter vector writes', () => {
  let db;
  let tmpRoot;
  let storage;
  let governance;
  let packs;
  let piiDetector;

  before(async () => {
    db = freshDb();
    tmpRoot = await mkdtemp(join(tmpdir(), 'f179-2.5-vectors-'));
    storage = new KnowledgeStorage(tmpRoot);
    await storage.ensureDir();
    await storage.ensureGitignore();
    governance = new GovernanceStateMachine(db);
    packs = new DomainPackManager(db);
    piiDetector = new PiiDetector();
    await mkdir(join(tmpRoot, 'docs'), { recursive: true });
  });

  after(async () => {
    db.close();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('writes passage_vectors for each chunk (embedder wired)', async () => {
    const { embedder, getCalls } = makeMockEmbedder();
    const { store, getUpserts } = makeMockVectorStore();

    const importer = new KnowledgeImporter({
      db,
      storage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance,
      packs,
      piiDetector,
      embedder,
      vectorStore: store,
    });

    const filePath = join(tmpRoot, 'docs', 'passage-vectors.md');
    await writeFile(filePath, '# Vector Test\n\nFirst chunk content about vectors.\n\n## Section\n\nSecond chunk.');
    const result = await importer.importFile(filePath);
    assert.equal(result.status, 'created');

    const rows = db
      .prepare(
        'SELECT passage_id FROM passage_vectors WHERE passage_id IN (SELECT passage_id FROM evidence_passages WHERE doc_anchor = ?)',
      )
      .all(result.anchor);
    assert.equal(rows.length, 2, 'both chunks have passage_vectors rows');

    // doc-level vector also written via vectorStore.upsert
    const upserts = getUpserts();
    assert.ok(
      upserts.some((u) => u.anchor === result.anchor),
      'evidence_vectors upserted for the doc anchor',
    );

    // embedder called twice: once for chunks (passage), once for doc (title+summary)
    const calls = getCalls();
    assert.ok(calls.length >= 2, 'embedder called for both passage and doc levels');
  });

  it('writes evidence_vectors with title+summary embedding', async () => {
    const { embedder } = makeMockEmbedder();
    const { store, getUpserts } = makeMockVectorStore();
    const importer = new KnowledgeImporter({
      db,
      storage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance,
      packs,
      piiDetector,
      embedder,
      vectorStore: store,
    });

    const filePath = join(tmpRoot, 'docs', 'doc-vector.md');
    await writeFile(filePath, '# Vector Test\n\nFirst chunk content about vectors.\n\n## Section\n\nSecond chunk.');
    const result = await importer.importFile(filePath);
    assert.equal(result.status, 'created');

    const upserts = getUpserts();
    const docUpsert = upserts.find((u) => u.anchor === result.anchor);
    assert.ok(docUpsert, 'evidence_vectors upserted with doc anchor');
    assert.equal(docUpsert.dim, 3, 'embedding dim matches mock');
  });

  it('update path: stale doc + new doc both have vectors managed', async () => {
    const { embedder } = makeMockEmbedder();
    const { store, getUpserts, getDeletes } = makeMockVectorStore();
    const importer = new KnowledgeImporter({
      db,
      storage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance,
      packs,
      piiDetector,
      embedder,
      vectorStore: store,
    });

    const filePath = join(tmpRoot, 'docs', 'update-vec.md');
    await writeFile(filePath, '# V1\n\nVersion one.');
    const r1 = await importer.importFile(filePath);

    await writeFile(filePath, '# V2\n\nVersion two completely different content.');
    const r2 = await importer.importFile(filePath);

    assert.equal(r2.status, 'created');
    assert.notEqual(r1.anchor, r2.anchor);

    // old anchor's evidence_vectors row deleted (stale path cleanup)
    const deletes = getDeletes();
    assert.ok(deletes.includes(r1.anchor), 'stale doc evidence_vectors deleted');

    // new anchor has fresh evidence_vectors
    const upserts = getUpserts();
    assert.ok(
      upserts.some((u) => u.anchor === r2.anchor),
      'new doc evidence_vectors upserted',
    );

    // stale doc passage_vectors also cleaned (via passage_id -> chunk mapping)
    const stalePassages = db.prepare('SELECT passage_id FROM evidence_passages WHERE doc_anchor = ?').all(r1.anchor);
    if (stalePassages.length > 0) {
      // passages still around (not cascaded automatically because old doc kept for 'stale' state)
      // but vectors for those passages should be cleaned
      const stalePassageVecs = db
        .prepare(
          `SELECT passage_id FROM passage_vectors WHERE passage_id IN (${stalePassages.map(() => '?').join(',')})`,
        )
        .all(...stalePassages.map((p) => p.passage_id));
      assert.equal(stalePassageVecs.length, 0, 'stale passage_vectors cleaned');
    }
  });

  it('fail-open: embedder failure does not block import', async () => {
    const failingEmbedder = {
      async embed() {
        throw new Error('embedder down');
      },
    };
    const { store } = makeMockVectorStore();
    const importer = new KnowledgeImporter({
      db,
      storage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance,
      packs,
      piiDetector,
      embedder: failingEmbedder,
      vectorStore: store,
    });

    const filePath = join(tmpRoot, 'docs', 'fail-open.md');
    await writeFile(filePath, '# Fail Open\n\nContent.');
    const result = await importer.importFile(filePath);
    assert.equal(result.status, 'created', 'import succeeds despite embedder failure');
  });

  it('no embedder/vectorStore: skips vector writes entirely (legacy path)', async () => {
    const importer = new KnowledgeImporter({
      db,
      storage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance,
      packs,
      piiDetector,
      // no embedder, no vectorStore
    });

    const filePath = join(tmpRoot, 'docs', 'no-embedder.md');
    await writeFile(filePath, '# No Embedder\n\nContent.');
    const result = await importer.importFile(filePath);
    assert.equal(result.status, 'created');

    const passageVecs = db
      .prepare(
        'SELECT passage_id FROM passage_vectors WHERE passage_id IN (SELECT passage_id FROM evidence_passages WHERE doc_anchor = ?)',
      )
      .all(result.anchor);
    assert.equal(passageVecs.length, 0, 'no passage_vectors when embedder missing');
  });
});
