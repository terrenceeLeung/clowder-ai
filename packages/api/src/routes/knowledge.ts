import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import multipart from '@fastify/multipart';
import type Database from 'better-sqlite3';
import type { FastifyPluginAsync } from 'fastify';

interface ImportResult {
  sourcePath: string;
  anchor: string | null;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  reason?: string;
  chunkCount?: number;
  confidence?: number;
}

interface KnowledgeImporter {
  importFile(filePath: string, opts?: { packId?: string; sourcePath?: string }): Promise<ImportResult>;
}

interface KnowledgeRoutesOptions {
  importer?: KnowledgeImporter;
  db: Database.Database;
  projectRoot?: string;
}

export const knowledgeRoutes: FastifyPluginAsync<KnowledgeRoutesOptions> = async (app, opts) => {
  const { importer, db, projectRoot = '/tmp' } = opts;

  await app.register(multipart, { limits: { fileSize: 1_048_576, files: 10 } });

  app.post('/api/knowledge/import', async (request, reply) => {
    if (!importer) {
      return reply.status(501).send({ error: 'Import pipeline not yet wired (pending Phase 0 services)' });
    }

    const uploadDir = join(projectRoot, '.knowledge-uploads');
    await mkdir(uploadDir, { recursive: true });

    const uploads: Array<{ filePath: string; sourcePath: string }> = [];
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const safeName = basename(part.filename).replace(/[^\w.-]/g, '_');
        if (!safeName || safeName.startsWith('.')) continue;
        if (!/\.(md|mdx|txt|markdown)$/i.test(safeName)) continue;
        const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
        const stem = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
        const uniqueName = `${stem}-${randomUUID().slice(0, 8)}${ext}`;
        const buffer = await part.toBuffer();
        const dest = join(uploadDir, uniqueName);
        await writeFile(dest, buffer);
        uploads.push({ filePath: dest, sourcePath: join(uploadDir, safeName) });
      }
    }

    const results: ImportResult[] = [];
    for (const u of uploads) {
      results.push(await importer.importFile(u.filePath, { sourcePath: u.sourcePath }));
    }
    return { results };
  });

  app.get('/api/knowledge/docs', async () => {
    const rows = db
      .prepare(
        `SELECT anchor, kind, status, title, summary, governance_status, updated_at
         FROM evidence_docs
         WHERE kind = 'pack-knowledge'
         ORDER BY updated_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;

    return {
      docs: rows.map((r) => ({
        anchor: r.anchor,
        kind: r.kind,
        status: r.status,
        title: r.title,
        summary: r.summary,
        governanceStatus: r.governance_status,
        updatedAt: r.updated_at,
      })),
    };
  });

  app.get<{ Params: { anchor: string } }>('/api/knowledge/docs/:anchor', async (request, reply) => {
    const { anchor } = request.params;

    const doc = db
      .prepare(
        `SELECT anchor, kind, status, title, summary, governance_status, updated_at,
                keywords, doc_kind
         FROM evidence_docs WHERE anchor = ? AND kind = 'pack-knowledge'`,
      )
      .get(anchor) as Record<string, unknown> | undefined;

    if (!doc) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const passages = db
      .prepare(
        `SELECT passage_id, content, position, heading_path, chunk_index,
                char_start, char_end, created_at
         FROM evidence_passages
         WHERE doc_anchor = ?
         ORDER BY position ASC`,
      )
      .all(anchor) as Array<Record<string, unknown>>;

    return {
      doc: {
        anchor: doc.anchor,
        kind: doc.kind,
        status: doc.status,
        title: doc.title,
        summary: doc.summary,
        governanceStatus: doc.governance_status,
        updatedAt: doc.updated_at,
        keywords: doc.keywords ? JSON.parse(doc.keywords as string) : [],
        docKind: doc.doc_kind ?? null,
      },
      passages: passages.map((p) => ({
        passageId: p.passage_id,
        content: p.content,
        position: p.position,
        headingPath: p.heading_path ? JSON.parse(p.heading_path as string) : null,
        chunkIndex: p.chunk_index,
        charStart: p.char_start,
        charEnd: p.char_end,
        createdAt: p.created_at,
      })),
    };
  });

  app.get<{ Querystring: { q: string; limit?: string } }>('/api/knowledge/search', async (request, reply) => {
    const { q, limit: limitStr } = request.query;
    if (!q) {
      return reply.status(400).send({ error: 'Query parameter q is required' });
    }

    const limit = Math.max(1, Math.min(Number(limitStr) || 10, 50));

    let rows: Array<Record<string, unknown>>;
    try {
      rows = db
        .prepare(
          `SELECT p.passage_id, p.doc_anchor, p.content, p.position,
                  p.heading_path, p.chunk_index, p.char_start, p.char_end,
                  d.doc_kind, bm25(passage_fts) AS rank
           FROM passage_fts f
           JOIN evidence_passages p ON p.rowid = f.rowid
           JOIN evidence_docs d ON d.anchor = p.doc_anchor
           WHERE passage_fts MATCH ?
             AND d.kind = 'pack-knowledge'
             AND d.governance_status NOT IN ('stale','retired','rejected','failed')
           ORDER BY rank
           LIMIT ?`,
        )
        .all(q, limit) as Array<Record<string, unknown>>;
    } catch {
      return { results: [] };
    }

    return {
      results: rows.map((r) => ({
        passageId: r.passage_id,
        docAnchor: r.doc_anchor,
        content: r.content,
        position: r.position,
        headingPath: r.heading_path ? JSON.parse(r.heading_path as string) : null,
        chunkIndex: r.chunk_index,
        charStart: r.char_start,
        charEnd: r.char_end,
        docKind: r.doc_kind ?? null,
      })),
    };
  });

  // --- Document metadata edit (AC-18) ---

  app.patch<{ Params: { anchor: string }; Body: { keywords?: string[]; docKind?: string } }>(
    '/api/knowledge/docs/:anchor',
    async (request, reply) => {
      const { anchor } = request.params;
      const { keywords, docKind } = request.body;

      const existing = db
        .prepare("SELECT anchor FROM evidence_docs WHERE anchor = ? AND kind = 'pack-knowledge'")
        .get(anchor);
      if (!existing) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      if (keywords !== undefined) {
        db.prepare('UPDATE evidence_docs SET keywords = ? WHERE anchor = ?').run(JSON.stringify(keywords), anchor);
      }
      if (docKind !== undefined) {
        db.prepare('UPDATE evidence_docs SET doc_kind = ? WHERE anchor = ?').run(docKind, anchor);
      }

      const updated = db.prepare('SELECT keywords, doc_kind FROM evidence_docs WHERE anchor = ?').get(anchor) as Record<
        string,
        unknown
      >;

      return {
        anchor,
        keywords: updated.keywords ? JSON.parse(updated.keywords as string) : [],
        docKind: updated.doc_kind ?? null,
      };
    },
  );

  // --- Pack management ---

  app.get('/api/knowledge/packs', async () => {
    const rows = db
      .prepare(
        `SELECT p.pack_id, p.name, p.description, p.created_at,
                COUNT(d.anchor) AS doc_count
         FROM domain_packs p
         LEFT JOIN evidence_docs d ON d.pack_id = p.pack_id
         GROUP BY p.pack_id
         ORDER BY p.created_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;

    return {
      packs: rows.map((r) => ({
        packId: r.pack_id,
        name: r.name,
        description: r.description,
        createdAt: r.created_at,
        docCount: r.doc_count,
      })),
    };
  });

  app.post<{ Body: { name: string; description?: string } }>('/api/knowledge/packs', async (request, reply) => {
    const { name, description } = request.body;
    const packId = `pack-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO domain_packs (pack_id, name, description, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(packId, name, description ?? null, now);

    return reply.status(201).send({ packId, name, description: description ?? null, createdAt: now });
  });

  app.patch<{ Params: { id: string }; Body: { name: string } }>('/api/knowledge/packs/:id', async (request, reply) => {
    const { id } = request.params;
    const { name } = request.body;

    const existing = db.prepare('SELECT pack_id FROM domain_packs WHERE pack_id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Pack not found' });
    }

    db.prepare('UPDATE domain_packs SET name = ? WHERE pack_id = ?').run(name, id);
    return { packId: id, name };
  });

  // --- Pack graduation analysis (AC-15) ---

  app.post<{ Params: { id: string } }>('/api/knowledge/packs/:id/graduate', async (request, reply) => {
    const { id } = request.params;

    const pack = db.prepare('SELECT pack_id, name FROM domain_packs WHERE pack_id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!pack) {
      return reply.status(404).send({ error: 'Pack not found' });
    }

    const passages = db
      .prepare(
        `SELECT p.heading_path, p.content
         FROM evidence_passages p
         JOIN evidence_docs d ON d.anchor = p.doc_anchor
         WHERE d.pack_id = ? AND p.passage_kind = 'domain_chunk'`,
      )
      .all(id) as Array<Record<string, unknown>>;

    if (passages.length < 10) {
      return reply.status(400).send({
        error: 'Not enough chunks for graduation analysis',
        chunkCount: passages.length,
        threshold: 10,
      });
    }

    const topicMap = new Map<string, number>();
    for (const p of passages) {
      const path = p.heading_path ? JSON.parse(p.heading_path as string) : [];
      const topic = (path[0] as string) || 'Uncategorized';
      topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
    }

    const clusters = Array.from(topicMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({
        suggestedName: topic,
        chunkCount: count,
      }));

    return {
      packId: id,
      packName: pack.name,
      totalChunks: passages.length,
      clusters,
    };
  });

  app.post<{ Params: { id: string }; Body: { splits: Array<{ name: string; topics: string[] }> } }>(
    '/api/knowledge/packs/:id/graduate/confirm',
    async (request, reply) => {
      const { id } = request.params;
      const { splits } = request.body ?? {};
      if (!Array.isArray(splits) || splits.length === 0)
        return reply.status(400).send({ error: 'splits array is required' });
      if (!db.prepare('SELECT pack_id FROM domain_packs WHERE pack_id = ?').get(id))
        return reply.status(404).send({ error: 'Pack not found' });

      const created: Array<{ packId: string; name: string; movedDocs: number }> = [];
      const now = new Date().toISOString();
      for (const split of splits) {
        const newId = `pack-${randomUUID().slice(0, 8)}`;
        db.prepare('INSERT INTO domain_packs (pack_id, name, created_at) VALUES (?, ?, ?)').run(newId, split.name, now);
        let movedDocs = 0;
        for (const topic of split.topics) {
          const escaped = topic.replace(/[%_]/g, (c) => `\\${c}`);
          const docs = db
            .prepare(
              `SELECT DISTINCT d.anchor FROM evidence_docs d
               JOIN evidence_passages p ON p.doc_anchor = d.anchor
               WHERE d.pack_id = ? AND p.heading_path LIKE ? ESCAPE '\\'`,
            )
            .all(id, `%"${escaped}"%`) as Array<{ anchor: string }>;
          for (const doc of docs) {
            db.prepare('UPDATE evidence_docs SET pack_id = ? WHERE anchor = ?').run(newId, doc.anchor);
            movedDocs++;
          }
        }
        created.push({ packId: newId, name: split.name, movedDocs });
      }
      return { sourcePack: id, created };
    },
  );
};
