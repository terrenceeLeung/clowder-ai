// F179 Phase 1: Knowledge API routes tests

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import * as sqliteVec from 'sqlite-vec';
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
import { knowledgeRoutes } from '../dist/routes/knowledge.js';

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
  return db;
}

function buildMultipartPayload(files) {
  const boundary = `----TestBoundary${Math.random().toString(16).slice(2)}`;
  const parts = files.map(({ content, filename }) => {
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: text/markdown\r\n\r\n`;
    return Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(content, 'utf8')]);
  });
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    payload: Buffer.concat([...parts, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('F179 Phase 1: Knowledge API routes', () => {
  let app;
  let db;
  let tmpRoot;

  before(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'f179-routes-'));
    db = freshDb();
  });

  after(async () => {
    db?.close();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe('POST /api/knowledge/import', () => {
    it('imports a markdown file and returns ImportResult', async () => {
      const mockImporter = {
        async importFile(filePath) {
          return {
            sourcePath: filePath,
            anchor: 'dk:test-anchor-1',
            status: 'created',
            chunkCount: 3,
          };
        },
        async importBatch(filePaths) {
          const results = [];
          for (const fp of filePaths) results.push(await this.importFile(fp));
          return results;
        },
      };

      app = Fastify();
      await app.register(knowledgeRoutes, {
        importer: mockImporter,
        db,
        projectRoot: tmpRoot,
      });
      await app.ready();

      const { payload, contentType } = buildMultipartPayload([
        { content: '# Test Doc\n\nSome content here.', filename: 'test.md' },
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge/import',
        headers: { 'Content-Type': contentType },
        payload,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.results));
      assert.equal(body.results.length, 1);
      assert.equal(body.results[0].status, 'created');
      assert.equal(body.results[0].chunkCount, 3);

      await app.close();
    });
  });

  describe('GET /api/knowledge/docs', () => {
    it('returns list of imported knowledge documents', async () => {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO evidence_docs
        (anchor, kind, status, title, summary, governance_status, updated_at)
        VALUES (?, 'pack-knowledge', 'active', ?, ?, 'approved', ?)`).run(
        'dk:doc-list-1', 'Test Document', 'A test summary', now,
      );

      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge/docs',
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.docs));
      assert.ok(body.docs.length > 0);

      const doc = body.docs.find((d) => d.anchor === 'dk:doc-list-1');
      assert.ok(doc);
      assert.equal(doc.title, 'Test Document');
      assert.equal(doc.governanceStatus, 'approved');

      await app.close();
    });
  });

  describe('GET /api/knowledge/docs/:anchor', () => {
    it('returns document detail with passages (transparency chain)', async () => {
      const now = new Date().toISOString();
      const anchor = 'dk:doc-detail-1';

      db.prepare(`INSERT INTO evidence_docs
        (anchor, kind, status, title, summary, governance_status, updated_at)
        VALUES (?, 'pack-knowledge', 'active', ?, ?, 'active', ?)`).run(
        anchor, 'Detail Doc', 'Detail summary', now,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, heading_path, chunk_index, char_start, char_end)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?, ?, ?, ?)`).run(
        anchor, 'chunk-1', 'First section content', 0, now, '["Detail Doc","Section 1"]', 0, 0, 21,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, heading_path, chunk_index, char_start, char_end)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?, ?, ?, ?)`).run(
        anchor, 'chunk-2', 'Second section content', 1, now, '["Detail Doc","Section 2"]', 1, 22, 43,
      );

      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge/docs/${encodeURIComponent(anchor)}`,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.doc.anchor, anchor);
      assert.equal(body.doc.title, 'Detail Doc');
      assert.ok(Array.isArray(body.passages));
      assert.equal(body.passages.length, 2);
      assert.deepEqual(body.passages[0].headingPath, ['Detail Doc', 'Section 1']);
      assert.equal(body.passages[0].charStart, 0);
      assert.equal(body.passages[1].charStart, 22);

      await app.close();
    });
  });

  describe('GET /api/knowledge/search', () => {
    it('searches passages using hybrid search', async () => {
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO evidence_docs
        (anchor, kind, status, title, governance_status, updated_at)
        VALUES (?, 'pack-knowledge', 'active', ?, 'active', ?)`).run(
        'dk:search-1', 'Searchable Doc', now,
      );

      db.prepare(`INSERT INTO evidence_passages
        (doc_anchor, passage_id, content, position, created_at, passage_kind, chunk_index)
        VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?)`).run(
        'dk:search-1', 'p-search-1', 'kubernetes container orchestration deployment', 0, now, 0,
      );

      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge/search?q=kubernetes+deployment&limit=5',
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.results));
      assert.ok(body.results.length > 0);
      assert.equal(body.results[0].passageId, 'p-search-1');

      await app.close();
    });
  });

  describe('GET /api/knowledge/packs', () => {
    it('returns list of domain packs', async () => {
      db.prepare(
        `INSERT OR IGNORE INTO domain_packs (pack_id, name, description, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run('pack-test-1', 'Test Pack', 'A test pack', new Date().toISOString());

      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/api/knowledge/packs' });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.packs));
      const pack = body.packs.find((p) => p.packId === 'pack-test-1');
      assert.ok(pack);
      assert.equal(pack.name, 'Test Pack');

      await app.close();
    });
  });

  describe('POST /api/knowledge/packs', () => {
    it('creates a new domain pack', async () => {
      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge/packs',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ name: 'New Pack', description: 'Created via API' }),
      });

      assert.equal(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.ok(body.packId);
      assert.equal(body.name, 'New Pack');

      const row = db.prepare('SELECT * FROM domain_packs WHERE name = ?').get('New Pack');
      assert.ok(row);

      await app.close();
    });
  });

  describe('PATCH /api/knowledge/packs/:id', () => {
    it('renames a domain pack', async () => {
      const packId = 'pack-rename-1';
      db.prepare(
        `INSERT OR IGNORE INTO domain_packs (pack_id, name, created_at)
         VALUES (?, ?, ?)`,
      ).run(packId, 'Old Name', new Date().toISOString());

      app = Fastify();
      await app.register(knowledgeRoutes, { db, projectRoot: tmpRoot });
      await app.ready();

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge/packs/${packId}`,
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ name: 'New Name' }),
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.name, 'New Name');

      const row = db.prepare('SELECT name FROM domain_packs WHERE pack_id = ?').get(packId);
      assert.equal(row.name, 'New Name');

      await app.close();
    });
  });
});
