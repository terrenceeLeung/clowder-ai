---
feature_ids: [F179]
topics: [knowledge-governance, implementation-plan]
doc_kind: plan
created: 2026-05-04
---

# F179 Phase 1.5: Governance Lifecycle — Implementation Plan

**Feature:** F179 — `docs/features/F179-domain-knowledge-governance.md`
**Goal:** 用户能在 Knowledge Hub 中审批/拒绝/下线知识文档，治理状态正确门控检索结果，approved 自动链式到达 active。
**Architecture:** 后端加一个 PATCH governance 端点 + GovernanceStateMachine 增加自动链式转换；前端 DocDetail 加 GovernanceRibbon 组件（暹罗猫设计稿）；修正检索 SQL 只返回 active 文档。
**Tech Stack:** Fastify (backend), Next.js + Zustand + Tailwind (frontend), node:test (tests)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

**Acceptance Criteria:**

| # | 验收项 | 覆盖 Task |
|---|--------|-----------|
| AC-151 | PATCH /api/knowledge/docs/:anchor/governance 端点 | Task 2 |
| AC-152 | DocDetail UI 按状态显示操作按钮 | Task 4 |
| AC-153 | approved → active 自动链式转换 | Task 1 |
| AC-154 | Knowledge search 只返回 active 文档 | Task 3 |
| AC-155 | e2e 测试验证完整治理链 | Task 5 |

---

## Straight-Line Check

**B (finish line):** 用户导入文档后看到 NEEDS REVIEW → 点 Approve → badge 变为 ACTIVE + 文档可被搜到；点 Reject → badge 变为 REJECTED + 文档不可搜到；active 文档可 Retire → 退出检索。

**NOT building:** Restore from rejected、Delete permanently、stale 主动扫描、对话式导入、PDF/DOCX/URL、Browse 概览 Governance Overview 统计条（暹罗猫设计稿中有但非 AC 范围，后续增强）。

**Terminal schema:**

```typescript
// API — 新增端点
PATCH /api/knowledge/docs/:anchor/governance
  Body: { status: 'approved' | 'rejected' | 'retired' }
  Response: { anchor, governanceStatus, previousStatus }

// GovernanceStateMachine — 修改 autoRoute
autoRoute(anchor, confidence): GovernanceStatus
  // 高置信: normalized → approved → active (自动链)
  // 低置信: normalized → needs_review (等用户)

// 检索 SQL — 修改 WHERE 条件
WHERE (d.governance_status IS NULL OR d.governance_status = 'active')

// 前端组件 — 新增
GovernanceRibbon({ status, onAction }) → 按状态渲染丝带 + 按钮
```

---

## Task 依赖图

```
Task 1 (autoRoute 链式) ───┐
Task 2 (API route) ────────┼── Task 5 (e2e)
Task 3 (检索门控) ──────────┘
Task 4 (前端 Ribbon) ──────────── Task 5 (e2e)
```

Task 1-4 可并行。Task 5 依赖全部。

---

## Task 1: GovernanceStateMachine — approved → active 自动链

**覆盖:** AC-153
**文件:**
- Modify: `packages/api/src/domains/knowledge/GovernanceStateMachine.ts:73-77`
- Test: `packages/api/test/governance-state-machine.test.js`

**实现要点:**

修改 `autoRoute` 方法：高置信度 approved 后自动链式 transition 到 active。

```typescript
autoRoute(anchor: string, confidence: number): GovernanceStatus {
  const target: GovernanceStatus = confidence >= this.autoApproveThreshold ? 'approved' : 'needs_review';
  this.transition(anchor, target);
  if (target === 'approved') {
    this.transition(anchor, 'active');
    return 'active';
  }
  return target;
}
```

**测试:**
1. autoRoute confidence=0.9 → 最终状态为 `active`（非 approved）
2. autoRoute confidence=0.5 → 状态为 `needs_review`（不变）
3. 手动 transition approved → active 仍然有效

---

## Task 2: Backend — PATCH governance 端点

**覆盖:** AC-151, AC-153（用户审批路径）
**文件:**
- Modify: `packages/api/src/routes/knowledge.ts` (在 PATCH metadata 之后追加)
- Test: `packages/api/test/knowledge-routes.test.js`

**实现要点:**

在 `knowledgeRoutes` 函数内追加路由：

```typescript
app.patch<{ Params: { anchor: string }; Body: { status: string } }>(
  '/api/knowledge/docs/:anchor/governance',
  async (request, reply) => {
    const { anchor } = request.params;
    const { status: targetStatus } = request.body ?? {};

    if (!targetStatus) {
      return reply.status(400).send({ error: 'status is required' });
    }

    const allowed = ['approved', 'rejected', 'retired'];
    if (!allowed.includes(targetStatus)) {
      return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const currentStatus = governance.getStatus(anchor);
    if (currentStatus === null) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    try {
      governance.transition(anchor, targetStatus);
      let finalStatus = targetStatus;
      // AC-153: approved → active 自动链
      if (targetStatus === 'approved') {
        governance.transition(anchor, 'active');
        finalStatus = 'active';
      }
      return { anchor, governanceStatus: finalStatus, previousStatus: currentStatus };
    } catch (err) {
      return reply.status(409).send({ error: (err as Error).message });
    }
  },
);
```

**依赖:** `governance` 实例需要从 knowledgeRoutes 函数参数传入。检查当前签名：

```typescript
// knowledge.ts 当前签名（简化）
export function knowledgeRoutes(app, { db, projectRoot, normalizerLlm }) { ... }
```

需要在路由内部实例化 GovernanceStateMachine（与 importer 同一实例或新建均可，因为它只读写 DB）：

```typescript
const governance = new GovernanceStateMachine(db);
```

**测试:**
1. PATCH /governance status=approved → needs_review 文档变为 active（链式）
2. PATCH /governance status=rejected → needs_review 文档变为 rejected
3. PATCH /governance status=retired → active 文档变为 retired
4. PATCH /governance status=approved 对 active 文档 → 409（无效转换）
5. PATCH /governance 不存在的 anchor → 404
6. PATCH /governance 缺 status → 400

---

## Task 3: Backend — 检索 governance 门控修正

**覆盖:** AC-154
**文件:**
- Modify: `packages/api/src/routes/knowledge.ts:157`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:911,1053`
- Test: `packages/api/test/knowledge-routes.test.js`

**实现要点:**

三处 SQL 修改（同一模式）：

Before:
```sql
AND d.governance_status NOT IN ('stale','retired','rejected','failed')
```

After:
```sql
AND (d.governance_status IS NULL OR d.governance_status = 'active')
```

`IS NULL` 保留：非知识文档（thread messages）的 governance_status 为 NULL，不能被误过滤。

**测试:**
1. governance_status='active' 文档可被搜到
2. governance_status='needs_review' 文档不可搜到
3. governance_status='approved' 文档不可搜到（瞬态，链式后即 active）
4. governance_status=NULL（普通 thread message）仍可搜到

---

## Task 4: Frontend — GovernanceRibbon 组件

**覆盖:** AC-152
**文件:**
- Create: `packages/web/src/components/knowledge/GovernanceRibbon.tsx`
- Modify: `packages/web/src/components/knowledge/DocDetail.tsx`
- Modify: `packages/web/src/stores/knowledgeStore.ts`

**实现要点:**

### GovernanceRibbon.tsx

按暹罗猫设计稿实现——状态驱动的彩色丝带 + 操作按钮。

```tsx
interface GovernanceRibbonProps {
  status: string;
  onAction: (targetStatus: string) => void;
  loading?: boolean;
}

const RIBBON_CONFIG: Record<string, {
  bg: string; text: string; label: string; icon: string;
  actions: Array<{ status: string; label: string; className: string }>;
}> = {
  needs_review: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Review Required',
    icon: '⚠',
    actions: [
      { status: 'approved', label: 'Approve', className: 'bg-green-700 hover:bg-green-800 text-white' },
      { status: 'rejected', label: 'Reject', className: 'bg-red-700 hover:bg-red-800 text-white' },
    ],
  },
  active: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    label: 'Active Knowledge',
    icon: '✓',
    actions: [
      { status: 'retired', label: 'Retire', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
    ],
  },
  rejected: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-600',
    label: 'Rejected Content',
    icon: '✗',
    actions: [],  // 终态，Phase 1.5 无操作
  },
  retired: {
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-500',
    label: 'Retired',
    icon: '◉',
    actions: [],  // 终态
  },
};
```

### DocDetail.tsx 修改

在文档信息卡片上方插入 GovernanceRibbon：

```tsx
<GovernanceRibbon
  status={doc.governanceStatus}
  onAction={handleGovernanceAction}
  loading={actionLoading}
/>
```

### knowledgeStore.ts 追加

```typescript
updateGovernance: async (anchor: string, status: string) => {
  const res = await apiFetch(`/api/knowledge/docs/${encodeURIComponent(anchor)}/governance`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) {
    await get().fetchDocs();
    return (await res.json()) as { governanceStatus: string };
  }
  return null;
},
```

---

## Task 5: E2E Test — MeowGrid 治理链验证

**覆盖:** AC-155, AC-011 修正
**文件:**
- Modify: `packages/api/test/e2e-meowgrid.test.js`

**实现要点:**

修正 fixture mock LLM 的 extractionConfidence：

分两组测试：
- 高置信文档（confidence=0.9）→ 验证 autoRoute 后直接到达 `active`
- 低置信文档（confidence=0.5）→ 验证停在 `needs_review`

修改现有测试：

```javascript
// 修正：governance 断言不再接受 needs_review 作为"通过"
it('high confidence docs reach active status', () => {
  const db = new Database(dbPath);
  for (const r of highConfidenceResults) {
    const doc = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(r.anchor);
    assert.equal(doc.governance_status, 'active',
      `High confidence doc ${r.anchor} should be active, got ${doc.governance_status}`);
  }
  db.close();
});

// 新增：needs_review 文档不可搜到
it('needs_review docs are NOT returned by search', () => {
  const results = store.searchPassages('MeowGrid', 10);
  const domainChunks = results.filter(r => r.passageKind === 'domain_chunk');
  // 只有 active 文档的 chunks 应该出现
  const db = new Database(dbPath);
  for (const chunk of domainChunks) {
    const doc = db.prepare('SELECT governance_status FROM evidence_docs WHERE anchor = ?').get(chunk.docAnchor);
    assert.equal(doc.governance_status, 'active',
      `Search returned chunk from ${doc.governance_status} doc — should only return active`);
  }
  db.close();
});
```

---

## 实施顺序

```
Step 1: Task 1 (autoRoute 链式) — 后端核心修改，~10 min
Step 2: Task 3 (检索门控) — SQL 修改，~5 min
Step 3: Task 2 (API route) — 新端点，~15 min
Step 4: Task 5 (e2e 测试修正) — 验证后端，~15 min
Step 5: Task 4 (前端 Ribbon) — UI 组件，~20 min
Step 6: 全栈冒烟验证 — dev server 启动实测
```

Task 1-3 是后端修改，互不依赖可并行。Task 5 需要 Task 1-3 完成。Task 4 独立但最终验证需要 Task 2。
