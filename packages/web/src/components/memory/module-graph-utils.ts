import dagre from '@dagrejs/dagre';
import { type Edge, MarkerType, type Node } from '@xyflow/react';

export interface GraphResponseNode {
  anchor: string;
  title: string;
  kind: string;
  status: string;
  authority?: string;
}

export interface GraphResponseEdge {
  from: string;
  to: string;
  relation: string;
}

export interface GraphResponse {
  module: string;
  moduleName: string;
  nodes: GraphResponseNode[];
  edges: GraphResponseEdge[];
}

export interface EvidenceNodeData {
  anchor: string;
  title: string;
  kind: string;
  status: string;
  authority?: string;
  [key: string]: unknown;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 60;

const RELATION_STYLES: Record<string, { stroke: string; dash?: string }> = {
  related: { stroke: '#9A866F', dash: '3 3' },
  evolved_from: { stroke: '#5B9BD5' },
  blocked_by: { stroke: '#E05252', dash: '6 3' },
  supersedes: { stroke: '#7CB87C', dash: '4 2' },
  invalidates: { stroke: '#E05252' },
};

export function buildGraphApiUrl(moduleId: string): string {
  return `/api/evidence/graph?module=${encodeURIComponent(moduleId)}`;
}

export function buildExploreApiUrl(): string {
  return '/api/evidence/explore';
}

export function buildModuleFlowGraph(response: GraphResponse): { nodes: Node<EvidenceNodeData>[]; edges: Edge[] } {
  const rfNodes: Node<EvidenceNodeData>[] = response.nodes.map((n) => ({
    id: n.anchor,
    type: 'evidence',
    position: { x: 0, y: 0 },
    data: {
      anchor: n.anchor,
      title: n.title,
      kind: n.kind,
      status: n.status,
      authority: n.authority,
    },
  }));

  const rfEdges: Edge[] = response.edges.map((e, i) => {
    const style = RELATION_STYLES[e.relation] ?? RELATION_STYLES.related;
    return {
      id: `edge-${i}`,
      source: e.from,
      target: e.to,
      style: { stroke: style.stroke, strokeWidth: 1.5, strokeDasharray: style.dash },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
      label: e.relation.replace(/_/g, ' '),
      labelStyle: { fontSize: 10, fill: style.stroke },
    };
  });

  if (rfNodes.length === 0) return { nodes: [], edges: [] };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 });
  for (const n of rfNodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of rfEdges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const layoutedNodes = rfNodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 } };
  });

  return { nodes: layoutedNodes, edges: rfEdges };
}
