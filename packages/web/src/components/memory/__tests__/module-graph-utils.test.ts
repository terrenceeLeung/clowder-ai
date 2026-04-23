import { describe, expect, it } from 'vitest';
import { buildExploreApiUrl, buildGraphApiUrl, buildModuleFlowGraph } from '../module-graph-utils';

describe('buildGraphApiUrl', () => {
  it('builds URL with module param', () => {
    expect(buildGraphApiUrl('memory')).toBe('/api/evidence/graph?module=memory');
  });

  it('encodes module param', () => {
    expect(buildGraphApiUrl('a b')).toBe('/api/evidence/graph?module=a%20b');
  });
});

describe('buildExploreApiUrl', () => {
  it('returns explore endpoint', () => {
    expect(buildExploreApiUrl()).toBe('/api/evidence/explore');
  });
});

describe('buildModuleFlowGraph', () => {
  it('converts GraphResponse to ReactFlow nodes and edges', () => {
    const response = {
      module: 'memory',
      moduleName: '记忆系统',
      nodes: [
        { anchor: 'F102.md', title: 'Memory Adapter', kind: 'feature', status: 'active', authority: 'validated' },
        { anchor: 'F163.md', title: 'Entropy Reduction', kind: 'feature', status: 'active' },
      ],
      edges: [{ from: 'F102.md', to: 'F163.md', relation: 'related' }],
    };
    const result = buildModuleFlowGraph(response);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].data.title).toBe('Memory Adapter');
    expect(result.edges[0].source).toBe('F102.md');
    expect(result.edges[0].target).toBe('F163.md');
  });

  it('handles empty graph', () => {
    const result = buildModuleFlowGraph({
      module: 'empty',
      moduleName: 'Empty',
      nodes: [],
      edges: [],
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('applies dagre layout positions', () => {
    const result = buildModuleFlowGraph({
      module: 'test',
      moduleName: 'Test',
      nodes: [
        { anchor: 'a', title: 'A', kind: 'feature', status: 'active' },
        { anchor: 'b', title: 'B', kind: 'feature', status: 'active' },
      ],
      edges: [{ from: 'a', to: 'b', relation: 'evolved_from' }],
    });
    expect(result.nodes[0].position.x).toBeDefined();
    expect(result.nodes[0].position.y).toBeDefined();
    expect(result.nodes[0].position.y).not.toBe(result.nodes[1].position.y);
  });
});
