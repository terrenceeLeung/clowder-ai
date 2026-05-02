// F179: Passage search enhancement — domain_chunk retrieval (AC-07)

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { SqliteEvidenceStore } from '../dist/domains/memory/SqliteEvidenceStore.js';

function seedDomainChunks(dbPath) {
  const db = new Database(dbPath);
  const now = new Date().toISOString();

  // Domain doc with governance metadata
  db.prepare(`INSERT INTO evidence_docs
    (anchor, kind, status, title, summary, pack_id, governance_status,
     doc_kind, authority, activation, updated_at)
    VALUES (?, 'pack-knowledge', 'active', ?, ?, ?, 'active', ?, ?, 'query', ?)`).run(
    'dk:ops-manual',
    'MeowGrid Operations Manual',
    'Complete operations guide for MeowGrid distributed scheduler',
    'default',
    'operations',
    'validated',
    now,
  );

  // Early section chunk
  db.prepare(`INSERT INTO evidence_passages
    (doc_anchor, passage_id, content, position, created_at,
     passage_kind, heading_path, chunk_index, char_start, char_end)
    VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?, ?, ?, ?)`).run(
    'dk:ops-manual',
    'dk:ops-manual:c0',
    'MeowGrid is a distributed task scheduling engine designed for high throughput.',
    0,
    now,
    '["Operations Manual","Overview"]',
    0,
    0,
    78,
  );

  // Late section chunk
  db.prepare(`INSERT INTO evidence_passages
    (doc_anchor, passage_id, content, position, created_at,
     passage_kind, heading_path, chunk_index, char_start, char_end)
    VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?, ?, ?, ?)`).run(
    'dk:ops-manual',
    'dk:ops-manual:c3',
    'To recover from a FurBall Deadlock, restart the Whisker Coordinator and flush the NapQueue buffer.',
    3,
    now,
    '["Operations Manual","Troubleshooting","FurBall Deadlock Recovery"]',
    3,
    5000,
    5098,
  );

  // Regular message passage (thread)
  db.prepare(`INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
              VALUES (?, 'thread', 'active', ?, ?)`).run('thread-1', 'Thread 1', now);
  db.prepare(`INSERT INTO evidence_passages
    (doc_anchor, passage_id, content, speaker, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    'thread-1',
    'msg-1',
    'Can you help me with the FurBall Deadlock issue?',
    'user',
    0,
    now,
  );

  db.close();
}

describe('Passage search — domain chunks (AC-07)', () => {
  let tmpDir;
  let store;
  let dbPath;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'f179-search-'));
    dbPath = join(tmpDir, 'evidence.sqlite');
    // Initialize store (creates schema), then close so seed can write
    const initStore = new SqliteEvidenceStore(dbPath);
    await initStore.initialize();
    initStore.close();
    // Seed test data with direct DB access
    seedDomainChunks(dbPath);
    // Reopen store for tests
    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
  });

  after(async () => {
    store.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('domain_chunk passages are BM25 searchable', () => {
    const results = store.searchPassages('FurBall Deadlock', 5);
    assert.ok(results.length > 0, `Expected results for "FurBall Deadlock", got ${results.length}`);
    const domainHit = results.find((r) => r.passageId === 'dk:ops-manual:c3');
    assert.ok(domainHit, 'Late-section domain chunk should be found');
  });

  it('results include heading_path and char positions', () => {
    const results = store.searchPassages('FurBall Deadlock', 5);
    const domainHit = results.find((r) => r.passageKind === 'domain_chunk');
    assert.ok(domainHit);
    assert.ok(domainHit.headingPath);
    assert.equal(typeof domainHit.charStart, 'number');
    assert.equal(typeof domainHit.charEnd, 'number');
  });

  it('results include passage_kind field', () => {
    const results = store.searchPassages('FurBall', 10);
    const kinds = results.map((r) => r.passageKind);
    assert.ok(kinds.includes('domain_chunk'));
    assert.ok(kinds.includes('message'));
  });

  it('passageKind filter: domain_chunk only', () => {
    const results = store.searchPassages('FurBall', 10, undefined, { passageKind: 'domain_chunk' });
    assert.ok(results.every((r) => r.passageKind === 'domain_chunk'));
  });

  it('passageKind filter: message only', () => {
    const results = store.searchPassages('FurBall', 10, undefined, { passageKind: 'message' });
    assert.ok(results.every((r) => r.passageKind === 'message'));
  });

  it('long document later-section chunk is retrievable', () => {
    const results = store.searchPassages('restart Whisker Coordinator flush NapQueue', 5);
    assert.ok(results.length > 0);
    const hit = results.find((r) => r.charStart === 5000);
    assert.ok(hit, 'Chunk from char offset 5000 should be retrievable');
  });
});
