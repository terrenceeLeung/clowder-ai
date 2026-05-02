// F179 AC-07: Passage-level hybrid search (BM25 + vec0) tests

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
import { SqliteEvidenceStore } from '../dist/domains/memory/SqliteEvidenceStore.js';
import {
  applyMigrations,
  ensurePassageVectorTable,
  FTS_TRIGGER_STATEMENTS,
  PASSAGE_FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3_FTS,
  SCHEMA_V3_TABLE,
} from '../dist/domains/memory/schema.js';

const EMBED_DIM = 8;

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
  sqliteVec.load(db);
  ensurePassageVectorTable(db, EMBED_DIM);
  return db;
}

function makeVec(...values) {
  const arr = new Float32Array(EMBED_DIM);
  for (let i = 0; i < values.length && i < EMBED_DIM; i++) arr[i] = values[i];
  return arr;
}

const VALID_LLM_RESPONSE = {
  title: 'Test Document',
  summary: 'A test document for hybrid search.',
  docKind: 'guide',
  authority: 'candidate',
  extractionConfidence: 0.85,
  keywords: ['hybrid', 'search'],
  topics: ['testing'],
  language: 'en',
  chunks: [
    {
      headingPath: ['Test Document'],
      contentMarkdown: 'Keyword-rich introduction with hybrid search terms.',
      plainText: 'Keyword-rich introduction with hybrid search terms.',
      charStart: 0,
      charEnd: 50,
      tokenCount: 8,
      dedupeKey: 'chunk-intro',
    },
    {
      headingPath: ['Test Document', 'Deep Section'],
      contentMarkdown: 'Deeply nested content about specialized topology algorithms.',
      plainText: 'Deeply nested content about specialized topology algorithms.',
      charStart: 51,
      charEnd: 110,
      tokenCount: 8,
      dedupeKey: 'chunk-deep',
    },
  ],
};

function mockLlm() {
  return {
    async generate() {
      return JSON.stringify(VALID_LLM_RESPONSE);
    },
  };
}

describe('F179 AC-07: Passage hybrid search (BM25 + vec0)', () => {
  let db;
  let tmpRoot;

  before(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'f179-hybrid-'));
    await mkdir(join(tmpRoot, 'docs'), { recursive: true });
  });

  after(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe('KnowledgeImporter embedding generation', () => {
    it('writes passage_vectors when embedder is provided', async () => {
      db = freshDb();
      const storage = new KnowledgeStorage(tmpRoot);
      await storage.ensureDir();
      await storage.ensureGitignore();

      const chunkVecs = [makeVec(1, 0, 0), makeVec(0, 1, 0)];
      let embedCalled = false;
      const mockEmbedder = {
        async embed(texts) {
          embedCalled = true;
          assert.equal(texts.length, 2);
          return chunkVecs;
        },
      };

      const importer = new KnowledgeImporter({
        db,
        storage,
        normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
        governance: new GovernanceStateMachine(db),
        packs: new DomainPackManager(db),
        piiDetector: new PiiDetector(),
        embedder: mockEmbedder,
      });

      await writeFile(join(tmpRoot, 'docs', 'embed-test.md'), '# Embed Test\n\nContent here.');
      const result = await importer.importFile(join(tmpRoot, 'docs', 'embed-test.md'));

      assert.equal(result.status, 'created');
      assert.ok(embedCalled, 'embedder.embed() should have been called');

      const vecCount = db.prepare('SELECT count(*) as c FROM passage_vectors').get();
      assert.equal(vecCount.c, 2, 'Should have 2 passage vectors');

      db.close();
    });

    it('import succeeds even when embedder throws (fail-open)', async () => {
      db = freshDb();
      const storage = new KnowledgeStorage(tmpRoot);
      await storage.ensureDir();

      const failEmbedder = {
        async embed() {
          throw new Error('Embedding service unavailable');
        },
      };

      const importer = new KnowledgeImporter({
        db,
        storage,
        normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
        governance: new GovernanceStateMachine(db),
        packs: new DomainPackManager(db),
        piiDetector: new PiiDetector(),
        embedder: failEmbedder,
      });

      await writeFile(join(tmpRoot, 'docs', 'fail-embed.md'), '# Fail Embed\n\nContent.');
      const result = await importer.importFile(join(tmpRoot, 'docs', 'fail-embed.md'));

      assert.equal(result.status, 'created', 'Import should succeed despite embedding failure');
      assert.equal(result.chunkCount, 2);

      const vecCount = db.prepare('SELECT count(*) as c FROM passage_vectors').get();
      assert.equal(vecCount.c, 0, 'No vectors when embedder fails');

      db.close();
    });

    it('no embedder = no passage_vectors written', async () => {
      db = freshDb();
      const storage = new KnowledgeStorage(tmpRoot);
      await storage.ensureDir();

      const importer = new KnowledgeImporter({
        db,
        storage,
        normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
        governance: new GovernanceStateMachine(db),
        packs: new DomainPackManager(db),
        piiDetector: new PiiDetector(),
      });

      await writeFile(join(tmpRoot, 'docs', 'no-embed.md'), '# No Embed\n\nContent.');
      const result = await importer.importFile(join(tmpRoot, 'docs', 'no-embed.md'));

      assert.equal(result.status, 'created');
      const vecCount = db.prepare('SELECT count(*) as c FROM passage_vectors').get();
      assert.equal(vecCount.c, 0);

      db.close();
    });
  });

  describe('searchPassagesHybrid RRF fusion', () => {
    it('retrieves tail chunks via vec0 that BM25 misses (AC-07 core)', async () => {
      db = freshDb();
      const now = new Date().toISOString();

      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
                   VALUES ('doc-1', 'pack-knowledge', 'active', 'Test Doc', ?)`).run(now);

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-1',
        'p-keyword',
        'hybrid search keywords match here',
        0,
        now,
        0,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-1',
        'p-tail',
        'specialized topology algorithms deep content',
        1,
        now,
        1,
      );

      const queryVec = makeVec(0, 0, 0, 0, 0, 0, 0, 1);
      const tailVec = makeVec(0, 0, 0, 0, 0, 0, 0, 0.9);
      const keywordVec = makeVec(1, 0, 0, 0, 0, 0, 0, 0);

      db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('p-keyword', keywordVec);
      db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('p-tail', tailVec);

      const mockEmbedding = {
        async embed(texts) {
          return texts.map(() => queryVec);
        },
        async load() {},
        isReady() {
          return true;
        },
        getModelInfo() {
          return { modelId: 'mock', modelRev: '1', dim: EMBED_DIM };
        },
        dispose() {},
      };

      const { VectorStore } = await import('../dist/domains/memory/VectorStore.js');
      const { ensureVectorTable } = await import('../dist/domains/memory/schema.js');
      ensureVectorTable(db, EMBED_DIM);
      const vectorStore = new VectorStore(db, EMBED_DIM);

      const store = new SqliteEvidenceStore(db.name, {
        embedding: mockEmbedding,
        vectorStore,
        mode: 'on',
      });
      // Inject our pre-built db instead of letting initialize() create a new one
      store['db'] = db;

      const results = await store.searchPassagesHybrid('topology algorithms', 10);

      const tailFound = results.some((r) => r.passageId === 'p-tail');
      assert.ok(tailFound, 'Tail chunk should be retrievable via vec0 even without BM25 keyword match');

      db.close();
    });

    it('degrades to BM25-only when embedDeps not available', async () => {
      db = freshDb();
      const now = new Date().toISOString();

      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
                   VALUES ('doc-2', 'pack-knowledge', 'active', 'BM25 Only', ?)`).run(now);

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-2',
        'p-bm25',
        'lexical keyword searchable content',
        0,
        now,
        0,
      );

      const store = new SqliteEvidenceStore(db.name);
      store['db'] = db;

      const results = await store.searchPassagesHybrid('keyword searchable', 10);
      assert.ok(results.length > 0, 'Should return BM25 results without embedDeps');
      assert.equal(results[0].passageId, 'p-bm25');

      db.close();
    });

    it('RRF ranks dual-signal passages higher than single-signal', async () => {
      db = freshDb();
      const now = new Date().toISOString();

      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
                   VALUES ('doc-3', 'pack-knowledge', 'active', 'RRF Test', ?)`).run(now);

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-3',
        'p-both',
        'machine learning neural networks',
        0,
        now,
        0,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-3',
        'p-vec-only',
        'unrelated text with no keyword overlap',
        1,
        now,
        1,
      );

      const queryVec = makeVec(1, 1, 0, 0, 0, 0, 0, 0);
      const bothVec = makeVec(0.9, 0.9, 0, 0, 0, 0, 0, 0);
      const vecOnlyVec = makeVec(0.8, 0.8, 0, 0, 0, 0, 0, 0);

      db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('p-both', bothVec);
      db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)').run('p-vec-only', vecOnlyVec);

      const mockEmbedding = {
        async embed(texts) {
          return texts.map(() => queryVec);
        },
        async load() {},
        isReady() {
          return true;
        },
        getModelInfo() {
          return { modelId: 'mock', modelRev: '1', dim: EMBED_DIM };
        },
        dispose() {},
      };

      const { VectorStore } = await import('../dist/domains/memory/VectorStore.js');
      const { ensureVectorTable } = await import('../dist/domains/memory/schema.js');
      ensureVectorTable(db, EMBED_DIM);
      const vectorStore = new VectorStore(db, EMBED_DIM);

      const store = new SqliteEvidenceStore(db.name, {
        embedding: mockEmbedding,
        vectorStore,
        mode: 'on',
      });
      store['db'] = db;

      const results = await store.searchPassagesHybrid('machine learning', 10);

      const bothIdx = results.findIndex((r) => r.passageId === 'p-both');
      const vecOnlyIdx = results.findIndex((r) => r.passageId === 'p-vec-only');

      assert.ok(bothIdx >= 0, 'Dual-signal passage should appear in results');
      assert.ok(vecOnlyIdx >= 0, 'Vec-only passage should appear in results');
      assert.ok(bothIdx < vecOnlyIdx, 'Dual-signal passage should rank higher than single-signal');

      db.close();
    });

    it('respects passageKind filter', async () => {
      db = freshDb();
      const now = new Date().toISOString();

      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
                   VALUES ('doc-4', 'pack-knowledge', 'active', 'Kind Filter', ?)`).run(now);

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'doc-4',
        'p-chunk',
        'filterable domain content here',
        0,
        now,
        0,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'message', ?)`).run('doc-4', 'p-msg', 'filterable message content here', 1, now, 1);

      const store = new SqliteEvidenceStore(db.name);
      store['db'] = db;

      const results = await store.searchPassagesHybrid('filterable content', 10, { passageKind: 'domain_chunk' });
      assert.ok(
        results.every((r) => r.passageKind === 'domain_chunk'),
        'Should only return domain_chunk passages',
      );

      db.close();
    });
  });
});
