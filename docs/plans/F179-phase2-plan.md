# F179 Phase 2 Implementation Plan

**Feature:** F179 — `docs/features/F179-domain-knowledge-governance.md`
**Goal:** Fix 4 pre-existing bugs exposed by CVO 真机验收 + enable pack-scoped retrieval
**Acceptance Criteria:** AC-201 ~ AC-207 (see spec)
**Architecture:** Bug fixes in SqliteEvidenceStore / IndexBuilder / evidence route; search extension via packId param propagated from API → store → MCP tool
**Tech Stack:** SQLite FTS5, Fastify, Zod, better-sqlite3
**前端验证:** No — pure backend

---

### Task 1: Cascade delete — evidence_passages cleanup (AC-202)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (deleteByAnchor, deleteByPackId)
- Test: `packages/api/src/domains/memory/__tests__/cascade-delete.test.ts`

**Step 1: Write failing test**
```typescript
// Insert a doc + 2 passages → deleteByAnchor → assert passages gone
test('deleteByAnchor cascades to evidence_passages', async () => {
  // insert doc with anchor 'test-cascade'
  // insert 2 passages with doc_anchor = 'test-cascade'
  await store.deleteByAnchor('test-cascade');
  const passages = db.prepare("SELECT * FROM evidence_passages WHERE doc_anchor = 'test-cascade'").all();
  expect(passages).toHaveLength(0);
});
```

**Step 2: Run test — expect FAIL** (passages still present after delete)

**Step 3: Fix deleteByAnchor**
```typescript
async deleteByAnchor(anchor: string): Promise<void> {
  return this.writeQueue.enqueue(() => {
    this.ensureOpen();
    this.db?.prepare('DELETE FROM evidence_passages WHERE doc_anchor = ?').run(anchor);
    this.db?.prepare('DELETE FROM evidence_docs WHERE anchor = ?').run(anchor);
  });
}
```
Order matters: delete children first (passages), then parent (doc). FTS triggers on both tables handle FTS cleanup automatically.

**Step 4: Fix deleteByPackId** (same bug)
```typescript
async deleteByPackId(packId: string): Promise<number> {
  return this.writeQueue.enqueue(() => {
    this.ensureOpen();
    // Delete passages for all docs in this pack
    this.db?.prepare(
      'DELETE FROM evidence_passages WHERE doc_anchor IN (SELECT anchor FROM evidence_docs WHERE pack_id = ?)'
    ).run(packId);
    const result = this.db?.prepare('DELETE FROM evidence_docs WHERE pack_id = ?').run(packId);
    return result?.changes ?? 0;
  });
}
```

**Step 5: Run test — expect PASS**

**Step 6: Commit** `fix(F179): cascade delete evidence_passages on doc removal (AC-202)`

---

### Task 2: IndexBuilder rebuild protection (AC-201)

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (~line 386)
- Test: `packages/api/src/domains/memory/__tests__/rebuild-protection.test.ts`

**Step 1: Write failing test**
```typescript
test('rebuild() preserves pack-knowledge anchors not on disk', async () => {
  // Insert a pack-knowledge doc (kind='pack-knowledge') via store
  // Run rebuild() — it scans disk, finds no matching file
  // Assert the pack-knowledge doc still exists
});
```

**Step 2: Run test — expect FAIL** (doc gets deleted by stale-anchor cleanup)

**Step 3: Add skip condition**
In the stale-anchor cleanup loop (~line 386), after the threadListFailed check:
```typescript
for (const row of allAnchors) {
  if (!currentAnchors.has(row.anchor)) {
    if (threadListFailed && row.anchor.startsWith('thread-')) continue;
    // Skip API-imported pack-knowledge docs (not disk-sourced)
    const docKind = db.prepare('SELECT kind FROM evidence_docs WHERE anchor = ?').get(row.anchor) as { kind: string } | undefined;
    if (docKind?.kind === 'pack-knowledge') continue;
    await this.store.deleteByAnchor(row.anchor);
    this.embedDeps?.vectorStore.delete(row.anchor);
    removedAnchors.push(row.anchor);
  }
}
```

Optimization: batch-fetch kinds for all stale anchors instead of N+1 queries.

**Step 4: Run test — expect PASS**

**Step 5: Commit** `fix(F179): skip pack-knowledge docs in rebuild stale-anchor cleanup (AC-201)`

---

### Task 3: FTS integrity-check + auto-rebuild (AC-203)

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (add method)
- Modify: `packages/api/src/index.ts` (call after rebuild)
- Test: `packages/api/src/domains/memory/__tests__/fts-integrity.test.ts`

**Step 1: Write failing test**
```typescript
test('checkAndRepairFts detects and fixes corrupted FTS', async () => {
  // Manually corrupt FTS by deleting a doc row without going through trigger
  // Call checkAndRepairFts()
  // Assert FTS is now consistent
});
```

**Step 2: Implement integrity check**
New method on IndexBuilder:
```typescript
async checkAndRepairFts(): Promise<{ checked: boolean; repaired: boolean; error?: string }> {
  const db = this.store.getDb();
  try {
    db.prepare("INSERT INTO evidence_fts(evidence_fts) VALUES('integrity-check')").run();
    db.prepare("INSERT INTO passage_fts(passage_fts) VALUES('integrity-check')").run();
    return { checked: true, repaired: false };
  } catch {
    // Integrity check failed — rebuild
    try {
      db.prepare("INSERT INTO evidence_fts(evidence_fts) VALUES('rebuild')").run();
      db.prepare("INSERT INTO passage_fts(passage_fts) VALUES('rebuild')").run();
      return { checked: true, repaired: true };
    } catch (rebuildErr) {
      return { checked: true, repaired: false, error: String(rebuildErr) };
    }
  }
}
```

**Step 3: Call in startup** (index.ts, after rebuild)
```typescript
if (memoryServices.indexBuilder) {
  const result = await memoryServices.indexBuilder.rebuild();
  const ftsResult = await memoryServices.indexBuilder.checkAndRepairFts();
  if (ftsResult.repaired) {
    app.log.warn('[api] FTS index was corrupted and has been rebuilt');
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit** `fix(F179): startup FTS integrity-check with auto-rebuild (AC-203)`

---

### Task 4: queryAlwaysOn this-binding fix (AC-204)

**Files:**
- Modify: `packages/api/src/routes/evidence.ts` (~line 179)
- Test: `packages/api/src/routes/__tests__/evidence-this-binding.test.ts`

**Step 1: Write failing test**
```typescript
test('search with F163 alwaysOnInjection=on does not degrade', async () => {
  // Mock evidenceStore with queryAlwaysOn method
  // Set F163_ALWAYS_ON_INJECTION=on
  // Call GET /api/evidence/search?q=test
  // Assert degraded === false
});
```

**Step 2: Apply fix**
Already hotfixed in runtime. Formalize:
```typescript
// BEFORE (broken — this lost on extraction):
const queryAlwaysOn = (opts.evidenceStore as ...).queryAlwaysOn;
if (queryAlwaysOn) {
  injectionSources = queryAlwaysOn().map((d) => d.anchor);
}

// AFTER (fixed — method stays on object):
const store = opts.evidenceStore as { queryAlwaysOn?: () => Array<{ anchor: string }> };
if (store.queryAlwaysOn) {
  injectionSources = store.queryAlwaysOn().map((d) => d.anchor);
}
```

**Step 3: Run test — expect PASS**

**Step 4: Commit** `fix(F179): preserve this-binding on queryAlwaysOn call (AC-204)`

---

### Task 5: Pack-scoped evidence search (AC-205)

**Files:**
- Modify: `packages/api/src/routes/evidence.ts` (searchSchema + handler)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (search method)
- Modify: MCP tool definition for search_evidence (if separate)
- Test: `packages/api/src/routes/__tests__/evidence-pack-search.test.ts`

**Step 1: Write failing test**
```typescript
test('search with packId returns only that pack docs', async () => {
  // Insert 2 pack-knowledge docs: pack A and pack B
  // GET /api/evidence/search?q=test&packId=packA
  // Assert only pack A results returned
  // Assert pack-knowledge exclusion is bypassed
});
```

**Step 2: Add packId to search schema**
```typescript
const searchSchema = z.object({
  // ... existing fields ...
  packId: z.string().optional(),
});
```

**Step 3: Pass packId through to store**
In evidence.ts handler, add packId to searchOpts:
```typescript
const searchOpts = {
  // ... existing ...
  packId: parseResult.data.packId,
};
```

**Step 4: Implement pack-scoped search in SqliteEvidenceStore**
When `packId` is provided:
- Set `effectiveKind = 'pack-knowledge'` (bypasses exclusion)
- Add `AND pack_id = ?` filter
- Search within pack's docs only

**Step 5: Run test — expect PASS**

**Step 6: Commit** `feat(F179): pack-scoped evidence search via packId param (AC-205)`

---

### Task 6: RAG injection via tool call (AC-206)

**Files:**
- Modify: MCP search_evidence tool to expose packId parameter
- Test: integration test confirming tool returns pack knowledge

**Step 1: Verify MCP tool definition**
Check how search_evidence MCP tool maps to the API. If it's a direct proxy to `/api/evidence/search`, adding `packId` to the API (Task 5) automatically enables it.

**Step 2: Write integration test**
```typescript
test('search_evidence with packId returns pack knowledge in agent context', async () => {
  // Import a knowledge doc to a pack
  // Call search_evidence tool with packId
  // Assert results include the imported doc
});
```

**Step 3: Update tool definition if needed**
Add `packId` parameter to the tool's schema/description so agents know to use it.

**Step 4: Commit** `feat(F179): enable pack knowledge retrieval via search_evidence tool (AC-206)`

---

### Task 7: End-to-end validation (AC-207)

**Files:**
- Test: `packages/api/src/domains/memory/__tests__/knowledge-e2e.test.ts`

**Step 1: Write E2E test**
```typescript
test('import → restart → pack-scoped search → delete → no orphans', async () => {
  // 1. Import knowledge doc to a pack
  // 2. Simulate restart (rebuild)
  // 3. Pack-scoped search returns the doc
  // 4. Delete the doc
  // 5. Assert no orphan passages remain
  // 6. Assert FTS is consistent
});
```

**Step 2: Run full test suite**

**Step 3: Commit** `test(F179): end-to-end knowledge lifecycle validation (AC-207)`

---

## Execution Order

Tasks 1-4 (bug fixes) are independent and can be done in sequence.
Task 5 depends on Task 1 (clean delete needed for teardown).
Task 6 depends on Task 5 (packId API must exist).
Task 7 validates everything together.

Recommended: 1 → 2 → 3 → 4 → 5 → 6 → 7
