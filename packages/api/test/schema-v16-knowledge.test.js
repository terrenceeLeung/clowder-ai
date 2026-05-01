// F179: Schema V16 — evidence_passages extension + domain_packs table

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import {
  applyMigrations,
  CURRENT_SCHEMA_VERSION,
  FTS_TRIGGER_STATEMENTS,
  PASSAGE_FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3_FTS,
  SCHEMA_V3_TABLE,
} from '../dist/domains/memory/schema.js';

function createFreshDb() {
  const db = new Database(':memory:');
  db.exec(PRAGMA_SETUP);
  db.exec(SCHEMA_V1);
  for (const stmt of FTS_TRIGGER_STATEMENTS) db.exec(stmt);
  db.exec(SCHEMA_V2);
  db.exec(SCHEMA_V3_TABLE);
  db.exec(SCHEMA_V3_FTS);
  for (const stmt of PASSAGE_FTS_TRIGGER_STATEMENTS) db.exec(stmt);
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  applyMigrations(db);
  return db;
}

describe('Schema V16 — F179 Knowledge Governance', () => {
  let db;

  before(() => {
    db = createFreshDb();
  });

  after(() => {
    db.close();
  });

  it('schema version is 16', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 16);
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    assert.equal(row.v, 16);
  });

  describe('evidence_passages new columns', () => {
    it('passage_kind column exists with default "message"', () => {
      const info = db.prepare('PRAGMA table_info(evidence_passages)').all();
      const col = info.find((c) => c.name === 'passage_kind');
      assert.ok(col, 'passage_kind column must exist');
      assert.equal(col.dflt_value, "'message'");
    });

    it('heading_path column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_passages)').all();
      assert.ok(
        info.find((c) => c.name === 'heading_path'),
        'heading_path column must exist',
      );
    });

    it('chunk_index column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_passages)').all();
      assert.ok(
        info.find((c) => c.name === 'chunk_index'),
        'chunk_index column must exist',
      );
    });

    it('char_start and char_end columns exist', () => {
      const info = db.prepare('PRAGMA table_info(evidence_passages)').all();
      assert.ok(
        info.find((c) => c.name === 'char_start'),
        'char_start must exist',
      );
      assert.ok(
        info.find((c) => c.name === 'char_end'),
        'char_end must exist',
      );
    });

    it('existing INSERT without new columns still works (AC-014)', () => {
      db.exec(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
               VALUES ('test-doc-1', 'thread', 'active', 'Test', '2026-05-01T00:00:00Z')`);
      db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, speaker, position, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)`).run(
        'test-doc-1',
        'msg-1',
        'hello world',
        'user',
        0,
        '2026-05-01T00:00:00Z',
      );
      const row = db.prepare('SELECT passage_kind FROM evidence_passages WHERE passage_id = ?').get('msg-1');
      assert.equal(row.passage_kind, 'message');
    });

    it('domain_chunk INSERT with all new columns works', () => {
      db.prepare(`INSERT INTO evidence_passages
                   (doc_anchor, passage_id, content, position, created_at,
                    passage_kind, heading_path, chunk_index, char_start, char_end)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'test-doc-1',
        'chunk-1',
        'domain knowledge content',
        0,
        '2026-05-01T00:00:00Z',
        'domain_chunk',
        '["Architecture","Overview"]',
        0,
        0,
        24,
      );
      const row = db.prepare('SELECT * FROM evidence_passages WHERE passage_id = ?').get('chunk-1');
      assert.equal(row.passage_kind, 'domain_chunk');
      assert.equal(row.heading_path, '["Architecture","Overview"]');
      assert.equal(row.chunk_index, 0);
      assert.equal(row.char_start, 0);
      assert.equal(row.char_end, 24);
    });

    it('passage_fts still indexes domain_chunk content', () => {
      const results = db.prepare("SELECT rowid FROM passage_fts WHERE content MATCH 'domain knowledge'").all();
      assert.ok(results.length > 0, 'domain_chunk content must be FTS-searchable');
    });
  });

  describe('evidence_docs new columns', () => {
    it('governance_status column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_docs)').all();
      assert.ok(
        info.find((c) => c.name === 'governance_status'),
        'governance_status must exist',
      );
    });

    it('extraction_confidence column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_docs)').all();
      assert.ok(
        info.find((c) => c.name === 'extraction_confidence'),
        'extraction_confidence must exist',
      );
    });

    it('doc_kind column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_docs)').all();
      assert.ok(
        info.find((c) => c.name === 'doc_kind'),
        'doc_kind must exist',
      );
    });

    it('normalizer_version and model_id columns exist', () => {
      const info = db.prepare('PRAGMA table_info(evidence_docs)').all();
      assert.ok(
        info.find((c) => c.name === 'normalizer_version'),
        'normalizer_version must exist',
      );
      assert.ok(
        info.find((c) => c.name === 'model_id'),
        'model_id must exist',
      );
    });

    it('source_updated_at column exists', () => {
      const info = db.prepare('PRAGMA table_info(evidence_docs)').all();
      assert.ok(
        info.find((c) => c.name === 'source_updated_at'),
        'source_updated_at must exist',
      );
    });
  });

  describe('domain_packs table', () => {
    it('domain_packs table exists and accepts inserts', () => {
      db.prepare(`INSERT INTO domain_packs (pack_id, name, description, created_at)
                   VALUES (?, ?, ?, ?)`).run(
        'default',
        'Default Pack',
        'Auto-created default domain pack',
        '2026-05-01T00:00:00Z',
      );
      const row = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('default');
      assert.equal(row.name, 'Default Pack');
    });

    it('domain_packs name is unique', () => {
      assert.throws(() => {
        db.prepare(`INSERT INTO domain_packs (pack_id, name, description, created_at)
                     VALUES (?, ?, ?, ?)`).run('default-2', 'Default Pack', 'Duplicate name', '2026-05-01T00:00:00Z');
      });
    });
  });

  describe('V15→V16 migration preserves existing data', () => {
    it('pre-existing passage data survives migration', () => {
      const db2 = new Database(':memory:');
      db2.exec(PRAGMA_SETUP);
      db2.exec(SCHEMA_V1);
      for (const stmt of FTS_TRIGGER_STATEMENTS) db2.exec(stmt);
      db2.exec(SCHEMA_V2);
      db2.exec(SCHEMA_V3_TABLE);
      db2.exec(SCHEMA_V3_FTS);
      for (const stmt of PASSAGE_FTS_TRIGGER_STATEMENTS) db2.exec(stmt);
      db2.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());

      // Apply up to V15 only
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN pack_id TEXT`);
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN authority TEXT DEFAULT 'observed'`);
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN activation TEXT DEFAULT 'query'`);
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN contradicts TEXT`);
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN invalid_at TEXT`);
      db2.exec(`ALTER TABLE evidence_docs ADD COLUMN review_cycle_days INTEGER`);

      // Insert pre-existing data
      db2.exec(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
                VALUES ('old-doc', 'thread', 'active', 'Old Doc', '2026-04-01T00:00:00Z')`);
      db2
        .prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, speaker, position, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)`)
        .run('old-doc', 'old-msg-1', 'pre-existing message', 'user', 0, '2026-04-01T00:00:00Z');

      db2.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(15, new Date().toISOString());

      // Apply V16
      applyMigrations(db2);

      const passage = db2.prepare('SELECT * FROM evidence_passages WHERE passage_id = ?').get('old-msg-1');
      assert.equal(passage.content, 'pre-existing message');
      assert.equal(passage.passage_kind, 'message');
      assert.equal(passage.heading_path, null);

      db2.close();
    });
  });
});
