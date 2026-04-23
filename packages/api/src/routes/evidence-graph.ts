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

export interface EvidenceGraphRoutesOptions {
  evidenceStore: IEvidenceStore;
  knowledgeMap: KnowledgeMap;
  listEdgesForAnchors?: (anchors: string[]) => GraphEdge[];
}

const graphQuerySchema = z.object({ module: z.string().min(1) });

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
  const { evidenceStore, knowledgeMap, listEdgesForAnchors } = opts;

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
    const resolvedAnchors = nodes.map((n) => n.anchor);
    const edges = listEdgesForAnchors ? listEdgesForAnchors(resolvedAnchors) : [];

    return { module: moduleId, moduleName: mod.name, nodes, edges };
  });
};
