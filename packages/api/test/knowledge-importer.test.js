// F179: KnowledgeImporter — orchestrator integration test

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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

const VALID_LLM_RESPONSE = {
  title: 'Test Document',
  summary: 'A test document for import validation.',
  docKind: 'guide',
  authority: 'candidate',
  extractionConfidence: 0.85,
  keywords: ['test', 'import'],
  topics: ['testing'],
  language: 'en',
  chunks: [
    {
      headingPath: ['Test Document'],
      contentMarkdown: 'This is the first section content.',
      plainText: 'This is the first section content.',
      charStart: 18,
      charEnd: 51,
      tokenCount: 7,
      dedupeKey: 'test-section-1',
    },
    {
      headingPath: ['Test Document', 'Details'],
      contentMarkdown: 'More detailed content in section two.',
      plainText: 'More detailed content in section two.',
      charStart: 65,
      charEnd: 101,
      tokenCount: 7,
      dedupeKey: 'test-details',
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

const SAMPLE_MD = `# Test Document

This is the first section content.

## Details

More detailed content in section two.
`;

describe('KnowledgeImporter', () => {
  let db;
  let tmpRoot;
  let importer;

  before(async () => {
    db = freshDb();
    tmpRoot = await mkdtemp(join(tmpdir(), 'f179-import-'));
    const storage = new KnowledgeStorage(tmpRoot);
    await storage.ensureDir();
    await storage.ensureGitignore();
    const normalizer = new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' });
    const governance = new GovernanceStateMachine(db);
    const packs = new DomainPackManager(db);
    const piiDetector = new PiiDetector();

    importer = new KnowledgeImporter({
      db,
      storage,
      normalizer,
      governance,
      packs,
      piiDetector,
    });

    // Write test file
    await mkdir(join(tmpRoot, 'docs'), { recursive: true });
    await writeFile(join(tmpRoot, 'docs', 'test.md'), SAMPLE_MD);
  });

  after(async () => {
    db.close();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('importFile creates evidence_docs + evidence_passages', async () => {
    const result = await importer.importFile(join(tmpRoot, 'docs', 'test.md'));
    assert.equal(result.status, 'created');
    assert.ok(result.anchor);
    assert.equal(result.chunkCount, 2);

    const doc = db.prepare('SELECT * FROM evidence_docs WHERE anchor = ?').get(result.anchor);
    assert.ok(doc);
    assert.equal(doc.kind, 'pack-knowledge');
    assert.equal(doc.title, 'Test Document');

    const passages = db.prepare('SELECT * FROM evidence_passages WHERE doc_anchor = ?').all(result.anchor);
    assert.equal(passages.length, 2);
  });

  it('anchor format is dk:uuid (AC-04)', async () => {
    await writeFile(join(tmpRoot, 'docs', 'anchor-test.md'), '# Anchor Test\n\nContent.');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'anchor-test.md'));
    assert.match(result.anchor, /^dk:[0-9a-f-]{36}$/);
  });

  it('pack_id defaults to "default" (AC-012)', async () => {
    await writeFile(join(tmpRoot, 'docs', 'pack-test.md'), '# Pack Default\n\nContent.');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'pack-test.md'));
    const doc = db.prepare('SELECT pack_id FROM evidence_docs WHERE anchor = ?').get(result.anchor);
    assert.equal(doc.pack_id, 'default');
  });

  it('same file same content = skip (KD-20)', async () => {
    const filePath = join(tmpRoot, 'docs', 'dedup.md');
    await writeFile(filePath, '# Dedup Test\n\nSame content.');
    await importer.importFile(filePath);
    const result2 = await importer.importFile(filePath);
    assert.equal(result2.status, 'skipped');
  });

  it('same file different content = new version, old marked stale (KD-20)', async () => {
    const filePath = join(tmpRoot, 'docs', 'version.md');
    await writeFile(filePath, '# Version Test\n\nVersion 1.');
    const r1 = await importer.importFile(filePath);

    await writeFile(filePath, '# Version Test\n\nVersion 2 with changes.');
    const r2 = await importer.importFile(filePath);

    assert.equal(r2.status, 'created');
    assert.notEqual(r1.anchor, r2.anchor);

    const oldDoc = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(r1.anchor);
    assert.equal(oldDoc.governance_status, 'stale');
  });

  it('passages have passage_kind = domain_chunk', async () => {
    await writeFile(join(tmpRoot, 'docs', 'kind-test.md'), '# Kind Test\n\nContent.');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'kind-test.md'));
    const passages = db.prepare('SELECT passage_kind FROM evidence_passages WHERE doc_anchor = ?').all(result.anchor);
    assert.ok(passages.every((p) => p.passage_kind === 'domain_chunk'));
  });

  it('passages have heading_path and char positions', async () => {
    await writeFile(join(tmpRoot, 'docs', 'pos-test.md'), '# Position Test\n\nContent here.');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'pos-test.md'));
    const passages = db
      .prepare('SELECT heading_path, char_start, char_end FROM evidence_passages WHERE doc_anchor = ?')
      .all(result.anchor);
    assert.ok(passages.length > 0);
    const p = passages[0];
    assert.ok(p.heading_path);
    assert.equal(typeof p.char_start, 'number');
    assert.equal(typeof p.char_end, 'number');
  });

  it('atomicity: normalizer failure leaves no residue (AC-013)', async () => {
    const failLlm = {
      async generate() {
        throw new Error('LLM down');
      },
    };
    const failNormalizer = new Normalizer(failLlm, { version: '1.0.0', modelId: 'fail' });
    const failImporter = new KnowledgeImporter({
      db,
      storage: new KnowledgeStorage(tmpRoot),
      normalizer: failNormalizer,
      governance: new GovernanceStateMachine(db),
      packs: new DomainPackManager(db),
      piiDetector: new PiiDetector(),
    });

    await writeFile(join(tmpRoot, 'docs', 'fail-test.md'), '# Fail Test\n\nShould not persist.');
    const result = await failImporter.importFile(join(tmpRoot, 'docs', 'fail-test.md'));
    assert.equal(result.status, 'failed');

    // No orphaned docs
    const docs = db.prepare("SELECT * FROM evidence_docs WHERE source_path LIKE '%fail-test.md'").all();
    assert.equal(docs.length, 0);
  });

  it('PII detection records but does not block', async () => {
    await writeFile(join(tmpRoot, 'docs', 'pii-test.md'), '# PII Test\n\n联系电话: 13812345678');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'pii-test.md'));
    assert.equal(result.status, 'created');
    assert.ok(result.piiDetected);
  });

  it('importBatch processes multiple files', async () => {
    await writeFile(join(tmpRoot, 'docs', 'batch1.md'), '# Batch 1\n\nFirst.');
    await writeFile(join(tmpRoot, 'docs', 'batch2.md'), '# Batch 2\n\nSecond.');
    const results = await importer.importBatch([
      join(tmpRoot, 'docs', 'batch1.md'),
      join(tmpRoot, 'docs', 'batch2.md'),
    ]);
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.status === 'created'));
  });

  it('P1-1: normalization failure does NOT mark old version stale', async () => {
    const filePath = join(tmpRoot, 'docs', 'stale-guard.md');
    await writeFile(filePath, '# Stale Guard\n\nVersion 1.');
    const r1 = await importer.importFile(filePath);
    assert.equal(r1.status, 'created');

    const beforeStatus = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(r1.anchor);

    const failImporter = new KnowledgeImporter({
      db,
      storage: new KnowledgeStorage(tmpRoot),
      normalizer: new Normalizer(
        {
          async generate() {
            throw new Error('LLM down');
          },
        },
        { version: '1.0.0', modelId: 'fail' },
      ),
      governance: new GovernanceStateMachine(db),
      packs: new DomainPackManager(db),
      piiDetector: new PiiDetector(),
    });

    await writeFile(filePath, '# Stale Guard\n\nVersion 2 changed content.');
    const r2 = await failImporter.importFile(filePath);
    assert.equal(r2.status, 'failed');

    const afterStatus = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(r1.anchor);
    assert.equal(
      afterStatus.governance_status,
      beforeStatus.governance_status,
      'Old version should NOT be marked stale when new import fails',
    );
  });

  it('P1-2: DB transaction failure cleans up saved raw files', async () => {
    const isoTmp = await mkdtemp(join(tmpdir(), 'f179-orphan-'));
    const isoDb = freshDb();
    const isoStorage = new KnowledgeStorage(isoTmp);
    await isoStorage.ensureDir();

    const knDir = join(isoTmp, '.clowder', 'knowledge');
    const initialEntries = (await readdir(knDir)).length;

    const sabotageLlm = {
      async generate() {
        isoDb.exec('DROP TABLE IF EXISTS evidence_passages');
        return JSON.stringify(VALID_LLM_RESPONSE);
      },
    };

    const isoImporter = new KnowledgeImporter({
      db: isoDb,
      storage: isoStorage,
      normalizer: new Normalizer(sabotageLlm, { version: '1.0.0', modelId: 'mock' }),
      governance: new GovernanceStateMachine(isoDb),
      packs: new DomainPackManager(isoDb),
      piiDetector: new PiiDetector(),
    });

    await writeFile(join(isoTmp, 'orphan-test.md'), '# Orphan Test\n\nContent.');
    const result = await isoImporter.importFile(join(isoTmp, 'orphan-test.md'));
    assert.equal(result.status, 'failed');

    const afterEntries = (await readdir(knDir)).length;
    assert.equal(afterEntries, initialEntries, 'No orphan raw files should remain after DB failure');

    try {
      isoDb.close();
    } catch {}
    await rm(isoTmp, { recursive: true, force: true });
  });

  it('P1-2b: ensureDefaultPack failure also cleans up raw files', async () => {
    const isoTmp = await mkdtemp(join(tmpdir(), 'f179-pack-fail-'));
    const isoDb = freshDb();
    const isoStorage = new KnowledgeStorage(isoTmp);
    await isoStorage.ensureDir();

    const knDir = join(isoTmp, '.clowder', 'knowledge');
    const initialEntries = (await readdir(knDir)).length;

    // Drop domain_packs table so ensureDefaultPack throws
    isoDb.exec('DROP TABLE IF EXISTS domain_packs');

    const isoImporter = new KnowledgeImporter({
      db: isoDb,
      storage: isoStorage,
      normalizer: new Normalizer(mockLlm(), { version: '1.0.0', modelId: 'mock' }),
      governance: new GovernanceStateMachine(isoDb),
      packs: new DomainPackManager(isoDb),
      piiDetector: new PiiDetector(),
    });

    await writeFile(join(isoTmp, 'pack-fail.md'), '# Pack Fail\n\nContent.');
    const result = await isoImporter.importFile(join(isoTmp, 'pack-fail.md'));
    assert.equal(result.status, 'failed');

    const afterEntries = (await readdir(knDir)).length;
    assert.equal(afterEntries, initialEntries, 'No orphan raw files when ensureDefaultPack fails');

    try {
      isoDb.close();
    } catch {}
    await rm(isoTmp, { recursive: true, force: true });
  });

  it('P2-1: imported doc has provenance metadata (AC-010)', async () => {
    await writeFile(join(tmpRoot, 'docs', 'prov-test.md'), '# Provenance Test\n\nContent.');
    const result = await importer.importFile(join(tmpRoot, 'docs', 'prov-test.md'));
    assert.equal(result.status, 'created');

    const doc = db
      .prepare('SELECT provenance_tier, provenance_source FROM evidence_docs WHERE anchor = ?')
      .get(result.anchor);
    assert.ok(doc.provenance_tier, 'Should have provenance_tier');
    assert.ok(doc.provenance_source, 'Should have provenance_source');
  });
});
