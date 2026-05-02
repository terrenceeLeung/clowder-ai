// F179: Knowledge Importer — orchestrator (KD-1, AC-01, AC-04, AC-013)

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

interface ImporterDeps {
  db: Database.Database;
  storage: KnowledgeStorage;
  normalizer: Normalizer;
  governance: GovernanceStateMachine;
  packs: DomainPackManager;
  piiDetector: IPiiDetector;
  embedder?: PassageEmbedder;
}

export class KnowledgeImporter {
  constructor(private readonly deps: ImporterDeps) {}

  async importFile(filePath: string, opts?: { packId?: string }): Promise<ImportResult> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      return { sourcePath: filePath, anchor: null, status: 'failed', reason: (err as Error).message };
    }
    const sourceHash = createHash('sha256').update(content).digest('hex');
    const sourcePath = filePath;

    const piiMatches = this.deps.piiDetector.scan(content);
    const piiDetected = piiMatches.length > 0;

    const existing = this.deps.db
      .prepare(
        "SELECT anchor, source_hash, governance_status FROM evidence_docs WHERE source_hash = ? AND kind = 'pack-knowledge' ORDER BY updated_at DESC LIMIT 1",
      )
      .get(sourceHash) as { anchor: string; source_hash: string; governance_status: string } | undefined;

    if (existing) {
      return { sourcePath, anchor: existing.anchor, status: 'skipped', reason: 'identical content' };
    }

    let normalized;
    try {
      normalized = await this.deps.normalizer.normalize(content, { sourcePath, sourceHash });
    } catch (err) {
      return { sourcePath, anchor: null, status: 'failed', reason: (err as Error).message };
    }

    const rawHash = await this.deps.storage.saveRaw(content, filePath.split('/').pop() ?? 'unknown.md');

    try {
      const packId = opts?.packId ?? this.deps.packs.ensureDefaultPack();
      const now = new Date().toISOString();
      const tx = this.deps.db.transaction(() => {
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

    if (this.deps.embedder && normalized.chunks.length > 0) {
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
