# F169 Phase A-1: Knowledge Graph Implementation Plan

**Feature:** F169 — `docs/features/F169-feynman-cat.md`
**Goal:** Knowledge graph visualization — knowledge-map.yaml + Graph API + MemoryHub Explore tab
**Acceptance Criteria:**
- AC-A1-1: `docs/knowledge-map.yaml` 创建，8 个核心模块（记忆、协作、游戏、消息、引导、外部连接、基础设施、身份治理），每个模块定义 name + anchors
- AC-A1-2: `GET /api/evidence/graph?module=X` 返回模块的 feature 节点 + edges + evidence 列表（含 authority）
- AC-A1-3: MemoryHub 新增 Explore tab，展示模块卡片（名称 + anchor 数 + evidence 数）
- AC-A1-4: 点击模块卡片展示 feature 级图（@xyflow/react + dagre）+ evidence 列表
**Architecture:** knowledge-map.yaml 定义模块→anchor 映射；Graph API 读 YAML + 查 evidence_docs + edges 返回子图；前端 Explore tab 用模块卡片 + @xyflow/react 图渲染。复用 DependencyGraphTab 的 dagre 布局模式。
**Tech Stack:** YAML (js-yaml), Fastify, SQLite (better-sqlite3), @xyflow/react, @dagrejs/dagre, vitest
**前端验证:** Yes — Explore tab 必须用浏览器实测模块卡片 + 图渲染 + evidence 列表

---

## Terminal Schema

```typescript
// knowledge-map.yaml parsed type
interface KnowledgeModule {
  name: string;
  anchors: string[];
}
interface KnowledgeMap {
  version: 1;
  modules: Record<string, KnowledgeModule>;
}

// Graph API response
interface GraphNode {
  anchor: string;
  title: string;
  kind: EvidenceKind;
  authority?: F163Authority;
  status: EvidenceStatus;
}
interface GraphEdge {
  from: string;
  to: string;
  relation: Edge['relation'];
}
interface GraphResponse {
  module: string;
  moduleName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Explore overview response
interface ModuleOverview {
  id: string;
  name: string;
  anchorCount: number;
  evidenceCount: number;
}
interface ExploreOverviewResponse {
  modules: ModuleOverview[];
}
```

---

### Task 1: knowledge-map.yaml (AC-A1-1)

**Files:**
- Create: `docs/knowledge-map.yaml`

**Step 1: Create knowledge-map.yaml with 8 core modules**

```yaml
version: 1
modules:
  memory:
    name: 记忆与知识工程
    anchors:
      - docs/features/F102-memory-adapter-refactor.md
      - docs/features/F163-memory-entropy-reduction.md
      - docs/features/F152-expedition-memory.md
      - docs/features/F100-self-evolution.md
      - docs/features/F169-feynman-cat.md
      - docs/decisions/020-f102-memory-system-architecture.md
      - docs/decisions/015-knowledge-object-contract.md
  collaboration:
    name: 多猫协作
    anchors:
      - docs/features/F002-agent-to-agent.md
      - docs/features/F027-a2a-path-unification.md
      - docs/features/F055-a2a-mcp-structured-routing.md
      - docs/features/F167-a2a-chain-quality.md
      - docs/features/F037-agent-swarm.md
      - docs/decisions/001-agent-invocation-approach.md
      - docs/decisions/002-collaboration-protocol.md
  games:
    name: 游戏系统
    anchors:
      - docs/features/F101-mode-v2-game-engine.md
      - docs/features/F090-pixel-cat-brawl.md
      - docs/features/F107-headband-guess-game.md
      - docs/features/F119-who-is-spy-game.md
      - docs/features/F093-cats-and-u-world-engine.md
      - docs/features/F044-channel-activity-system.md
  messaging:
    name: 消息与富交互
    anchors:
      - docs/features/F022-rich-blocks.md
      - docs/features/F109-message-actions-overhaul.md
      - docs/features/F020-voice-input-suite.md
      - docs/features/F034-voice-message.md
      - docs/features/F035-whisper-visibility.md
      - docs/features/F039-message-queue-delivery.md
      - docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md
  guidance:
    name: 引导与教学
    anchors:
      - docs/features/F155-scene-guidance-engine.md
      - docs/features/F110-bootcamp-vision-elicitation.md
      - docs/features/F165-guided-overfitting.md
      - docs/features/F056-cat-cafe-design-language.md
  integration:
    name: 外部连接与生态
    anchors:
      - docs/features/F146-mcp-marketplace-control-plane.md
      - docs/features/F151-xiaoyi-channel-gateway.md
      - docs/features/F126-limb-control-plane.md
      - docs/features/F021-signal-study-mode.md
      - docs/features/F054-hci-preheat-infra.md
      - docs/features/F129-pack-system-multi-agent-mod.md
      - docs/decisions/014-xiaoyi-connector-gateway.md
  infrastructure:
    name: 基础设施
    anchors:
      - docs/features/F048-restart-recovery.md
      - docs/features/F113-multi-platform-one-click-deploy.md
      - docs/features/F143-hostable-agent-runtime.md
      - docs/features/F149-acp-runtime-operations.md
      - docs/features/F153-observability-infra.md
      - docs/features/F156-websocket-security-hardening.md
      - docs/features/F025-reliability-engineering.md
      - docs/decisions/022-unified-schedule-abstraction.md
  identity:
    name: 猫猫身份与治理
    anchors:
      - docs/features/F127-cat-instance-management.md
      - docs/features/F038-skills-discovery.md
      - docs/features/F077-multi-user-secure-collab.md
      - docs/features/F067-cold-start-verifier.md
      - docs/features/F168-community-ops-board.md
      - docs/decisions/009-cat-cafe-skills-distribution.md
```

**Step 2: Commit**

```bash
git add docs/knowledge-map.yaml
git commit -m "feat(F169): add knowledge-map.yaml with 4 modules"
```

---

### Task 2: knowledge-map parser + Graph API types (AC-A1-2, part 1)

**Files:**
- Create: `packages/api/src/domains/memory/knowledge-map.ts`
- Test: `packages/api/test/memory/knowledge-map.test.js`

**Step 1: Write the failing test**

```javascript
// packages/api/test/memory/knowledge-map.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseKnowledgeMap, loadKnowledgeMap } from '../dist/domains/memory/knowledge-map.js';

describe('parseKnowledgeMap', () => {
  it('parses valid YAML into KnowledgeMap', () => {
    const yaml = `
version: 1
modules:
  memory:
    name: 记忆系统
    anchors:
      - docs/features/F102.md
      - docs/features/F163.md
`;
    const result = parseKnowledgeMap(yaml);
    assert.equal(result.version, 1);
    assert.deepEqual(Object.keys(result.modules), ['memory']);
    assert.equal(result.modules.memory.name, '记忆系统');
    assert.deepEqual(result.modules.memory.anchors, [
      'docs/features/F102.md',
      'docs/features/F163.md',
    ]);
  });

  it('throws on missing version', () => {
    assert.throws(() => parseKnowledgeMap('modules: {}'), /version/i);
  });

  it('throws on empty modules', () => {
    assert.throws(() => parseKnowledgeMap('version: 1\nmodules: {}'), /module/i);
  });

  it('throws on module without anchors', () => {
    const yaml = 'version: 1\nmodules:\n  m:\n    name: X\n    anchors: []';
    assert.throws(() => parseKnowledgeMap(yaml), /anchor/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/memory/knowledge-map.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/api/src/domains/memory/knowledge-map.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

export interface KnowledgeModule {
  name: string;
  anchors: string[];
}

export interface KnowledgeMap {
  version: 1;
  modules: Record<string, KnowledgeModule>;
}

export function parseKnowledgeMap(raw: string): KnowledgeMap {
  const doc = yaml.load(raw) as Record<string, unknown>;
  if (!doc || doc.version !== 1) throw new Error('knowledge-map: version must be 1');
  const modules = doc.modules as Record<string, unknown> | undefined;
  if (!modules || Object.keys(modules).length === 0) {
    throw new Error('knowledge-map: must have at least one module');
  }
  const parsed: Record<string, KnowledgeModule> = {};
  for (const [id, val] of Object.entries(modules)) {
    const m = val as { name?: string; anchors?: string[] };
    if (!m.name) throw new Error(`knowledge-map: module "${id}" missing name`);
    if (!Array.isArray(m.anchors) || m.anchors.length === 0) {
      throw new Error(`knowledge-map: module "${id}" must have at least one anchor`);
    }
    parsed[id] = { name: m.name, anchors: m.anchors };
  }
  return { version: 1, modules: parsed };
}

export function loadKnowledgeMap(projectRoot: string): KnowledgeMap {
  const filePath = resolve(projectRoot, 'docs/knowledge-map.yaml');
  const raw = readFileSync(filePath, 'utf-8');
  return parseKnowledgeMap(raw);
}
```

**Step 4: Build and run test to verify it passes**

Run: `pnpm build && cd packages/api && node --test test/memory/knowledge-map.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/knowledge-map.ts packages/api/test/memory/knowledge-map.test.js
git commit -m "feat(F169): knowledge-map parser with validation"
```

---

### Task 3: Graph API endpoint (AC-A1-2, part 2)

**Files:**
- Create: `packages/api/src/routes/evidence-graph.ts`
- Test: `packages/api/test/evidence-graph-route.test.js`

**Step 1: Write the failing test**

```javascript
// packages/api/test/evidence-graph-route.test.js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { evidenceGraphRoutes } from '../dist/routes/evidence-graph.js';

function createMockStore(overrides = {}) {
  return {
    search: async () => [],
    health: async () => true,
    initialize: async () => {},
    upsert: async () => {},
    deleteByAnchor: async () => {},
    getByAnchor: async () => null,
    ...overrides,
  };
}

const MOCK_MAP = {
  version: 1,
  modules: {
    memory: {
      name: '记忆系统',
      anchors: ['docs/features/F102.md', 'docs/features/F163.md'],
    },
  },
};

describe('GET /api/evidence/graph', () => {
  async function setup(storeOverrides = {}, knowledgeMap = MOCK_MAP) {
    const app = Fastify();
    const evidenceStore = createMockStore(storeOverrides);
    await app.register(evidenceGraphRoutes, { evidenceStore, knowledgeMap });
    await app.ready();
    return app;
  }

  it('returns module graph with nodes and edges', async () => {
    const app = await setup({
      getByAnchor: async (anchor) => ({
        anchor,
        kind: 'feature',
        status: 'active',
        title: anchor.includes('F102') ? 'Memory Adapter' : 'Entropy Reduction',
        authority: 'validated',
        updatedAt: '2026-04-22',
      }),
      getDb: () => ({
        prepare: () => ({
          all: () => [{ to_anchor: 'docs/features/F163.md', relation: 'related' }],
        }),
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=memory',
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.module, 'memory');
    assert.equal(body.moduleName, '记忆系统');
    assert.ok(body.nodes.length >= 1);
  });

  it('returns 400 for missing module param', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/evidence/graph' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 for unknown module', async () => {
    const app = await setup();
    const res = await app.inject({
      method: 'GET',
      url: '/api/evidence/graph?module=nonexistent',
    });
    assert.equal(res.statusCode, 404);
  });
});

describe('GET /api/evidence/explore', () => {
  it('returns module overview list', async () => {
    const app = Fastify();
    const evidenceStore = createMockStore({
      getByAnchor: async () => ({
        anchor: 'x',
        kind: 'feature',
        status: 'active',
        title: 'X',
        updatedAt: '2026-01-01',
      }),
    });
    await app.register(evidenceGraphRoutes, {
      evidenceStore,
      knowledgeMap: MOCK_MAP,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/evidence/explore' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.modules.length, 1);
    assert.equal(body.modules[0].id, 'memory');
    assert.equal(body.modules[0].name, '记忆系统');
    assert.equal(body.modules[0].anchorCount, 2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/evidence-graph-route.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/api/src/routes/evidence-graph.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { KnowledgeMap } from '../domains/memory/knowledge-map.js';
import type { IEvidenceStore } from '../domains/memory/interfaces.js';

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
}

const graphQuerySchema = z.object({ module: z.string().min(1) });

export const evidenceGraphRoutes: FastifyPluginAsync<EvidenceGraphRoutesOptions> = async (app, opts) => {
  const { evidenceStore, knowledgeMap } = opts;

  // GET /api/evidence/explore — overview of all modules
  app.get('/api/evidence/explore', async () => {
    const modules = await Promise.all(
      Object.entries(knowledgeMap.modules).map(async ([id, mod]) => {
        let evidenceCount = 0;
        for (const anchor of mod.anchors) {
          const doc = await evidenceStore.getByAnchor(anchor);
          if (doc) evidenceCount++;
        }
        return {
          id,
          name: mod.name,
          anchorCount: mod.anchors.length,
          evidenceCount,
        };
      }),
    );
    return { modules };
  });

  // GET /api/evidence/graph?module=X — module subgraph
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

    const nodes: GraphNode[] = [];
    for (const anchor of mod.anchors) {
      const doc = await evidenceStore.getByAnchor(anchor);
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

    const edges: GraphEdge[] = [];
    const anchorSet = new Set(mod.anchors);
    const db = (evidenceStore as { getDb?: () => unknown }).getDb?.() as
      | { prepare: (sql: string) => { all: (...args: unknown[]) => Array<Record<string, unknown>> } }
      | undefined;

    if (db) {
      for (const anchor of mod.anchors) {
        const rows = db
          .prepare(
            `SELECT to_anchor, relation FROM edges WHERE from_anchor = ?
             UNION
             SELECT from_anchor, relation FROM edges WHERE to_anchor = ?`,
          )
          .all(anchor, anchor) as Array<{ to_anchor?: string; from_anchor?: string; relation: string }>;
        for (const row of rows) {
          const other = row.to_anchor ?? row.from_anchor ?? '';
          if (anchorSet.has(other)) {
            const edgeKey = [anchor, other].sort().join('::') + '::' + row.relation;
            if (!edges.some((e) => [e.from, e.to].sort().join('::') + '::' + e.relation === edgeKey)) {
              edges.push({ from: anchor, to: other, relation: row.relation });
            }
          }
        }
      }
    }

    return { module: moduleId, moduleName: mod.name, nodes, edges };
  });
};
```

**Step 4: Register routes in server bootstrap**

Modify: `packages/api/src/server.ts` — add `evidenceGraphRoutes` registration next to existing `evidenceRoutes`, passing `knowledgeMap` loaded via `loadKnowledgeMap(projectRoot)`.

**Step 5: Build and run test to verify it passes**

Run: `pnpm build && cd packages/api && node --test test/evidence-graph-route.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/api/src/routes/evidence-graph.ts packages/api/test/evidence-graph-route.test.js
git commit -m "feat(F169): Graph API — explore overview + module subgraph endpoints"
```

---

### Task 4: MemoryNav + MemoryHub — add Explore tab (AC-A1-3, part 1)

**Files:**
- Modify: `packages/web/src/components/memory/MemoryNav.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx`
- Create: `packages/web/src/app/memory/explore/page.tsx`
- Test: `packages/web/src/components/memory/__tests__/MemoryNav.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/web/src/components/memory/__tests__/MemoryNav.test.ts
import { describe, expect, it } from 'vitest';
import { buildMemoryTabItems } from '../MemoryNav';

describe('buildMemoryTabItems', () => {
  it('includes explore tab', () => {
    const items = buildMemoryTabItems('');
    const explore = items.find((i) => i.id === 'explore');
    expect(explore).toBeDefined();
    expect(explore!.href).toBe('/memory/explore');
    expect(explore!.label).toBe('Explore');
  });

  it('preserves from suffix on explore tab', () => {
    const items = buildMemoryTabItems('?from=abc');
    const explore = items.find((i) => i.id === 'explore');
    expect(explore!.href).toBe('/memory/explore?from=abc');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/MemoryNav.test.ts`
Expected: FAIL — 'explore' tab not found

**Step 3: Write minimal implementation**

Modify `packages/web/src/components/memory/MemoryNav.tsx`:
- Add `'explore'` to `MemoryTab` union type
- Add explore entry to `buildMemoryTabItems`

```typescript
export type MemoryTab = 'feed' | 'search' | 'status' | 'health' | 'explore';

export function buildMemoryTabItems(fromSuffix: string): readonly TabConfig[] {
  return [
    { id: 'feed', href: `/memory${fromSuffix}`, label: 'Knowledge Feed' },
    { id: 'explore', href: `/memory/explore${fromSuffix}`, label: 'Explore' },
    { id: 'search', href: `/memory/search${fromSuffix}`, label: 'Search' },
    { id: 'status', href: `/memory/status${fromSuffix}`, label: 'Index Status' },
    { id: 'health', href: `/memory/health${fromSuffix}`, label: 'Health' },
  ];
}
```

Modify `packages/web/src/components/memory/MemoryHub.tsx`:
- Import `KnowledgeExplore` (lazy)
- Add explore tab rendering

Create `packages/web/src/app/memory/explore/page.tsx`:

```typescript
import { MemoryHub } from '@/components/memory/MemoryHub';

export default function ExploreMemoryPage() {
  return <MemoryHub activeTab="explore" />;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/MemoryNav.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/memory/MemoryNav.tsx \
       packages/web/src/components/memory/MemoryHub.tsx \
       packages/web/src/app/memory/explore/page.tsx
git commit -m "feat(F169): add Explore tab to MemoryNav + MemoryHub + page route"
```

---

### Task 5: KnowledgeExplore — module card overview (AC-A1-3, part 2)

**Files:**
- Create: `packages/web/src/components/memory/KnowledgeExplore.tsx`
- Test: `packages/web/src/components/memory/__tests__/KnowledgeExplore.test.ts`

**Step 1: Write the failing test for data-fetching hook helper**

```typescript
// packages/web/src/components/memory/__tests__/KnowledgeExplore.test.ts
import { describe, expect, it } from 'vitest';
import { buildExploreApiUrl } from '../KnowledgeExplore';

describe('buildExploreApiUrl', () => {
  it('returns /api/evidence/explore', () => {
    expect(buildExploreApiUrl()).toBe('/api/evidence/explore');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/KnowledgeExplore.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/web/src/components/memory/KnowledgeExplore.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface ModuleOverview {
  id: string;
  name: string;
  anchorCount: number;
  evidenceCount: number;
}

export function buildExploreApiUrl(): string {
  return '/api/evidence/explore';
}

interface KnowledgeExploreProps {
  readonly onModuleSelect?: (moduleId: string) => void;
}

export function KnowledgeExplore({ onModuleSelect }: KnowledgeExploreProps) {
  const [modules, setModules] = useState<ModuleOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  useEffect(() => {
    fetch(buildExploreApiUrl())
      .then((res) => res.json())
      .then((data) => setModules(data.modules ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback(
    (moduleId: string) => {
      setSelectedModule((prev) => (prev === moduleId ? null : moduleId));
      onModuleSelect?.(moduleId);
    },
    [onModuleSelect],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#9A866F]" data-testid="explore-loading">
        加载模块概览...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="explore-error">
        {error}
      </div>
    );
  }

  return (
    <div data-testid="knowledge-explore">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => handleSelect(mod.id)}
            className={[
              'rounded-xl border p-4 text-left transition-all hover:shadow-md',
              selectedModule === mod.id
                ? 'border-cocreator-primary bg-cocreator-light shadow-sm'
                : 'border-[#E7DAC7] bg-[#FFFDF8] hover:border-cocreator-light',
            ].join(' ')}
            data-testid={`explore-module-${mod.id}`}
          >
            <h3 className="text-sm font-bold text-[#8B6F47]">{mod.name}</h3>
            <p className="mt-1 text-xs text-[#9A866F]">
              {mod.anchorCount} anchors · {mod.evidenceCount} evidence docs
            </p>
          </button>
        ))}
      </div>

      {selectedModule && <ModuleGraphView moduleId={selectedModule} />}
    </div>
  );
}

function ModuleGraphView({ moduleId }: { moduleId: string }) {
  return (
    <div data-testid={`explore-graph-${moduleId}`}>
      <ModuleGraph moduleId={moduleId} />
    </div>
  );
}
```

Note: `ModuleGraph` is implemented in Task 6.

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/KnowledgeExplore.test.ts`
Expected: PASS

**Step 5: Wire into MemoryHub**

Add to `MemoryHub.tsx`:

```typescript
import { KnowledgeExplore } from './KnowledgeExplore';
// ...
{activeTab === 'explore' && (
  <div data-testid="memory-tab-explore">
    <KnowledgeExplore />
  </div>
)}
```

**Step 6: Commit**

```bash
git add packages/web/src/components/memory/KnowledgeExplore.tsx \
       packages/web/src/components/memory/__tests__/KnowledgeExplore.test.ts \
       packages/web/src/components/memory/MemoryHub.tsx
git commit -m "feat(F169): KnowledgeExplore module card overview component"
```

---

### Task 6: ModuleGraph — feature-level graph with @xyflow/react (AC-A1-4)

**Files:**
- Create: `packages/web/src/components/memory/ModuleGraph.tsx`
- Create: `packages/web/src/components/memory/module-graph-utils.ts`
- Test: `packages/web/src/components/memory/__tests__/module-graph-utils.test.ts`

**Step 1: Write the failing test for graph utils**

```typescript
// packages/web/src/components/memory/__tests__/module-graph-utils.test.ts
import { describe, expect, it } from 'vitest';
import { buildModuleFlowGraph, buildGraphApiUrl } from '../module-graph-utils';

describe('buildGraphApiUrl', () => {
  it('builds URL with module param', () => {
    expect(buildGraphApiUrl('memory')).toBe('/api/evidence/graph?module=memory');
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
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/module-graph-utils.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation — graph utils**

```typescript
// packages/web/src/components/memory/module-graph-utils.ts
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

const NODE_WIDTH = 180;
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
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 });
  for (const n of rfNodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of rfEdges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const layoutedNodes = rfNodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 } };
  });

  return { nodes: layoutedNodes, edges: rfEdges };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm vitest run src/components/memory/__tests__/module-graph-utils.test.ts`
Expected: PASS

**Step 5: Write ModuleGraph component**

```typescript
// packages/web/src/components/memory/ModuleGraph.tsx
'use client';

import { Handle, type Node, type NodeProps, Position, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type EvidenceNodeData, type GraphResponse, buildGraphApiUrl, buildModuleFlowGraph } from './module-graph-utils';

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
  moduleId: string;
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
      .then((data) => setGraphData(data))
      .catch((e) => setError(String(e)))
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
    return <div className="py-8 text-center text-sm text-[#9A866F]">加载模块图谱...</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }
  if (nodes.length === 0) {
    return <div className="py-8 text-center text-sm text-[#9A866F]">该模块暂无 evidence 数据</div>;
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
                {n.authority && (
                  <span className="rounded bg-[#E7DAC7] px-1 py-0.5 text-[10px]">{n.authority}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

**Step 6: Wire ModuleGraph into KnowledgeExplore**

Update `KnowledgeExplore.tsx` — add import:
```typescript
import { ModuleGraph } from './ModuleGraph';
```

Replace the placeholder `ModuleGraphView` with `<ModuleGraph moduleId={selectedModule} />`.

**Step 7: Commit**

```bash
git add packages/web/src/components/memory/ModuleGraph.tsx \
       packages/web/src/components/memory/module-graph-utils.ts \
       packages/web/src/components/memory/__tests__/module-graph-utils.test.ts \
       packages/web/src/components/memory/KnowledgeExplore.tsx
git commit -m "feat(F169): ModuleGraph — feature-level @xyflow/react graph + evidence list"
```

---

### Task 7: Server bootstrap wiring + js-yaml dependency

**Files:**
- Modify: `packages/api/src/server.ts` (or wherever evidenceRoutes is registered)
- Modify: `packages/api/package.json` (add js-yaml if not present)

**Step 1: Check js-yaml dependency**

Run: `grep js-yaml packages/api/package.json`
If missing: `cd packages/api && pnpm add js-yaml && pnpm add -D @types/js-yaml`

**Step 2: Wire routes in server bootstrap**

Find where `evidenceRoutes` is registered and add `evidenceGraphRoutes` next to it:

```typescript
import { loadKnowledgeMap } from './domains/memory/knowledge-map.js';
import { evidenceGraphRoutes } from './routes/evidence-graph.js';

// After evidenceRoutes registration:
const knowledgeMap = loadKnowledgeMap(projectRoot);
await app.register(evidenceGraphRoutes, { evidenceStore, knowledgeMap });
```

**Step 3: Build and run all evidence tests**

Run: `pnpm build && cd packages/api && node --test test/evidence-graph-route.test.js`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/api/src/server.ts packages/api/package.json
git commit -m "feat(F169): wire evidence-graph routes + knowledge-map loader into server"
```

---

### Task 8: Browser validation + type check

**Step 1: Run type check**

Run: `pnpm lint`
Expected: PASS — no type errors

**Step 2: Run Biome check**

Run: `pnpm check`
Expected: PASS — no lint/format errors (fix with `pnpm check:fix` if needed)

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All existing + new tests pass

**Step 4: Start dev server and validate in browser**

Run: `pnpm dev`

Browser validation checklist:
- [ ] Navigate to `/memory/explore` — Explore tab is highlighted, module cards visible
- [ ] Module cards show name, anchor count, evidence count
- [ ] Click module card → @xyflow/react graph renders with correct nodes/edges
- [ ] Evidence list below graph shows title, kind, authority
- [ ] Click different module → graph updates
- [ ] Click same module → deselects
- [ ] Other memory tabs (Feed, Search, Status, Health) still work

**Step 5: Commit any final fixes**

```bash
git commit -m "feat(F169): Phase A-1 complete — knowledge graph visualization"
```
