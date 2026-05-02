# F179 Phase 1: Knowledge Hub — Implementation Plan

**Feature:** F179 — `docs/features/F179-domain-knowledge-governance.md`
**Goal:** Users can import, browse, search, and manage domain knowledge through a web UI with full transparency (raw → doc → chunks).
**Acceptance Criteria:** AC-11 through AC-18 (8 items from spec)
**Architecture:** Fastify API routes + Next.js App Router page with Zustand store. Reuses Phase 0's KnowledgeImporter, GovernanceStateMachine, and searchPassagesHybrid.
**Tech Stack:** Fastify + @fastify/multipart (backend), Next.js 14 + Tailwind + Zustand (frontend)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Straight-Line Check

**B (finish line):** User uploads .md files via web UI, sees import results with chunk breakdown and governance status, searches content by keyword and gets exact chunk matches with source context, manages domain packs.

**NOT building:** PDF/DOCX/URL adapters (scope says Phase 1 but no AC requires it — defer to Phase 1.5 if needed), Knowledge Graph visualization, Skill evolution, external RAG.

**Terminal schema:**

```typescript
// API Routes (Fastify)
POST   /api/knowledge/import          // multipart file upload → ImportResult[]
GET    /api/knowledge/docs            // list docs with governance status + pack
GET    /api/knowledge/docs/:anchor    // doc detail: metadata + chunks
GET    /api/knowledge/search          // passage-level hybrid search
PATCH  /api/knowledge/docs/:anchor    // edit metadata (keywords, doc_kind)
GET    /api/knowledge/packs           // list domain packs
POST   /api/knowledge/packs           // create pack
PATCH  /api/knowledge/packs/:id       // rename pack
POST   /api/knowledge/packs/:id/graduate  // trigger LLM graduation analysis

// Zustand Store
interface KnowledgeStore {
  docs: KnowledgeDoc[];
  packs: DomainPack[];
  searchResults: PassageResult[];
  importProgress: ImportProgress | null;
  // actions
  fetchDocs(): Promise<void>;
  importFiles(files: File[]): Promise<ImportResult[]>;
  searchPassages(query: string): Promise<void>;
  updateDocMetadata(anchor: string, patch: Partial<DocMeta>): Promise<void>;
}
```

---

## Task Breakdown

### Task 1: Backend API Routes — Knowledge CRUD

**Files:**
- Create: `packages/api/src/routes/knowledge.ts`
- Modify: `packages/api/src/routes/index.ts` (register new routes)
- Test: `packages/api/test/knowledge-routes.test.js`

**Covers:** Foundation for AC-11, AC-12, AC-14, AC-17

**Endpoints:**
1. `POST /api/knowledge/import` — Accept multipart .md files, call KnowledgeImporter.importBatch, return ImportResult[]
2. `GET /api/knowledge/docs` — Query evidence_docs where kind='pack-knowledge', join governance_status, return list with chunk counts
3. `GET /api/knowledge/docs/:anchor` — Return doc metadata + all evidence_passages for that anchor (transparency chain)
4. `GET /api/knowledge/search` — Call searchPassagesHybrid, return passage results with parent doc context
5. `PATCH /api/knowledge/docs/:anchor` — Update keywords/doc_kind on evidence_docs

**TDD steps:** Write route test → verify fail → implement route → verify pass → commit.

---

### Task 2: Backend API Routes — Pack Management

**Files:**
- Modify: `packages/api/src/routes/knowledge.ts` (add pack routes)
- Test: `packages/api/test/knowledge-routes.test.js` (add pack tests)

**Covers:** AC-12 (pack context), AC-15 (graduation foundation)

**Endpoints:**
1. `GET /api/knowledge/packs` — List domain packs via DomainPackManager
2. `POST /api/knowledge/packs` — Create named domain pack
3. `PATCH /api/knowledge/packs/:id` — Rename pack
4. `POST /api/knowledge/packs/:id/graduate` — Analyze chunks, generate split suggestion via LLM

---

### Task 3: Frontend — Knowledge Hub Page Shell + Zustand Store

**Files:**
- Create: `packages/web/src/app/knowledge/page.tsx`
- Create: `packages/web/src/app/knowledge/layout.tsx`
- Create: `packages/web/src/stores/knowledgeStore.ts`
- Create: `packages/web/src/components/knowledge/KnowledgeHub.tsx`

**Covers:** AC-12 (hub structure), AC-16 (texture foundation)

**Implementation:**
- Tab-based layout: Browse | Import | Search | Packs
- Zustand store with API integration via apiFetch
- Document list with governance status badges and doc_kind texture

---

### Task 4: Frontend — Import Wizard + Import Summary

**Files:**
- Create: `packages/web/src/components/knowledge/ImportWizard.tsx`
- Create: `packages/web/src/components/knowledge/ImportSummary.tsx`

**Covers:** AC-11 (import wizard), AC-13 (confidence routing), AC-17 (import summary)

**Implementation:**
- Step 1: File picker (drag & drop .md files)
- Step 2: Preview (file list + size)
- Step 3: Import progress (real-time results from API)
- Step 4: Import Summary — chunk total, needs_review count, auto-approved count
- Confidence routing: extractionConfidence < 0.7 → highlight for review, >= 0.7 → auto-archived badge

---

### Task 5: Frontend — Document Detail (Transparency Chain)

**Files:**
- Create: `packages/web/src/components/knowledge/DocDetail.tsx`
- Create: `packages/web/src/components/knowledge/ChunkViewer.tsx`

**Covers:** AC-12 (raw → doc → chunk transparency)

**Implementation:**
- Three-panel view: Source metadata | Document summary | Chunk list
- Each chunk: heading_path breadcrumb, content preview, char_start:char_end position
- Governance status badge with state machine info

---

### Task 6: Frontend — Retrieval Playground + In-place Tuning

**Files:**
- Create: `packages/web/src/components/knowledge/RetrievalPlayground.tsx`
- Create: `packages/web/src/components/knowledge/MetadataEditor.tsx`

**Covers:** AC-14 (search → chunk match), AC-18 (edit metadata / add keyword)

**Implementation:**
- Search input → call /api/knowledge/search → display chunk results with parent doc context
- Each result: chunk content highlighted, heading_path, doc_kind badge, confidence score
- "Edit" button on each result → inline metadata editor (keywords[], doc_kind select)
- After edit → re-search to verify improved recall

---

### Task 7: Frontend — Knowledge Texture + Pack Graduation

**Files:**
- Modify: `packages/web/src/components/knowledge/KnowledgeHub.tsx` (texture styling)
- Create: `packages/web/src/components/knowledge/PackGraduationDialog.tsx`

**Covers:** AC-15 (pack graduation), AC-16 (knowledge texture)

**Implementation:**
- Knowledge Texture: doc_kind → color/icon mapping (guide=blue, reference=green, tutorial=purple, faq=amber, runbook=red)
- Pack tab: list packs, create/rename, chunk count per pack
- Graduation: "Analyze" button when chunk count > threshold → LLM returns topic clusters + suggested pack names → user confirms → one-click split

---

## Execution Order

1. Task 1 + Task 2 (backend, no frontend dependency)
2. Task 3 (frontend shell, needs backend running)
3. Task 4 + Task 5 (import + browse, parallel)
4. Task 6 (search, needs imported data)
5. Task 7 (polish + graduation)

## Risk

| Risk | Mitigation |
|------|-----------|
| LLM pack graduation quality | Use structured prompt with JSON output, user confirms before split |
| File upload size limits | Cap at 1MB per file, 10 files per batch for Phase 1 |
| Embedding service not running | searchPassagesHybrid degrades to BM25-only (Phase 0 fail-open) |
