import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

describe('Knowledge lifecycle E2E (AC-207)', () => {
  let store;
  let db;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();
  });

  it('import → rebuild → pack-scoped search → delete → no orphans', async () => {
    // 1. Import: create pack-knowledge doc with passages
    const now = new Date().toISOString();
    await store.upsert([
      {
        anchor: 'dk:test-pack:guide',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Developer Guide',
        summary: 'How to set up the development environment',
        updatedAt: now,
        packId: 'test-pack',
        governanceStatus: 'active',
      },
    ]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at, passage_kind)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      'dk:test-pack:guide',
      'chunk-0',
      'Install Node.js v20 or later',
      0,
      now,
      'domain_chunk',
    );
    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at, passage_kind)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      'dk:test-pack:guide',
      'chunk-1',
      'Run pnpm install to set up deps',
      1,
      now,
      'domain_chunk',
    );

    // 2. Simulate rebuild: run FTS repair (same as startup hook)
    const ftsResult = store.checkAndRepairFts();
    assert.equal(ftsResult.checked, true);

    // 3. Verify rebuild protection: IndexBuilder would skip pack-knowledge
    //    (tested separately in rebuild-protection.test.js — here we verify the doc survives)
    const doc = await store.getByAnchor('dk:test-pack:guide');
    assert.ok(doc, 'pack-knowledge doc survives rebuild');
    assert.equal(doc.kind, 'pack-knowledge');

    // 4. Pack-scoped search returns the doc
    const searchResults = await store.search('development environment', { limit: 5, packId: 'test-pack' });
    assert.ok(searchResults.length > 0, 'pack-scoped search finds the doc');
    assert.ok(
      searchResults.some((r) => r.anchor === 'dk:test-pack:guide'),
      'correct doc returned',
    );

    // 5. Global search (no packId) does NOT return pack-knowledge
    const globalResults = await store.search('development environment', { limit: 5 });
    assert.ok(!globalResults.some((r) => r.anchor === 'dk:test-pack:guide'), 'global search excludes pack-knowledge');

    // 6. Delete the doc — cascade should clean up passages
    await store.deleteByAnchor('dk:test-pack:guide');

    const afterDoc = await store.getByAnchor('dk:test-pack:guide');
    assert.equal(afterDoc, null, 'doc deleted');

    const orphanPassages = db
      .prepare("SELECT count(*) AS c FROM evidence_passages WHERE doc_anchor = 'dk:test-pack:guide'")
      .get();
    assert.equal(orphanPassages.c, 0, 'no orphan passages after delete');

    // 7. FTS consistency after delete
    const postDeleteFts = store.checkAndRepairFts();
    assert.equal(postDeleteFts.checked, true);

    // Search should return nothing for the deleted doc
    const postDeleteSearch = await store.search('development environment', { limit: 5, packId: 'test-pack' });
    assert.equal(postDeleteSearch.length, 0, 'deleted doc not in search results');
  });

  it('deleteByPackId cleans up all docs and passages for a pack', async () => {
    const now = new Date().toISOString();

    // Insert 2 docs in same pack
    await store.upsert([
      {
        anchor: 'dk:bulk-pack:doc1',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Doc One',
        summary: 'first document',
        updatedAt: now,
        packId: 'bulk-pack',
      },
      {
        anchor: 'dk:bulk-pack:doc2',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Doc Two',
        summary: 'second document',
        updatedAt: now,
        packId: 'bulk-pack',
      },
    ]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:bulk-pack:doc1', 'p1', 'chunk from doc1', 0, now);
    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:bulk-pack:doc2', 'p1', 'chunk from doc2', 0, now);

    // Delete entire pack
    const deleted = await store.deleteByPackId('bulk-pack');
    assert.equal(deleted, 2, '2 docs deleted');

    // Verify no orphans
    const remainingDocs = db.prepare("SELECT count(*) AS c FROM evidence_docs WHERE pack_id = 'bulk-pack'").get();
    assert.equal(remainingDocs.c, 0, 'no docs remain');

    const remainingPassages = db
      .prepare("SELECT count(*) AS c FROM evidence_passages WHERE doc_anchor LIKE 'dk:bulk-pack:%'")
      .get();
    assert.equal(remainingPassages.c, 0, 'no passages remain');
  });
});
