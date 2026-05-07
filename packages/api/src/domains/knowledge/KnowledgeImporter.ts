// F179: Knowledge Importer — orchestrator (KD-1, AC-01, AC-04, AC-013)
// F179 Phase 2.5 (AC-2.5.2): also writes evidence_vectors (doc-level) + passage_vectors
// (chunk-level) so semantic/hybrid retrieval can hit pack-knowledge.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type Database from 'better-sqlite3';
import type { DomainPackManager } from './DomainPackManager.js';
import type { GovernanceStateMachine } from './GovernanceStateMachine.js';
import type { KnowledgeStorage } from './KnowledgeStorage.js';
import type { Normalizer } from './Normalizer.js';
import type { IPiiDetector } from './PiiDetector.js';

export interface ImportResult {
  sourcePath: string;
  anchor: string | null;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  reason?: string;
  chunkCount?: number;
  confidence?: number;
  piiDetected?: boolean;
}

export interface PassageEmbedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

export interface DocVectorStore {
  upsert(anchor: string, embedding: Float32Array): void;
  delete(anchor: string): void;
}

interface ImporterDeps {
  db: Database.Database;
  storage: KnowledgeStorage;
  normalizer: Normalizer;
  governance: GovernanceStateMachine;
  packs: DomainPackManager;
  piiDetector: IPiiDetector;
  embedder?: PassageEmbedder;
  vectorStore?: DocVectorStore;
}

export class KnowledgeImporter {
  constructor(private readonly deps: ImporterDeps) {}

  async importFile(filePath: string, opts?: { packId?: string; sourcePath?: string }): Promise<ImportResult> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      return { sourcePath: filePath, anchor: null, status: 'failed', reason: (err as Error).message };
    }
    const sourceHash = createHash('sha256').update(content).digest('hex');
    const sourcePath = opts?.sourcePath ?? filePath;

    const piiMatches = this.deps.piiDetector.scan(content);
    const piiDetected = piiMatches.length > 0;

    const existing = this.deps.db
      .prepare(
        'SELECT anchor, source_hash, governance_status FROM evidence_docs WHERE source_path = ? ORDER BY updated_at DESC LIMIT 1',
      )
      .get(sourcePath) as { anchor: string; source_hash: string; governance_status: string } | undefined;

    if (existing && existing.source_hash === sourceHash) {
      return { sourcePath, anchor: existing.anchor, status: 'skipped', reason: 'identical content' };
    }

    let normalized;
    try {
      normalized = await this.deps.normalizer.normalize(content, { sourcePath, sourceHash });
    } catch (err) {
      return { sourcePath, anchor: null, status: 'failed', reason: (err as Error).message };
    }

    const rawHash = await this.deps.storage.saveRaw(content, filePath.split('/').pop() ?? 'unknown.md');

    // Phase 2.5: collect stale passage_ids before/inside the tx so post-commit cleanup can clear vectors.
    const stalePassageIds: string[] = [];

    try {
      const packId = opts?.packId ?? this.deps.packs.ensureDefaultPack();
      const now = new Date().toISOString();
      const tx = this.deps.db.transaction(() => {
        if (existing) {
          try {
            this.deps.governance.transition(existing.anchor, 'stale');
          } catch {
            this.deps.db
              .prepare('UPDATE evidence_docs SET governance_status = ? WHERE anchor = ?')
              .run('stale', existing.anchor);
          }
          // Phase 2.5: collect stale passage_ids so we can clear their vectors after the tx commits.
          // (Reading from the same db inside the tx is fine — same connection.)
          const rows = this.deps.db
            .prepare('SELECT passage_id FROM evidence_passages WHERE doc_anchor = ?')
            .all(existing.anchor) as Array<{ passage_id: string }>;
          for (const r of rows) stalePassageIds.push(r.passage_id);
        }

        this.deps.db
          .prepare(`
          INSERT INTO evidence_docs
          (anchor, kind, status, title, summary, keywords, source_path, source_hash,
           pack_id, governance_status, extraction_confidence, doc_kind,
           normalizer_version, model_id, authority, activation,
           provenance_tier, provenance_source, updated_at)
          VALUES (?, 'pack-knowledge', 'active', ?, ?, ?, ?, ?,
                  ?, 'ingested', ?, ?, ?, ?, ?, 'query',
                  ?, ?, ?)
        `)
          .run(
            normalized.anchor,
            normalized.title,
            normalized.summary,
            JSON.stringify(normalized.keywords),
            sourcePath,
            sourceHash,
            packId,
            normalized.extractionConfidence,
            normalized.docKind,
            normalized.normalizerVersion,
            normalized.modelId,
            normalized.authority,
            'imported',
            sourcePath,
            now,
          );

        for (const chunk of normalized.chunks) {
          this.deps.db
            .prepare(`
            INSERT INTO evidence_passages
            (doc_anchor, passage_id, content, position, created_at,
             passage_kind, heading_path, chunk_index, char_start, char_end)
            VALUES (?, ?, ?, ?, ?, 'domain_chunk', ?, ?, ?, ?)
          `)
            .run(
              normalized.anchor,
              chunk.chunkId,
              chunk.contentMarkdown,
              chunk.chunkIndex,
              now,
              JSON.stringify(chunk.headingPath),
              chunk.chunkIndex,
              chunk.charStart,
              chunk.charEnd,
            );
        }

        this.deps.governance.transition(normalized.anchor, 'normalized');
        this.deps.governance.autoRoute(normalized.anchor, normalized.extractionConfidence);
      });

      tx();
    } catch (err) {
      await this.deps.storage.deleteRaw(rawHash);
      return { sourcePath, anchor: null, status: 'failed', reason: (err as Error).message };
    }

    // Phase 2.5: clear stale vectors for the previous version (kept around for governance trail
    // but vectors must not survive — they would otherwise still rank in semantic/hybrid).
    if (existing && this.deps.vectorStore) {
      try {
        this.deps.vectorStore.delete(existing.anchor);
      } catch {
        // fail-open
      }
    }
    if (existing && stalePassageIds.length > 0) {
      try {
        const placeholders = stalePassageIds.map(() => '?').join(',');
        this.deps.db
          .prepare(`DELETE FROM passage_vectors WHERE passage_id IN (${placeholders})`)
          .run(...stalePassageIds);
      } catch {
        // fail-open: passage_vectors may not exist if sqlite-vec unavailable
      }
    }

    if (this.deps.embedder && normalized.chunks.length > 0) {
      // Passage-level embeddings (passage_vectors).
      try {
        const texts = normalized.chunks.map((c) => c.contentMarkdown);
        const vectors = await this.deps.embedder.embed(texts);
        const del = this.deps.db.prepare('DELETE FROM passage_vectors WHERE passage_id = ?');
        const ins = this.deps.db.prepare('INSERT INTO passage_vectors (passage_id, embedding) VALUES (?, ?)');
        const embedTx = this.deps.db.transaction(() => {
          for (let i = 0; i < normalized.chunks.length; i++) {
            del.run(normalized.chunks[i].chunkId);
            ins.run(normalized.chunks[i].chunkId, vectors[i]);
          }
        });
        embedTx();
      } catch {
        // Fail-open: embedding failure doesn't block import
      }
    }

    // Phase 2.5 AC-2.5.2: doc-level embedding (evidence_vectors). Independent of passage embedding —
    // a passage embed failure should not skip doc embed and vice versa.
    if (this.deps.embedder && this.deps.vectorStore) {
      try {
        const docText = `${normalized.title}\n\n${normalized.summary ?? ''}`.trim();
        if (docText) {
          const [docVec] = await this.deps.embedder.embed([docText]);
          if (docVec) this.deps.vectorStore.upsert(normalized.anchor, docVec);
        }
      } catch {
        // Fail-open: doc embedding failure doesn't block import
      }
    }

    return {
      sourcePath,
      anchor: normalized.anchor,
      status: 'created',
      chunkCount: normalized.chunks.length,
      confidence: normalized.extractionConfidence,
      piiDetected,
    };
  }

  async importBatch(filePaths: string[], opts?: { packId?: string }): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    for (const fp of filePaths) {
      results.push(await this.importFile(fp, opts));
    }
    return results;
  }
}
