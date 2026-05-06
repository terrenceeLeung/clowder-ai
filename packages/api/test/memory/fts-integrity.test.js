import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('FTS integrity-check + auto-rebuild (AC-203)', () => {
  let store;
  let db;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();
  });

  it('checkAndRepairFts returns checked:true, repaired:false on healthy index', () => {
    const result = store.checkAndRepairFts();
    assert.equal(result.checked, true);
    assert.equal(result.repaired, false);
    assert.equal(result.error, undefined);
  });

  it('checkAndRepairFts is idempotent — search works after multiple rebuilds', async () => {
    await store.upsert([
      {
        anchor: 'test-doc',
        kind: 'feature',
        status: 'active',
        title: 'Test Document',
        summary: 'unique searchable content',
        updatedAt: new Date().toISOString(),
      },
    ]);

    store.checkAndRepairFts();
    store.checkAndRepairFts();

    const results = await store.search('unique searchable', { limit: 5 });
    assert.ok(results.length > 0, 'search works after multiple rebuilds');
  });

  it('rebuild restores FTS consistency after orphan passage removal', async () => {
    await store.upsert([
      {
        anchor: 'fts-doc',
        kind: 'feature',
        status: 'active',
        title: 'FTS Document',
        summary: 'document with passages',
        updatedAt: new Date().toISOString(),
      },
    ]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('fts-doc', 'p1', 'passage content', 0, new Date().toISOString());

    // Simulate orphan: delete doc row directly bypassing FTS trigger
    db.exec('DROP TRIGGER IF EXISTS evidence_docs_ad');
    db.prepare("DELETE FROM evidence_docs WHERE anchor = 'fts-doc'").run();

    // FTS has stale entry — rebuild should fix
    const result = store.checkAndRepairFts();
    assert.equal(result.checked, true);

    // After rebuild, searching for deleted doc should return nothing
    const results = await store.search('FTS Document', { limit: 5 });
    assert.equal(results.length, 0, 'deleted doc no longer appears in search after rebuild');
  });

  it('method exists and is callable (startup hook wiring)', () => {
    assert.equal(typeof store.checkAndRepairFts, 'function');
    const result = store.checkAndRepairFts();
    assert.ok('checked' in result);
    assert.ok('repaired' in result);
  });
});
