import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('Cascade delete — evidence_passages cleanup (AC-202)', () => {
  let store;
  let db;

  beforeEach(async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    db = store.getDb();
  });

  it('deleteByAnchor cascades to evidence_passages', async () => {
    await store.upsert([{
      anchor: 'dk:test-pack:doc1',
      kind: 'pack-knowledge',
      status: 'active',
      title: 'Test Doc',
      summary: 'A test document',
      updatedAt: new Date().toISOString(),
    }]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:test-pack:doc1', 'p1', 'passage one', 0, new Date().toISOString());
    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:test-pack:doc1', 'p2', 'passage two', 1, new Date().toISOString());

    const before = db.prepare("SELECT count(*) AS c FROM evidence_passages WHERE doc_anchor = 'dk:test-pack:doc1'").get();
    assert.equal(before.c, 2, 'should have 2 passages before delete');

    await store.deleteByAnchor('dk:test-pack:doc1');

    const afterDoc = await store.getByAnchor('dk:test-pack:doc1');
    assert.equal(afterDoc, null, 'doc should be deleted');

    const afterPassages = db.prepare("SELECT count(*) AS c FROM evidence_passages WHERE doc_anchor = 'dk:test-pack:doc1'").get();
    assert.equal(afterPassages.c, 0, 'passages should be cascade-deleted');
  });

  it('deleteByPackId cascades to evidence_passages', async () => {
    await store.upsert([
      {
        anchor: 'dk:mypack:doc-a',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Doc A',
        updatedAt: new Date().toISOString(),
        packId: 'mypack',
      },
      {
        anchor: 'dk:mypack:doc-b',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Doc B',
        updatedAt: new Date().toISOString(),
        packId: 'mypack',
      },
    ]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:mypack:doc-a', 'p1', 'chunk a1', 0, new Date().toISOString());
    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('dk:mypack:doc-b', 'p1', 'chunk b1', 0, new Date().toISOString());

    const before = db.prepare("SELECT count(*) AS c FROM evidence_passages").get();
    assert.equal(before.c, 2, 'should have 2 passages before delete');

    await store.deleteByPackId('mypack');

    const afterDocs = db.prepare("SELECT count(*) AS c FROM evidence_docs WHERE pack_id = 'mypack'").get();
    assert.equal(afterDocs.c, 0, 'docs should be deleted');

    const afterPassages = db.prepare("SELECT count(*) AS c FROM evidence_passages").get();
    assert.equal(afterPassages.c, 0, 'passages should be cascade-deleted');
  });

  it('deleteByAnchor does not affect other docs passages', async () => {
    await store.upsert([
      { anchor: 'doc-keep', kind: 'feature', status: 'active', title: 'Keep', updatedAt: new Date().toISOString() },
      { anchor: 'doc-delete', kind: 'feature', status: 'active', title: 'Delete', updatedAt: new Date().toISOString() },
    ]);

    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('doc-keep', 'p1', 'keep this', 0, new Date().toISOString());
    db.prepare(`INSERT INTO evidence_passages (doc_anchor, passage_id, content, position, created_at)
      VALUES (?, ?, ?, ?, ?)`).run('doc-delete', 'p1', 'delete this', 0, new Date().toISOString());

    await store.deleteByAnchor('doc-delete');

    const kept = db.prepare("SELECT count(*) AS c FROM evidence_passages WHERE doc_anchor = 'doc-keep'").get();
    assert.equal(kept.c, 1, 'other doc passages should be untouched');
  });
});
