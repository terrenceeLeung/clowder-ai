// F179: Private Knowledge Storage — .clowder/knowledge/ management

import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { KnowledgeStorage } from '../dist/domains/knowledge/KnowledgeStorage.js';

describe('KnowledgeStorage', () => {
  let tmpRoot;
  let storage;

  before(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'f179-storage-'));
    storage = new KnowledgeStorage(tmpRoot);
  });

  after(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('ensureDir creates .clowder/knowledge/', async () => {
    const dir = await storage.ensureDir();
    assert.ok(dir.endsWith('.clowder/knowledge'));
    const entries = await readdir(join(tmpRoot, '.clowder'));
    assert.ok(entries.includes('knowledge'));
  });

  it('ensureGitignore appends entry to .gitignore', async () => {
    await storage.ensureGitignore();
    const content = await readFile(join(tmpRoot, '.gitignore'), 'utf-8');
    assert.ok(content.includes('.clowder/knowledge/'));
  });

  it('ensureGitignore does not duplicate entry', async () => {
    await storage.ensureGitignore();
    await storage.ensureGitignore();
    const content = await readFile(join(tmpRoot, '.gitignore'), 'utf-8');
    const count = content.split('.clowder/knowledge/').length - 1;
    assert.equal(count, 1, 'gitignore entry should appear exactly once');
  });

  it('saveRaw writes file and returns hash', async () => {
    const content = '# Test Document\n\nHello world';
    const hash = await storage.saveRaw(content, 'test-doc.md');
    assert.ok(typeof hash === 'string' && hash.length > 0);
    const entries = await readdir(join(tmpRoot, '.clowder', 'knowledge'));
    assert.ok(entries.includes(hash));
  });

  it('readRaw returns saved content', async () => {
    const content = '# Another Document\n\nContent here';
    const hash = await storage.saveRaw(content, 'another.md');
    const retrieved = await storage.readRaw(hash);
    assert.equal(retrieved, content);
  });

  it('readRaw returns null for missing hash', async () => {
    const result = await storage.readRaw('nonexistent-hash');
    assert.equal(result, null);
  });

  it('deleteRaw removes stored file', async () => {
    const content = '# Temp Document';
    const hash = await storage.saveRaw(content, 'temp.md');
    await storage.deleteRaw(hash);
    const result = await storage.readRaw(hash);
    assert.equal(result, null);
  });

  it('getMeta returns original filename and import time', async () => {
    const content = '# Meta Test';
    const hash = await storage.saveRaw(content, 'my-notes.md');
    const meta = await storage.getMeta(hash);
    assert.equal(meta.originalName, 'my-notes.md');
    assert.ok(meta.importedAt);
  });
});
