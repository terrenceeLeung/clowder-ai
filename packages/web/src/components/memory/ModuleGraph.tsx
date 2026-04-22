'use client';

import { Handle, type Node, type NodeProps, Position, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildGraphApiUrl,
  buildModuleFlowGraph,
  type EvidenceNodeData,
  type GraphResponse,
} from './module-graph-utils';

const AUTHORITY_COLORS: Record<string, { border: string; bg: string }> = {
  constitutional: { border: '#7CB87C', bg: '#F5FFF5' },
  validated: { border: '#5B9BD5', bg: '#F5F9FF' },
  provisional: { border: '#E4A853', bg: '#FFFBF0' },
  inferred: { border: '#C4B5A0', bg: '#FFFDF8' },
};

function EvidenceNode({ data }: NodeProps<Node<EvidenceNodeData>>) {
  const colors = AUTHORITY_COLORS[data.authority ?? 'inferred'] ?? AUTHORITY_COLORS.inferred;
  return (
    <div
      className="rounded-xl border-2 px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: colors.border, backgroundColor: colors.bg, width: 180, minHeight: 50 }}
      data-testid={`graph-node-${data.anchor}`}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <p className="line-clamp-2 text-xs font-medium text-[#5A4A38]">{data.title}</p>
      <span className="mt-0.5 inline-block rounded bg-[#F5EDE0] px-1 py-0.5 text-[10px] text-[#9A866F]">
        {data.kind}
      </span>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { evidence: EvidenceNode };

interface ModuleGraphProps {
  readonly moduleId: string;
}

export function ModuleGraph({ moduleId }: ModuleGraphProps) {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(buildGraphApiUrl(moduleId))
      .then((res) => res.json())
      .then((data: GraphResponse) => setGraphData(data))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [moduleId]);

  const layouted = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };
    return buildModuleFlowGraph(graphData);
  }, [graphData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted, setNodes, setEdges]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-[#9A866F]" data-testid="module-graph-loading">
        加载模块图谱...
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        data-testid="module-graph-error"
      >
        {error}
      </div>
    );
  }
  if (nodes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#9A866F]" data-testid="module-graph-empty">
        该模块暂无 evidence 数据
      </div>
    );
  }

  return (
    <div data-testid="module-graph">
      <h3 className="mb-2 text-sm font-bold text-[#8B6F47]">{graphData?.moduleName}</h3>
      <div className="h-[400px] w-full rounded-xl border border-[#E7DAC7] bg-[#FFFDF8]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>

      {graphData && graphData.nodes.length > 0 && (
        <div className="mt-3 rounded-xl border border-[#E7DAC7] bg-[#FFFDF8] p-3">
          <h4 className="mb-2 text-xs font-semibold text-[#8B6F47]">Evidence 列表</h4>
          <ul className="space-y-1">
            {graphData.nodes.map((n) => (
              <li key={n.anchor} className="flex items-center gap-2 text-xs text-[#5A4A38]">
                <span className="rounded bg-[#F5EDE0] px-1.5 py-0.5 text-[10px] text-[#9A866F]">{n.kind}</span>
                <span className="font-medium">{n.title}</span>
                {n.authority && <span className="rounded bg-[#E7DAC7] px-1 py-0.5 text-[10px]">{n.authority}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
