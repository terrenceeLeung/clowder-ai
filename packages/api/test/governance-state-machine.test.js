// F179: Governance State Machine — knowledge lifecycle management

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { GovernanceStateMachine } from '../dist/domains/knowledge/GovernanceStateMachine.js';
import {
  applyMigrations,
  FTS_TRIGGER_STATEMENTS,
  PASSAGE_FTS_TRIGGER_STATEMENTS,
  PRAGMA_SETUP,
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3_FTS,
  SCHEMA_V3_TABLE,
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

function insertDoc(db, anchor, governanceStatus) {
  db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, governance_status, updated_at)
              VALUES (?, 'pack-knowledge', 'active', ?, ?, ?)`).run(
    anchor,
    `Doc ${anchor}`,
    governanceStatus,
    new Date().toISOString(),
  );
}

describe('GovernanceStateMachine', () => {
  let db;
  let gsm;

  before(() => {
    db = freshDb();
    gsm = new GovernanceStateMachine(db);
  });

  after(() => {
    db.close();
  });

  describe('valid transitions', () => {
    it('ingested → normalized', () => {
      insertDoc(db, 'dk:t1', 'ingested');
      gsm.transition('dk:t1', 'normalized');
      assert.equal(gsm.getStatus('dk:t1'), 'normalized');
    });

    it('ingested → failed', () => {
      insertDoc(db, 'dk:t2', 'ingested');
      gsm.transition('dk:t2', 'failed');
      assert.equal(gsm.getStatus('dk:t2'), 'failed');
    });

    it('normalized → needs_review', () => {
      insertDoc(db, 'dk:t3', 'normalized');
      gsm.transition('dk:t3', 'needs_review');
      assert.equal(gsm.getStatus('dk:t3'), 'needs_review');
    });

    it('normalized → approved', () => {
      insertDoc(db, 'dk:t4', 'normalized');
      gsm.transition('dk:t4', 'approved');
      assert.equal(gsm.getStatus('dk:t4'), 'approved');
    });

    it('approved → active', () => {
      insertDoc(db, 'dk:t5', 'approved');
      gsm.transition('dk:t5', 'active');
      assert.equal(gsm.getStatus('dk:t5'), 'active');
    });

    it('active → stale', () => {
      insertDoc(db, 'dk:t6', 'active');
      gsm.transition('dk:t6', 'stale');
      assert.equal(gsm.getStatus('dk:t6'), 'stale');
    });

    it('active → retired', () => {
      insertDoc(db, 'dk:t7', 'active');
      gsm.transition('dk:t7', 'retired');
      assert.equal(gsm.getStatus('dk:t7'), 'retired');
    });

    it('failed → ingested (retry)', () => {
      insertDoc(db, 'dk:t8', 'failed');
      gsm.transition('dk:t8', 'ingested');
      assert.equal(gsm.getStatus('dk:t8'), 'ingested');
    });
  });

  describe('invalid transitions', () => {
    it('ingested → active throws', () => {
      insertDoc(db, 'dk:inv1', 'ingested');
      assert.throws(() => gsm.transition('dk:inv1', 'active'), /Invalid transition/);
    });

    it('retired → ingested throws (terminal)', () => {
      insertDoc(db, 'dk:inv2', 'retired');
      assert.throws(() => gsm.transition('dk:inv2', 'ingested'), /Invalid transition/);
    });

    it('approved → needs_review throws (no backward)', () => {
      insertDoc(db, 'dk:inv3', 'approved');
      assert.throws(() => gsm.transition('dk:inv3', 'needs_review'), /Invalid transition/);
    });
  });

  describe('autoRoute', () => {
    it('high confidence → approved', () => {
      insertDoc(db, 'dk:ar1', 'normalized');
      const result = gsm.autoRoute('dk:ar1', 0.9);
      assert.equal(result, 'approved');
      assert.equal(gsm.getStatus('dk:ar1'), 'approved');
    });

    it('low confidence → needs_review', () => {
      insertDoc(db, 'dk:ar2', 'normalized');
      const result = gsm.autoRoute('dk:ar2', 0.5);
      assert.equal(result, 'needs_review');
      assert.equal(gsm.getStatus('dk:ar2'), 'needs_review');
    });

    it('boundary confidence 0.8 → approved', () => {
      insertDoc(db, 'dk:ar3', 'normalized');
      const result = gsm.autoRoute('dk:ar3', 0.8);
      assert.equal(result, 'approved');
    });
  });

  describe('queries', () => {
    it('getStatus returns null for unknown anchor', () => {
      assert.equal(gsm.getStatus('dk:nonexistent'), null);
    });

    it('listByStatus returns matching anchors', () => {
      insertDoc(db, 'dk:ls1', 'active');
      insertDoc(db, 'dk:ls2', 'active');
      insertDoc(db, 'dk:ls3', 'stale');
      const active = gsm.listByStatus('active');
      assert.ok(active.includes('dk:ls1'));
      assert.ok(active.includes('dk:ls2'));
      assert.ok(!active.includes('dk:ls3'));
    });

    it('listByStatus filters by packId', () => {
      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, governance_status, pack_id, updated_at)
                  VALUES (?, 'pack-knowledge', 'active', ?, ?, ?, ?)`).run(
        'dk:pk1',
        'Pack 1 Doc',
        'active',
        'pack-a',
        new Date().toISOString(),
      );
      db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, governance_status, pack_id, updated_at)
                  VALUES (?, 'pack-knowledge', 'active', ?, ?, ?, ?)`).run(
        'dk:pk2',
        'Pack 2 Doc',
        'active',
        'pack-b',
        new Date().toISOString(),
      );

      const result = gsm.listByStatus('active', 'pack-a');
      assert.ok(result.includes('dk:pk1'));
      assert.ok(!result.includes('dk:pk2'));
    });
  });
});
