import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IEvidenceStore } from '../domains/memory/interfaces.js';
import type { KnowledgeMap } from '../domains/memory/knowledge-map.js';

interface GraphNode {
  anchor: string;
  title: string;
  kind: string;
  authority?: string;
  status: string;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

type DbLike = { prepare: (sql: string) => { all: (...args: string[]) => Array<Record<string, string>> } };

export interface EvidenceGraphRoutesOptions {
  evidenceStore: IEvidenceStore;
  knowledgeMap: KnowledgeMap;
}

const graphQuerySchema = z.object({ module: z.string().min(1) });

const EDGE_QUERY = `SELECT to_anchor AS other_anchor, relation FROM edges WHERE from_anchor = ?
  UNION
  SELECT from_anchor AS other_anchor, relation FROM edges WHERE to_anchor = ?`;

function collectEdges(db: DbLike, anchors: string[], anchorSet: Set<string>): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    for (const row of db.prepare(EDGE_QUERY).all(anchor, anchor)) {
      const other = row.other_anchor;
      if (!other || !anchorSet.has(other)) continue;
      const key = `${[anchor, other].sort().join('::')}::${row.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: anchor, to: other, relation: row.relation });
    }
  }
  return edges;
}

async function resolveNodes(store: IEvidenceStore, anchors: string[]): Promise<GraphNode[]> {
  const nodes: GraphNode[] = [];
  for (const anchor of anchors) {
    const doc = await store.getByAnchor(anchor);
    if (doc) {
      nodes.push({
        anchor: doc.anchor,
        title: doc.title,
        kind: doc.kind,
        authority: doc.authority,
        status: doc.status,
      });
    }
  }
  return nodes;
}

export const evidenceGraphRoutes: FastifyPluginAsync<EvidenceGraphRoutesOptions> = async (app, opts) => {
  const { evidenceStore, knowledgeMap } = opts;

  app.get('/api/evidence/explore', async () => {
    const modules = await Promise.all(
      Object.entries(knowledgeMap.modules).map(async ([id, mod]) => {
        let evidenceCount = 0;
        for (const anchor of mod.anchors) {
          const doc = await evidenceStore.getByAnchor(anchor);
          if (doc) evidenceCount++;
        }
        return { id, name: mod.name, anchorCount: mod.anchors.length, evidenceCount };
      }),
    );
    return { modules };
  });

  app.get('/api/evidence/graph', async (request, reply) => {
    const parsed = graphQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'module parameter required' };
    }
    const { module: moduleId } = parsed.data;
    const mod = knowledgeMap.modules[moduleId];
    if (!mod) {
      reply.status(404);
      return { error: `module "${moduleId}" not found` };
    }

    const nodes = await resolveNodes(evidenceStore, mod.anchors);
    const anchorSet = new Set(mod.anchors);
    const db = (evidenceStore as unknown as { getDb?: () => DbLike }).getDb?.();
    const edges = db ? collectEdges(db, mod.anchors, anchorSet) : [];

    return { module: moduleId, moduleName: mod.name, nodes, edges };
  });
};
