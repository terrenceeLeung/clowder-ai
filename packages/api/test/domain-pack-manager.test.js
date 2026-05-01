// F179: Domain Pack Manager — CRUD for domain knowledge packs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { DomainPackManager } from '../dist/domains/knowledge/DomainPackManager.js';
import {
  SCHEMA_V1, SCHEMA_V2, SCHEMA_V3_TABLE, SCHEMA_V3_FTS,
  FTS_TRIGGER_STATEMENTS, PASSAGE_FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP, applyMigrations,
} from '../dist/domains/memory/schema.js';

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

describe('DomainPackManager', () => {
  let db;
  let mgr;

  before(() => {
    db = freshDb();
    mgr = new DomainPackManager(db);
  });

  after(() => {
    db.close();
  });

  it('ensureDefaultPack creates default pack', () => {
    const packId = mgr.ensureDefaultPack();
    assert.equal(packId, 'default');
    const row = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('default');
    assert.ok(row);
    assert.equal(row.name, 'default');
  });

  it('ensureDefaultPack is idempotent', () => {
    const id1 = mgr.ensureDefaultPack();
    const id2 = mgr.ensureDefaultPack();
    assert.equal(id1, id2);
    const count = db.prepare('SELECT COUNT(*) as c FROM domain_packs WHERE pack_id = ?').get('default');
    assert.equal(count.c, 1);
  });

  it('create makes a named pack', () => {
    const packId = mgr.create('api-docs', 'API documentation');
    assert.equal(packId, 'api-docs');
    const row = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('api-docs');
    assert.equal(row.description, 'API documentation');
  });

  it('create throws on duplicate name', () => {
    assert.throws(() => mgr.create('api-docs'));
  });

  it('list returns packs with doc counts', () => {
    // Add a doc to api-docs pack
    db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, pack_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('dk:test-1', 'pack-knowledge', 'active', 'Test Doc', 'api-docs', new Date().toISOString());

    const packs = mgr.list();
    assert.ok(packs.length >= 2);
    const apiPack = packs.find((p) => p.packId === 'api-docs');
    assert.ok(apiPack);
    assert.equal(apiPack.docCount, 1);

    const defaultPack = packs.find((p) => p.packId === 'default');
    assert.ok(defaultPack);
    assert.equal(defaultPack.docCount, 0);
  });

  it('rename updates pack name and evidence_docs pack_id', () => {
    mgr.create('old-name', 'Will be renamed');
    db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, pack_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('dk:rename-test', 'pack-knowledge', 'active', 'Rename Test', 'old-name', new Date().toISOString());

    mgr.rename('old-name', 'new-name');

    const oldRow = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('old-name');
    assert.equal(oldRow, undefined);

    const newRow = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('new-name');
    assert.ok(newRow);
    assert.equal(newRow.name, 'new-name');

    const doc = db.prepare('SELECT pack_id FROM evidence_docs WHERE anchor = ?').get('dk:rename-test');
    assert.equal(doc.pack_id, 'new-name');
  });

  it('remove deletes empty pack', () => {
    mgr.create('empty-pack');
    mgr.remove('empty-pack');
    const row = db.prepare('SELECT * FROM domain_packs WHERE pack_id = ?').get('empty-pack');
    assert.equal(row, undefined);
  });

  it('remove throws for pack with active docs', () => {
    mgr.create('busy-pack');
    db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, pack_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('dk:busy-test', 'pack-knowledge', 'active', 'Busy Doc', 'busy-pack', new Date().toISOString());
    assert.throws(() => mgr.remove('busy-pack'));
  });
});
