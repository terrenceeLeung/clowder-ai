import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('IndexBuilder rebuild — pack-knowledge protection (AC-201)', () => {
  it('rebuild preserves pack-knowledge docs not on disk', async () => {
    const { SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js');
    const { IndexBuilder } = await import('../../dist/domains/memory/IndexBuilder.js');

    const store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    const db = store.getDb();

    // Insert a pack-knowledge doc (API-imported, has no disk file)
    await store.upsert([
      {
        anchor: 'dk:mypack:imported-doc',
        kind: 'pack-knowledge',
        status: 'active',
        title: 'Imported Knowledge',
        summary: 'This was imported via API, not from disk',
        updatedAt: new Date().toISOString(),
        packId: 'mypack',
      },
    ]);

    // Insert a disk-sourced doc that WILL be on disk
    const docsRoot = mkdtempSync(join(tmpdir(), 'rebuild-test-'));
    const docsDir = join(docsRoot, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'on-disk.md'), '---\ntitle: On Disk\n---\nContent here');

    await store.upsert([
      {
        anchor: 'docs/on-disk.md',
        kind: 'feature',
        status: 'active',
        title: 'On Disk Doc',
        updatedAt: new Date().toISOString(),
        sourcePath: 'docs/on-disk.md',
      },
    ]);

    // Insert a stale disk doc that is NOT on disk (should be cleaned up)
    await store.upsert([
      {
        anchor: 'docs/deleted.md',
        kind: 'feature',
        status: 'active',
        title: 'Deleted Doc',
        updatedAt: new Date().toISOString(),
        sourcePath: 'docs/deleted.md',
      },
    ]);

    const builder = new IndexBuilder(store, docsRoot);
    await builder.rebuild();

    // pack-knowledge doc should still exist
    const pkDoc = await store.getByAnchor('dk:mypack:imported-doc');
    assert.ok(pkDoc, 'pack-knowledge doc should survive rebuild');
    assert.equal(pkDoc.kind, 'pack-knowledge');

    // stale disk doc should be removed
    const staleDoc = await store.getByAnchor('docs/deleted.md');
    assert.equal(staleDoc, null, 'stale disk doc should be removed');
  });
});
