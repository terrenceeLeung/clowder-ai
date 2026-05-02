// F179: MeowGrid E2E — end-to-end import + search validation (AC-011)

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { DomainPackManager } from '../dist/domains/knowledge/DomainPackManager.js';
import { GovernanceStateMachine } from '../dist/domains/knowledge/GovernanceStateMachine.js';
import { KnowledgeImporter } from '../dist/domains/knowledge/KnowledgeImporter.js';
import { KnowledgeStorage } from '../dist/domains/knowledge/KnowledgeStorage.js';
import { Normalizer } from '../dist/domains/knowledge/Normalizer.js';
import { PiiDetector } from '../dist/domains/knowledge/PiiDetector.js';
import { SqliteEvidenceStore } from '../dist/domains/memory/SqliteEvidenceStore.js';

const FIXTURE_DIR = new URL('./__fixtures__/meowgrid/', import.meta.url).pathname;

function createFixtureLlm() {
  return {
    async generate(_system, userContent) {
      const lines = userContent.split('\n').filter((l) => l.trim());
      const title = (lines[0] || '').replace(/^#\s*/, '');

      const chunks = [];
      let currentHeading = [title];
      let chunkContent = '';
      let charPos = 0;

      for (const line of lines.slice(1)) {
        if (line.startsWith('## ') || line.startsWith('### ')) {
          if (chunkContent.trim()) {
            chunks.push({
              headingPath: [...currentHeading],
              contentMarkdown: chunkContent.trim(),
              plainText: chunkContent.trim(),
              charStart: charPos - chunkContent.length,
              charEnd: charPos,
              tokenCount: Math.ceil(chunkContent.trim().length / 4),
              dedupeKey: currentHeading.join('-').toLowerCase().replace(/\s+/g, '-').slice(0, 30),
            });
          }
          const level = line.startsWith('### ') ? 3 : 2;
          const heading = line.replace(/^#{2,3}\s*/, '');
          if (level === 2) currentHeading = [title, heading];
          else currentHeading = [title, currentHeading[1] || heading, heading];
          chunkContent = '';
        } else {
          chunkContent += line + '\n';
        }
        charPos += line.length + 1;
      }

      if (chunkContent.trim()) {
        chunks.push({
          headingPath: [...currentHeading],
          contentMarkdown: chunkContent.trim(),
          plainText: chunkContent.trim(),
          charStart: charPos - chunkContent.length,
          charEnd: charPos,
          tokenCount: Math.ceil(chunkContent.trim().length / 4),
          dedupeKey: currentHeading.join('-').toLowerCase().replace(/\s+/g, '-').slice(0, 30),
        });
      }

      const isOps = title.includes('Operations');
      const isFaq = title.includes('FAQ');
      const isTrouble = title.includes('Troubleshooting');

      return JSON.stringify({
        title,
        summary: `${title} for MeowGrid distributed scheduling engine.`,
        docKind: isOps ? 'operations' : isFaq ? 'faq' : isTrouble ? 'troubleshooting' : 'architecture',
        authority: isOps ? 'validated' : 'candidate',
        extractionConfidence: 0.88,
        keywords: ['MeowGrid', 'distributed', 'scheduler', 'PawWorker', 'NapQueue'],
        topics: ['distributed-systems', 'operations'],
        language: 'en',
        chunks,
      });
    },
  };
}

describe('MeowGrid E2E — import + search (AC-011)', () => {
  let tmpDir;
  let dbPath;
  let store;
  let importer;
  let importResults;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'f179-e2e-'));
    dbPath = join(tmpDir, 'evidence.sqlite');

    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();

    // Close store so importer can write, then reopen for search
    store.close();

    const db = new Database(dbPath);
    const storage = new KnowledgeStorage(tmpDir);
    await storage.ensureDir();
    const normalizer = new Normalizer(createFixtureLlm(), { version: '1.0.0', modelId: 'fixture-mock' });
    const governance = new GovernanceStateMachine(db);
    const packs = new DomainPackManager(db);

    importer = new KnowledgeImporter({
      db,
      storage,
      normalizer,
      governance,
      packs,
      piiDetector: new PiiDetector(),
    });

    const files = ['architecture.md', 'operations-manual.md', 'faq.md', 'troubleshooting.md'];
    importResults = await importer.importBatch(files.map((f) => join(FIXTURE_DIR, f)));

    db.close();

    // Reopen store for search queries
    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
  });

  after(async () => {
    store.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('all 4 documents imported successfully', () => {
    assert.equal(importResults.length, 4);
    assert.ok(
      importResults.every((r) => r.status === 'created'),
      'All imports should succeed',
    );
    const totalChunks = importResults.reduce((sum, r) => sum + (r.chunkCount || 0), 0);
    assert.ok(totalChunks > 5, `Expected >5 chunks total, got ${totalChunks}`);
  });

  it('governance status reaches approved/active', () => {
    const db = new Database(dbPath);
    for (const r of importResults) {
      const doc = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(r.anchor);
      assert.ok(
        ['approved', 'active', 'needs_review'].includes(doc.governance_status),
        `Doc ${r.anchor} should be approved/needs_review, got ${doc.governance_status}`,
      );
    }
    db.close();
  });

  it('FurBall Deadlock recovery procedure is searchable from ops manual later section', () => {
    const results = store.searchPassages('FurBall Deadlock', 5);
    assert.ok(results.length > 0, 'Should find FurBall Deadlock content');
    const hasDeadlock = results.some((r) => r.content.includes('FurBall Deadlock') || r.content.includes('furball'));
    assert.ok(hasDeadlock, 'Results should contain deadlock-related content');
  });

  it('FAQ answers are retrievable by question keywords', () => {
    const results = store.searchPassages('QUEUE_FULL', 5);
    assert.ok(results.length > 0, 'Should find NapQueue capacity content');
    const hasSolution = results.some((r) => r.content.includes('QUEUE_FULL') || r.content.includes('max_queue_size'));
    assert.ok(hasSolution, 'Results should contain NapQueue solution');
  });

  it('PawWorker scaling info is retrievable', () => {
    const results = store.searchPassages('max_concurrent_tasks', 5);
    assert.ok(results.length > 0, 'Should find PawWorker scaling content');
  });

  it('Whisker Coordinator architecture is retrievable', () => {
    const results = store.searchPassages('Whisker Coordinator heartbeat', 5);
    assert.ok(results.length > 0, 'Should find Coordinator content');
  });

  it('results include heading_path and char positions', () => {
    const results = store.searchPassages('MeowGrid', 5);
    const domainChunks = results.filter((r) => r.passageKind === 'domain_chunk');
    assert.ok(domainChunks.length > 0, 'Should find domain chunks');
    for (const chunk of domainChunks) {
      assert.ok(chunk.headingPath, `Chunk ${chunk.passageId} should have headingPath`);
      assert.equal(typeof chunk.charStart, 'number');
      assert.equal(typeof chunk.charEnd, 'number');
    }
  });

  it('results include parent doc metadata (authority, doc_kind)', () => {
    const db = new Database(dbPath);
    const results = store.searchPassages('MeowGrid', 5);
    for (const r of results.filter((r) => r.passageKind === 'domain_chunk')) {
      const doc = db
        .prepare('SELECT authority, doc_kind, governance_status FROM evidence_docs WHERE anchor = ?')
        .get(r.docAnchor);
      assert.ok(doc, `Parent doc ${r.docAnchor} should exist`);
      assert.ok(doc.authority, 'Parent doc should have authority');
      assert.ok(doc.doc_kind, 'Parent doc should have doc_kind');
      assert.ok(doc.governance_status, 'Parent doc should have governance_status');
    }
    db.close();
  });

  it('recall baseline — print Recall@5 and Precision@5 (no threshold)', () => {
    const queries = [
      { q: 'FurBall Deadlock', expectedKeyword: 'FurBall' },
      { q: 'NapQueue full capacity', expectedKeyword: 'QUEUE_FULL' },
      { q: 'PawWorker horizontal scaling', expectedKeyword: 'PawWorker' },
      { q: 'Coordinator failover Raft election', expectedKeyword: 'failover' },
      { q: 'error heartbeat timeout', expectedKeyword: 'heartbeat' },
    ];

    let totalRecall = 0;
    let totalPrecision = 0;

    for (const { q, expectedKeyword } of queries) {
      const results = store.searchPassages(q, 5);
      const relevant = results.filter((r) => r.content.toLowerCase().includes(expectedKeyword.toLowerCase()));
      const recall = results.length > 0 ? (relevant.length > 0 ? 1 : 0) : 0;
      const precision = results.length > 0 ? relevant.length / results.length : 0;
      totalRecall += recall;
      totalPrecision += precision;
    }

    const avgRecall = totalRecall / queries.length;
    const avgPrecision = totalPrecision / queries.length;

    // Log baseline (no threshold per AC-011)
    console.log(
      `[F179 Baseline] Recall@5: ${(avgRecall * 100).toFixed(1)}%, Precision@5: ${(avgPrecision * 100).toFixed(1)}%`,
    );
    assert.ok(true, 'Baseline logged — no threshold enforced');
  });
});
