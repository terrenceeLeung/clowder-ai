---
feature_ids: [F179]
topics: [knowledge-governance, retrieval, evidence-store, embedding]
doc_kind: implementation-plan
created: 2026-05-07
authority: candidate
---

# F179 Phase 2.5 Implementation Plan — Retrieval Quality Hardening

**Feature:** F179 — `docs/features/F179-domain-knowledge-governance.md`
**Branch:** `feat/f179-phase2.5`
**Worktree:** `/Users/tianyiliang/projects/cat-cafe-f179-phase2.5`
**Acceptance Criteria:** AC-2.5.1 ~ AC-2.5.5 (spec lines 278–282)

## Goal

修复 Phase 2 暴露的检索质量缺陷，让 `mode=semantic/hybrid` 在 doc-level 和 passage-level 都能命中 pack-knowledge，并建立可回归的质量基线。

## Root-cause delta (Phase 2 完成后再核查)

| 表 | pack-knowledge 实际写入？ | 期望 | 缺口 |
|----|---------------------------|------|------|
| `evidence_docs` | ✅ | ✅ | — |
| `evidence_fts` | ✅ (trigger) | ✅ | — |
| `evidence_passages` | ✅ | ✅ | — |
| `passage_fts` | ✅ (trigger) | ✅ | — |
| `passage_vectors` | ❌ (KnowledgeImporter 有代码但 `embedder` 在 `index.ts:1815` 未注入) | ✅ | embedder 未 wire |
| `evidence_vectors` | ❌ (KnowledgeImporter 不写 doc-level 向量；IndexBuilder.rebuild 跳过 pack-knowledge) | ✅ | 写入路径缺失 |

讨论文档原假设 `passage_vectors` 已有数据——错。实际两张向量表都缺。

## Sequencing rationale

按"数据 → 过滤 → 路由 → 验证"顺序，避免在不完整数据上调路由：

1. **AC-2.5.2** 数据层面修复（写入 evidence_vectors + passage_vectors）
2. **AC-2.5.3** passage 检索的 packId 过滤（与 doc-level 对称）
3. **AC-2.5.1** depth=raw 路由到 searchPassagesHybrid
4. **AC-2.5.4** Recall/Precision baseline（CI 回归）
5. **AC-2.5.5** FTS 质量对照（summary vs 300 字截断）

## AC-by-AC plan

### AC-2.5.2 — KnowledgeImporter 写 evidence_vectors + passage_vectors

**改动点：**
- `packages/api/src/domains/knowledge/KnowledgeImporter.ts`
  - `ImporterDeps` 增加 `vectorStore?: VectorStore` 和 `docEmbedder?: { embed(texts: string[]): Promise<Float32Array[]> }`
  - `importFile` 在写完 `passage_vectors` 后追加：用 `${title}\n\n${summary}` embed → `vectorStore.upsert(anchor, vec)`
  - 失败 fail-open（与 passage_vectors 一致），不阻塞 import
  - 更新路径：existing 被标 stale 时同步删除旧 evidence_vectors/passage_vectors（防止 stale 命中）
- `packages/api/src/index.ts:1815`
  - 把 `memoryServices` 的 `embeddingService` + `vectorStore` 注入 KnowledgeImporter
  - embedder 接口与 IndexBuilder 一致

**测试：**
- `packages/api/test/knowledge/import-vector-write.test.js`（新）
  - 用真 embed mock + `:memory:` SQLite，import → 断言 `evidence_vectors` 和 `passage_vectors` 都有 pack-knowledge 行
  - 重复 import 同源（hash 不变）→ vectors 仍存在；hash 变 → 旧 vectors 被清理（stale 转换 + 重建）
  - embedder 缺失 → import 不失败（fail-open）

### AC-2.5.3 — searchPassages / searchPassagesHybrid 加 packId 过滤

**改动点：**
- `SqliteEvidenceStore.searchPassages` (line 937)
  - signature 增加 `options.packId?: string`
  - SQL 增加 `AND d.pack_id = ?`（仅当 packId 提供）；`governance_status` 已经有
  - 与 doc-level pack 行为对称：packId 提供时只看该 pack；不提供时排除 pack-knowledge（除非主路径在做 packId 检索）
- `SqliteEvidenceStore.searchPassagesHybrid` (line 1056)
  - signature 增加 `options.packId`，向 `searchPassages` 透传
  - vec0 nn 查询 join `evidence_docs` 做 packId/governance 过滤（hybrid 的向量分支不能漏）

**测试：**
- 扩展 `pack-scoped-semantic.test.js` 或新测：
  - `searchPassages('foo', { packId: 'packA' })` 不返回 packB 的 passage
  - `searchPassagesHybrid('foo', { packId: 'packA' })` 在 BM25 / 向量两路都过滤

### AC-2.5.1 — depth=raw 路由到 searchPassagesHybrid

**改动点：**
- `SqliteEvidenceStore.search` (line 316–381)
  - line 316 现在写死 `searchPassages`
  - 改为：raw + lexical → `searchPassages`；raw + semantic/hybrid（且 embedding 可用）→ `searchPassagesHybrid`
  - 保留 line 372 short-circuit 的"raw 不走 doc-level mode 分支"语义——它防的是 doc 向量混入 passage 结果，不阻止 passage 向量
  - 透传 `options.packId` 到 passage 搜索

**测试：**
- `passage-hybrid-routing.test.js`（新）
  - mock embedding，`depth=raw + mode=semantic + packA`，向量命中的 passage（BM25 不命中）能返回
  - `mode=lexical + depth=raw` 仍走纯 BM25（不调用 embedding）
  - embedding 不可用时 `mode=hybrid` 降级到 lexical（已有的行为）

### AC-2.5.4 — Fixture query set + Recall@5 / Precision@5 baseline

**改动点：**
- `packages/api/test/fixtures/retrieval-quality/`（新）
  - `corpus.md`：5–8 个 pack-knowledge 文档，覆盖：长文档（确保 chunk 跨 BM25/vector 边界）、短摘要、跨 heading、关键词在末尾等场景
  - `queries.json`：固定 query set，每条标注 expected_anchors
- `packages/api/test/memory/retrieval-quality-baseline.test.js`（新）
  - 用 `:memory:` SQLite + `MockEmbedding`（确定性 hash → vector，避免外部模型依赖）
  - 对 lexical / semantic / hybrid 三种 mode、含/不含 packId 跑同 query set
  - 计算 Recall@5 / Precision@5，在测试里写死 baseline 阈值
  - 阈值偏低保护：CI 跑得过 + 后续做 FTS 改进时 Recall 不应下降（回归门）

**baseline 选择：** 不写绝对数（不同 embedding 不同），用相对断言：
- `Recall(hybrid) >= max(Recall(lexical), Recall(semantic))`（hybrid 不应比单路差）
- `Recall(hybrid, packA-only) >= Recall(hybrid, no-pack)` 在 packA 子集上（隔离不应损失召回）

### AC-2.5.5 — FTS 质量验证：Normalizer summary vs 300 字截断

**改动点：**
- `packages/api/test/memory/fts-summary-vs-truncation.test.js`（新）
  - 同一原文，两条索引路径：(a) Normalizer 结构化 summary（Phase 1 现有产物） (b) 朴素前 300 字截断
  - 同一 query set（来自 AC-2.5.4 fixture）
  - 断言：(a) 路径在 Recall@5 上 ≥ (b) 路径——量化 Normalizer 的 BM25 价值
  - 纯 FTS5，不用 embedding（轻量、CI 友好）

## Verification (smoke test)

quality-gate Step 3.5 隔离端口 3013/3014：
- `API_SERVER_PORT=3014 FRONTEND_PORT=3013 PREVIEW_GATEWAY_PORT=4014 pnpm dev`
- 用 dev pack 真实导入一篇 markdown
- `curl -G 'localhost:3014/v1/evidence/search' --data-urlencode 'q=...' --data-urlencode 'depth=raw' --data-urlencode 'mode=hybrid' --data-urlencode 'packId=...'`
- 断言返回有 hits 且 passages 字段含 chunk-level 数据

## Out of scope

- 完整 eval 框架（单独 feature）
- A/B testing infra
- UI 改动（governance/retrieval 面板）
- Phase 3 的版本管理 / Federated / Mirror

## Risks + rollback

| 风险 | 缓解 |
|------|------|
| 注入 embedder 后 import 变慢 | embedding fail-open；`embedDeps.mode === 'on'` 才生效；shadow 模式不阻塞 |
| evidence_vectors 写入与 IndexBuilder.rebuild 互踩 | rebuild 已保护（跳过 pack-knowledge），KnowledgeImporter 写自己的；写完不依赖 rebuild |
| Recall/Precision 在 mock embedding 下不稳 | 用相对断言，不锁绝对值 |
| short-circuit 改动破坏现有测试 | 保留 short-circuit 语义（doc 向量隔离），只改 passage 分支 |

## Definition of Done

- [ ] 5 个 ACs 全部 [ ] → [x]
- [ ] 新增测试通过 + 现有 16 个 pack-scoped 测试不回归
- [ ] `pnpm gate` 全绿（biome + tsc + tests）
- [ ] Smoke test 在隔离端口验证 import → search 全链路
- [ ] PR + 缅因猫 review 放行
