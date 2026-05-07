---
feature_ids: [F179]
related_features: [F102, F152, F163, F169]
topics: [knowledge-retrieval, passage-vectors, evidence-store, federation]
doc_kind: discussion
created: 2026-05-07
---

# F179 Phase 2 后续演进讨论

**Thread**: thread_mopypenleah1jgsy | **日期**: 2026-05-07 | **参与者**: opus, codex, gpt55, sonnet

## 背景

Phase 2 (PR #22) 合入后，CVO 要求结合上游反馈（#569 评论 + #652 issue）讨论 F179 后续演进方向。

上游反馈来源：
- [#569 comment](https://github.com/zts212653/clowder-ai/issues/569#issuecomment-4393974828): 5 个记忆系统深度分析发现
- [#652](https://github.com/zts212653/clowder-ai/issues/652): 8 个线程索引覆盖盲区（已 close，first-pass fix 合入上游）

## 代码分析发现

### 发现 1: passage 向量搜索——能力存在但未接入

`searchPassagesHybrid()` 方法已实现（BM25 + `passage_vectors` vec0 + RRF），但主搜索入口 `search()` 在 `depth=raw` 时有 short-circuit（SqliteEvidenceStore.ts:370-372），强制 lexical-only，跳过 semantic/hybrid 分支。

原因：short-circuit 防止 doc-level 向量分支（`evidence_vectors`）乱入 passage-level 结果。当时没有 passage-level 向量路径，所以拦截是正确的。现在 `searchPassagesHybrid()` 存在，可以替换 `searchPassages()` 调用解除 short-circuit。

### 发现 2: evidence_vectors 不对称（新发现，Phase 2.5 关键输入）

**Pack-knowledge 文档在 `evidence_vectors` 表里没有 doc-level 向量。**

数据写入链路：

| 表 | pack-knowledge 有数据？ | 写入者 | 证据 |
|----|------------------------|--------|------|
| `evidence_docs` | ✅ | KnowledgeImporter → store.upsert() | — |
| `evidence_fts` | ✅ | FTS5 trigger on evidence_docs | — |
| `evidence_passages` | ✅ | KnowledgeImporter 直接 INSERT | — |
| `passage_fts` | ✅ | FTS5 trigger on evidence_passages | — |
| `passage_vectors` | ✅ | KnowledgeImporter embed + INSERT | KnowledgeImporter.ts:150 |
| `evidence_vectors` | ❌ | IndexBuilder.rebuild() — 但跳过 pack-knowledge | IndexBuilder.ts:390 `if (row.kind === 'pack-knowledge') continue` |

根因链：
1. KnowledgeImporter 只写 passage-level embedding，不写 doc-level embedding
2. IndexBuilder.rebuild() 的 embedding 生成只处理 scanner 发现的文档
3. Pack-knowledge 是 API 导入的，不经过 scanner，不进入 `indexedItems`
4. Phase 2 AC-201 让 rebuild 跳过 pack-knowledge 的删除——但跳过删除也意味着跳过了整个处理流程

影响：
- `mode=semantic` 搜知识文档 → **零结果**（evidence_vectors 里无 pack-knowledge 条目）
- `mode=hybrid` → 只有 BM25 命中，向量部分无贡献（降级为纯 lexical）
- Phase 2 给 semantic/hybrid 加的 packId 过滤 → 技术上正确但实际上是**空操作**
- `depth=raw` 的 passage_vectors → 数据在，搜索路径没接上

### 发现 3: searchPassages 缺 packId 过滤

`searchPassages()` 的 SQL 有 governance 过滤（`governance_status IS NULL OR governance_status = 'active'`），但没有 `pack_id` 过滤。`depth=raw` + `packId` 搜索会返回所有 pack 的 passage，和 doc-level 5 路径 packId 过滤不一致。

## 四猫讨论结论

### 全票共识（4/4）

1. **插入 Phase 2.5（Retrieval Quality Gate）** — passage 向量搜索是 F179 自身的未完成闭环，且 Federation 是"放大器"，底层不稳 = 噪声放大
2. **AC-24（知识进化为 Skill）从 F179 砍出** — 独立 feature 级复杂度，归 F163/F169
3. **上游问题归属**：passage 向量搜索 → F179；thread/session → F102/F169；项目隔离 → F152
4. **AC-22 + AC-25 捆绑**：安全边界（禁回流）内嵌为 Federated MVP 验收条件

### Phase 2.5 scope（四猫合并，Sonnet 约束版 + Codex/GPT55 扩展）

核心（必须做）：
- passage hybrid 搜索接入主路径（替换 short-circuit）
- passage 搜索加 packId + governance 过滤
- **doc-level 向量补写**：KnowledgeImporter 导入时同步写 evidence_vectors（修复不对称）
- 检索质量基线 fixture（Recall@5 / Precision@5，分 mode 分 pack）

扩展（按价值排序，scope 允许时做）：
- mode 一致性契约 + degrade 可观测性
- 检索命中来源诊断（BM25/vector/hybrid 命中源）
- 回归门禁进 CI

### 建议的演进路线

```
Phase 2.5: Retrieval Quality Gate
  → 修复 evidence_vectors 不对称
  → passage hybrid 接入主搜索路径
  → passage packId/governance 过滤
  → 质量基线 fixture

Phase 3A: 版本 + 安全只读联邦
  → AC-21 (多版本 subject_key)
  → AC-22 + AC-25 (Federated MVP + 禁回流)

Phase 3B: Mirror（待 Phase 3A 验证后决定）
  → AC-23 (外部数据同步进本地治理)

砍出 F179:
  → AC-24 (知识进化) → 归 F163 或独立 Feature
  → 自动语义 conflict detection → 不承诺
```

### 深挖：short-circuit 与 doc-level 向量补写的关系（CVO 追问收敛）

**Q: doc-level 向量补写会不会让 short-circuit 失效？**

A: 不会。两个修复作用在不同层面：

- **short-circuit 解决的是粒度问题**（doc vs passage），不是数据可用性问题
- `depth=raw` 即使 `evidence_vectors` 里有 pack-knowledge 的 doc-level 向量，也不应该用它——用户要的是 chunk 粒度
- doc-level 向量补写修复的是 `depth=summary` + `mode=semantic/hybrid` 路径，让语义搜索能在文档级找到知识文档
- Phase 2.5 在 `depth=raw` 路径替换 `searchPassages()` 为 `searchPassagesHybrid()`，用的是 `passage_vectors`（passage 粒度），与 `evidence_vectors` 无关

**结论**：两条修复路径独立，short-circuit 保留且不受影响。

### 铲屎官确认（2026-05-07）

演进路线确认，按此执行。

## 收敛检查

1. 否决理由 → ADR？没有
2. 踩坑教训 → lessons-learned？有 → evidence_vectors 不对称（Phase 2 AC-201 跳过 rebuild 的副作用——跳过删除也跳过了 embedding 生成）
3. 操作规则 → 指引文件？没有
