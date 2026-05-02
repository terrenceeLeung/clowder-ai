---
feature_ids: [F179]
related_features: [F129, F169]
topics: [knowledge-governance, domain-knowledge, evidence-store, normalizer]
doc_kind: spec
created: 2026-05-01
community_issue: 569
---

# F179: Domain Knowledge Governance — 领域知识治理

> **Status**: in-progress | **Owner**: Ragdoll | **Priority**: P1

## Vision

Cat Cafe 当前的记忆系统（Evidence Store）能有效管理项目内部结构化文档（带 YAML frontmatter 的 markdown），但对外部领域知识的支持几乎为空白。

一个产品经理、运维工程师、或者新加入的开发者，手上有一堆散乱的设计文档、业务规则、操作手册、FAQ、会议纪要——他们无法把这些知识导入系统并让 AI 在工作中使用。

**目标**：让用户能将散乱的领域知识导入、清洗、治理，并在日常工作中通过 RAG 检索使用，最终让稳定的知识进化为可执行的 workflow/skill。

> 社区 issue: [#569](https://github.com/zts212653/clowder-ai/issues/569)

### 设计目标

1. **多格式导入**：MD/TXT 直接导入，PDF/DOCX/URL 经 LLM 提取后导入，对话中引导式录入
2. **LLM 驱动的 Normalizer**：自动生成结构化摘要、提取关键词、建议分类和权威等级——替代机械截断
3. **领域知识治理**：独立的生命周期管理（导入 → 清洗 → 审核 → 生效 → 刷新）
4. **内置 RAG + 可插拔外部 RAG**：内部 hybrid 检索 + 用户可接入自己的 RAG（Mirror/Federated 双模式）
5. **知识进化**：稳定知识 → Pack workflow draft → 验证 → 可选晋升为 Skill

### 现状痛点（基于 main 分支源码逐行验证）

| 问题 | 根因 | 影响 |
|------|------|------|
| "找到了但不是想要的段落" | doc-level 索引，snippet 是 extractSummary 取第一个非标题段落 ≤300 字，不是实际命中段 | 检索到文档但无法直接使用 |
| 长文后半段答案丢召回 | summary 只取第一段，后续内容不参与摘要 | FAQ、操作手册关键条款常在后半段 |
| 权威性区分依赖路径推断 | authority 由 pathToAuthority() 按文件路径推断（constitutional/validated/candidate/observed），activation 默认 query | 非标准路径的文档权威性不准确 |
| 非 markdown 不支持 | CatCafeScanner 只读 .md（不支持 .txt） | PDF、DOCX、外部文档完全无法导入 |
| PackKnowledgeScope 未上线 | 89 行 stub，content.slice(0,500) 作 summary，从未在生产路径调用 | Pack 知识导入形同虚设 |
| keywords 不参与检索 | evidence_fts 只索引 title + summary | keywords 字段写了白写 |

## Architecture Principles

### 原则 1：不做平行知识栈

所有领域知识走现有 Evidence Store（SQLite + FTS5 + vec0），不新建独立向量库。复用 KnowledgeResolver 作为联邦检索入口。

### 原则 2：Domain Pack 是基本组织单元

每个领域的知识以 Private Domain Pack 组织（复用 pack_id 隔离）。系统自动为用户创建 default Domain Pack 兜底——用户不需要先理解 Pack 概念就能开始导入。对话式导入的零散知识先进 default 包，后续可拆分到具名 Pack。

### 原则 3：always_on 保护

导入的领域知识默认 activation=query 或 scoped。晋升到 always_on 需要显式审批。authority 在 Normalizer 阶段产出建议值，不是终判值。防止领域文档导致 prompt 膨胀。

### 原则 4：Normalizer 三层结构（非协商底线）

输出必须是 source → document → section/chunk 三层结构。没有这个分层，"命中了文档但不是命中段""长文后半段掉召回"的老问题会原样复现。

### 原则 5：自动化边界

自动化负责压缩体力活（格式归一化、标题/章节提取、重复提示、boilerplate 剔除建议、authority/activation 默认建议）。**不替人拍知识边界的板**（不自动合并重复、不自动升 always_on、不自动判 invalid、不自动生成 active skill）。

### 原则 6：冲突检测不在查询路径

冲突检测应在 Normalizer/Governance/Audit 侧产生 potential conflict 候选，由检索层消费状态。不应塞进 IKnowledgeResolver 的在线查询路径。

## Data Structure Design

### 存储架构（评论区三猫收敛）

```
evidence_docs          — 保持 document-level canonical row（领域文档的 doc-level 元数据）
evidence_passages      — domain chunk 进通用化的 passage 层
  关联字段：doc_anchor + passage_id + position + heading_path + pack_id + passage_kind
  passage_kind = message | domain_chunk（区分 thread/session 消息与领域知识 chunk）
```

检索路径：raw 搜 passage → hydrate parent doc → 返回带上下文的结果。

anchor 使用导入时生成的 UUID（namespaced `dk:<uuid>`），不含 pack 名。pack_id 作为独立可变字段，知识跨 Pack 迁移只改 pack_id，不影响 evidence_passages 的 doc_anchor 关联。

### Normalizer 输出规范

三层结构：

```
Source（来源）
  └── Document（文档）
        └── Section/Chunk（章节/片段）
```

字段定义（按 Phase 0/1/2 对齐，不做人为分期延后）：

**Phase 0（Normalizer 一次 LLM 调用全出）：**
- 结构字段：`document_id`, `chunk_id`, `heading_path[]`, `chunk_index`, `content_markdown`, `plain_text`, `char_start`, `char_end`
- 治理字段：`doc_kind`, `authority`(建议值), `activation`(默认 query), `provenance_tier`, `extraction_confidence`
- 溯源字段：`source_id`, `source_locator`, `hash`, `normalized_at`, `source_updated_at`, `status`
- 可复现字段：`normalizer_version`, `model_id`
- 检索增强：`keywords[]`, `topics[]`, `language`, `token_count`, `dedupe_key`

**Phase 1（PDF/DOCX 支持 + Knowledge Hub 审核流程才需要）：**
- `preview_ref`, `page_no`, `citations/source_refs[]`, `last_reviewed`

**Phase 2（版本管理 + 冲突检测才需要）：**
- `subject_key`, `statement_type`, `version/effective_at`
- `conflict_group_id`, `conflict_reason`, `conflict_score`

三类字段缺一不可：**结构字段**（分层检索）+ **治理字段**（排序审计）+ **溯源字段**（答案可追责）。

### 治理状态机（独立于 MarkerQueue）

完整生命周期：`ingested → normalized → needs_review → approved → active → stale / retired`（异常路径：`failed`）

MarkerQueue 只适合轻量候选态，后半段状态（active/stale/retired）和异常路径（failed/rejected）它没有。独立状态机支撑知识的加工、反馈、版本更替等后续动作。

状态说明：
- **ingested**：用户导入完成，Normalizer 异步处理中（进度由 job tracker 追踪，不占生命周期状态）
- **normalized**：Normalizer 完成，待审核或自动通过
- **needs_review**：低置信度项，等人确认
- **approved**：审核通过，待写入索引
- **active**：已写入检索索引，可被查询命中
- **stale**：source_hash 变化检测到，旧版本标记；新内容创建新版本从 ingested 开始
- **retired**：用户主动下线，终态
- **failed**：ingested 或 normalized 阶段出错，支持重试

状态迁移所有权：

| 迁移 | 触发者 | 可重试 |
|------|--------|--------|
| ingested → normalized | 系统（Normalizer 完成） | ✅ |
| ingested → failed | 系统（Normalizer 出错） | ✅ 重跑 |
| normalized → needs_review | 系统（低置信度）或策略（首次导入强制） | — |
| normalized → approved | 系统（高置信度 + 策略允许自动通过） | — |
| needs_review → approved/rejected | 人工 | — |
| approved → active | 系统（写入检索索引） | ✅ |
| active → stale | 系统（source_hash 变化检测）或人工标记 | — |
| active → retired | 人工 | — |
| stale 处理 | 新内容创建新版本（ingested），旧版本保留 stale 标记 | — |

## Reusable Infrastructure

| 基础设施 | 现状 | 复用方式 |
|----------|------|----------|
| Evidence Store (SQLite + FTS5 + vec0) | 三模检索已跑通 | 领域知识的存储和检索 |
| Knowledge Pack (pack_id) | 隔离机制已有 | 每个领域一个 Domain Pack |
| F163 Authority/Activation | 4 级权威 + 4 种激活 | 领域知识的分级和激活控制 |
| Scanner 接口 | 可插拔 | Normalizer 作为独立可复用能力接入 |
| Marker pipeline | captured → approved → indexed | 治理流水线前半段可参考 |
| KnowledgeResolver | 联邦检索入口 | 新增 external source 路由 |
| Passage 机制 | thread/session 已有 | 扩展到普通文档的 chunk 级检索 |

## Phased Implementation

### Phase 0: Foundation — Normalizer + Chunk-level Retrieval + Governance

**范围：**
- 新增 KnowledgeImporter 模块：独立于 Pack 安装流程，共享 pack_id 隔离模型
- 新增 Normalizer：LLM 驱动的内容理解，输出三层结构化元数据（带版本追踪）
- 成本分级：短文档（≤2k tokens）全文处理，中文档 LLM 章节识别，长文档 heading-based 启发式分段 + LLM 摘要混合
- chunk 数据进 evidence_passages，Phase 0 即开启 hybrid 检索（BM25 + vec0），Normalizer 处理时同步生成 embedding
- 治理状态机独立运行
- 导入知识携带 authority / activation / provenance / extraction_confidence 治理元数据
- 原始文件存 gitignored 私有目录（.clowder/knowledge/），默认不导出
- 支持 MD 格式 + 对话式 wizard 录入（API 兼容 batch/connector）
- Domain Pack CRUD + default 包自动创建

**不做：** UI 面板、多格式转换、外部 RAG、Skill 进化、conflict detection

**验收标准：**
- [x] AC-01: KnowledgeImporter 模块独立于 Pack 系统，共享 Evidence Store 存储层
- [x] AC-02: Normalizer 处理 .md 文件，输出 source → document → passages 三层结构
- [x] AC-03: evidence_passages 存储 chunk 级数据，支持 heading_path / chunk_index / char_start / char_end 定位
- [x] AC-04: anchor 使用导入时 UUID（dk:uuid），pack_id 为独立可变字段
- [x] AC-05: 原始文件存储在 gitignored 私有目录（.clowder/knowledge/ 创建时自动写入 .gitignore，git status 在任何 F179 操作后不显示该目录下的文件变更）
- [x] AC-06: 治理状态机独立运行（含 needs_review / rejected / failed 路径）
- [x] AC-07: Hybrid passage retrieval（BM25 + vec0）可用，长文档后半段 chunk 可被检索命中
- [x] AC-08: PII/安全边界在开工前拍板（前置条件）
- [x] AC-09: Normalizer 输出带 normalizer_version / model_id，支持可复现性
- [x] AC-010: 导入知识携带 authority / activation / provenance / extraction_confidence 治理元数据
- [ ] AC-011: Fixture demo Pack 端到端验收——检索结果包含：命中 chunk 内容、父文档元数据（title/doc_kind/authority/activation）、原文定位（heading_path/char_start/char_end）、治理状态。含固定 query set 报告 Recall 和 Precision@5 baseline（不设硬阈值，作为 Phase 1 优化基线）。Fixture 使用虚构技术领域文档集（保证不在 LLM 训练数据中）
- [x] AC-012: Domain Pack CRUD（list/create/rename）+ 首次导入自动创建 default Domain Pack
- [x] AC-013: 导入事务原子性——raw file、evidence_docs row、evidence_passages rows、embedding rows 要么全部成功，要么可恢复（不产生半落库状态）
- [x] AC-014: evidence_passages schema 扩展不破坏现有 thread/session passage 的写入、检索和 hydrate 行为（兼容迁移）

### Phase 1: Knowledge Hub — 可视化导入与透视体验

**范围：**
- Source Adapters：PDF/DOCX/URL → LLM 提取 → Normalizer
- Hub "Knowledge Hub" 面板（吸入 → 透视 → 治理 → 闭环）
- Import Wizard + interactive cleaning（高置信自动归档，低置信弹确认）+ Import Summary 视图（入库前全局俯瞰）
- raw source ↔ normalized document ↔ chunk 透视链路
- Retrieval Playground：即时验证"系统学会了" + 就地调优（Edit Metadata / Add Keyword）
- Knowledge Texture：doc_kind 驱动 UI 视觉区分
- default Pack 毕业机制：超 chunk 数量阈值后 LLM 分析主题分布并生成分包建议，用户确认后一键拆包

**不做：** 外部 RAG、Skill/workflow 进化、Knowledge Graph 可视化

**验收标准：**
- [x] AC-11: Import Wizard 引导用户完成文档导入
- [x] AC-12: Knowledge Hub 展示 raw source ↔ normalized document ↔ chunk 透视链路
- [x] AC-13: 低置信度项需用户确认，高置信度自动归档但提供 Import Summary 全局俯瞰视图
- [x] AC-14: Retrieval Playground 输入问题精确命中对应 chunk
- [x] AC-15: default Pack 超阈值后 LLM 自动生成分包建议（主题聚类 + 命名），用户确认后一键拆包
- [x] AC-16: Knowledge Texture：不同 doc_kind 有视觉区分（底纹/色彩标识）
- [x] AC-17: Import Summary 视图：入库前展示 chunk 总数、需确认数、已就绪数
- [x] AC-18: Retrieval Playground 支持就地调优（Edit Metadata / Add Keyword），召回不对时当场补关键词

### Phase 2: Federation + Evolution — 外部知识联邦 + 知识进化

**范围：**
- KnowledgeResolver 新增 external source registry
- Mirror 模式：同步进 Domain Pack（全治理 + 可进化 Skill）
- Federated 模式：查询时 citation-only 透传（不参与 Skill 进化），含 ACL 校验 + cache TTL
- Conflict detection（async audit，非 query-time）：版本感知 + 用户手动标记冲突
- 知识 → Pack workflow draft → 人审 → 可选晋升 Skill（需证据链）
- Federated 结果禁止自动回流本地，必须显式 promote/mirror

**不做：** active skill 自动生成、实时双向同步、企业权限图、自动语义冲突检测

**验收标准：**
- [ ] AC-21: 同 subject_key 多版本文档，默认返回最新版 + 旧版本标注
- [ ] AC-22: Federated MVP：外部结果 citation-only 透传，不混排，含 ACL 校验 + cache TTL 策略
- [ ] AC-23: Mirror 路径：外部数据同步进本地走完整治理
- [ ] AC-24: 知识进化：稳定知识可生成 workflow/guardrail 草案（带 evidence chain + validation cases）供人审
- [ ] AC-25: Federated 结果禁止自动回流本地，必须显式 promote/mirror

## User Journey

一个新用户装好 Clowder AI，手上有一堆散乱文档：

```
1. 安装启动 → 系统自动创建 default Domain Pack
2. 选择导入方式：
   - 对话："我们的退款规则是这样的..." → 猫引导提取 → 确认 → 入库
   - Hub 拖拽：文件夹/文件拖入 Knowledge Hub → 后台 Normalizer 处理
3. 看到"透视"预览：系统提取了什么、怎么分类、建议的权威等级
4. 用户做高价值判断：确认分类 + 权威等级（不需要懂 frontmatter/embedding）
5. 验证闭环：问一个真实问题 → 答案带引用来源 → "系统学会了"
```

核心体验是**"透视"而非"黑盒"**——用户必须看到系统提炼了什么。

## Industry References

| 产品/趋势 | 参考价值 |
|-----------|----------|
| Cursor/Windsurf | Rules vs Memories vs Index 三层模型 |
| Devin | 代码自动生成 Wiki + 企业文档 Knowledge Graph |
| RAG 共识 | Hybrid retrieval (BM25+vector+RRF) 是标配；hierarchical indexing ROI 最高 |
| Glean | Enterprise Graph + 权限保留检索；数据新鲜度是全行业未解难题 |
| NotebookLM | 文档驱动模型比对话驱动更适合领域知识 |
| 趋势 | Memory + RAG 融合为统一检索层；"知识→可执行 Skill"仍是空白市场 |

## Dependencies

- **Related**: F129（Pack System — 共享 Evidence Store 存储层，知识治理独立于 Pack 安装生命周期）
- **Related**: F169（Agent Memory Reflex — 记忆系统愿景，知识治理是其中一个维度）

## Risk

| 风险 | 缓解 |
|------|------|
| Normalizer 依赖外部 LLM，PII 泄露 | AC-08：Phase 0 前拍板安全边界 |
| 非 Markdown 格式转换质量不可控 | Phase 0 先支持 .md，Phase 1 扩展；保留原文审计 |
| Federated 混排信任校准复杂 | Phase 2 MVP 只做 citation-only 透传 |
| workflow 执行引擎不存在 | 知识进化定位为"生成草案"，不依赖执行引擎 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | ~~PII 扫描策略~~ → 已收敛为 KD-12 | ✅ 已定 |
| OQ-2 | ~~Normalizer LLM 选型~~ → 用户自配（KD-13 独立配置覆盖），不限定模型 | ✅ 已定 |
| OQ-3 | ~~非 .md 格式~~ → Phase 0 只支持 .md，非 .md 返回明确错误提示，Phase 1 加 PDF/DOCX/URL | ✅ 已定 |
| OQ-4 | ~~Visibility/ACL~~ → 单用户系统无 ACL。Private by default（gitignored），导出 Pack 是显式分享 | ✅ 已定 |
| OQ-5 | ~~去重策略~~ → source_path 做身份匹配 + source_hash 做版本判断。路径相同+hash 相同→跳过；路径相同+hash 不同→新版本（旧标 stale）；复制+改名→Phase 2 LLM 语义去重 | ✅ 已定 |
| OQ-6 | ~~Normalizer 可复现性~~ → 记录 normalizer_version/model_id/prompt_version 用于溯源（AC-09），不做重跑机制 | ✅ 已定 |
| OQ-7 | ~~Federated cache/prompt~~ → KD-7 citation-only 已定：不缓存到 Evidence Store，不注入 prompt，不自动回流。Display-only | ✅ 已定 |
| OQ-8 | ~~治理字段策略~~ → authority/doc_kind = LLM 建议+用户可改；activation = 系统默认 query；extraction_confidence = 系统输出不可改（驱动自动分流） | ✅ 已定 |
| OQ-9 | ~~版本身份模型~~ → source_path 做源级身份，anchor(dk:uuid) 做版本级身份（每版本新 UUID），pack_id 做组织级身份（随时可改不影响数据）。迁移/拆包只改 pack_id | ✅ 已定 |
| OQ-10 | ~~Normalized markdown 落盘路径~~ → Normalizer 输出直接写 SQLite，不生成独立文件，无需 gitignore | ✅ 已定 |
| OQ-11 | ~~Fixture demo Pack 选型~~ → 虚构技术领域文档集（"MeowGrid 分布式调度引擎"运维手册），保证不在 LLM 训练数据中 | ✅ 已定 |
| OQ-12 | ~~Token budget~~ → domain knowledge 通过 search_evidence 工具调用返回，不注入 system prompt，无 token 竞争 | ✅ 已定 |
| OQ-13 | ~~CatCafeScanner 迁移路径~~ → 已收敛为 KD-14（Phase 0 后 follow-up） | ✅ 已定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 知识导入独立于 Pack 安装流程（共享 pack_id 隔离模型） | PackKnowledgeScope 是 Pack 安装生命周期，用户知识导入是独立流程；存储层仍通过 pack_id 隔离 | 2026-04-30 |
| KD-2 | anchor 用导入时 UUID（namespaced `dk:<uuid>`），不含 pack 名 | pack 名变化导致 anchor 断裂；namespace 前缀区分知识文档与其他 evidence 类型 | 2026-04-30 |
| KD-3 | 原始文件存 gitignored 私有目录 | 防止敏感内容被 git add 意外 push（F129 Growth 概念） | 2026-04-30 |
| KD-4 | 状态机独立，不复用 MarkerQueue | 知识后半段状态（active/stale/retired）MarkerQueue 没有；第一轮 2:1、第二轮 3:0 全票通过 | 2026-04-30 |
| KD-5 | Normalizer 为独立可复用能力（带版本追踪） | 输出带 normalizer_version / model_id；不仅服务用户导入，也可服务 CatCafeScanner 和 Pack 安装路径 | 2026-04-30 |
| KD-6 | 对话式录入 = wizard（API 兼容 batch） | 结构化引导流程，不做开放式语义提取；API 层兼容 batch/connector 走同一 ImportSession | 2026-04-30 |
| KD-7 | Federated MVP = citation-only 透传 | 外部结果缺乏治理信息，混排信任校准不成熟 | 2026-04-30 |
| KD-8 | 领域知识默认 activation=query（always_on 保护） | 架构原则 3：领域知识不应默认注入每次对话，防止 context 膨胀和噪音 | 2026-05-01 |
| KD-9 | 自动化边界：压缩体力活，不替人拍板 | 架构原则 5：Normalizer 建议分类/置信度，最终入库由人确认；wizard 引导但不自动决策 | 2026-05-01 |
| KD-10 | evidence_passages 新增 passage_kind 字段 | 区分 thread/session message 与 domain_chunk，避免 hydrate/filter/ranking 语义混淆 | 2026-05-01 |
| KD-11 | char_start/char_end 移入 Phase 0 | AC-03 要求 chunk 定位，字段不能延后到 Phase 1（Design Gate P1-2） | 2026-05-01 |
| KD-12 | PII 检测采用接口预留 + 分阶段实现：Phase 0 默认正则检测（结构化 PII）+ 知情同意；Phase 1 封装 Presidio 开源服务实现 | 接口隔离，不引入外部依赖到 Phase 0；Presidio MIT 协议可本地部署，避免"检测 PII 又发外部"套娃 | 2026-05-01 |
| KD-13 | Normalizer 使用独立 LLM 配置（含 embedding 模型），不复用 CatAgent provider。Embedding 为可选配置，未配时退化为 BM25-only 检索 | 文档处理和对话是不同工作负载；embedding 可选保证无 API key 时仍可用 | 2026-05-01 |
| KD-14 | CatCafeScanner 接 Normalizer 作为 Phase 0 后 follow-up，不纳入 Phase 0 scope | scope 控制；Phase 0 先证明 Normalizer 可用，follow-up 快速迭代切换 CatCafeScanner | 2026-05-01 |
| KD-15 | 状态机精简：captured→ingested，删除 normalizing（job tracker 追踪）和 indexed（合并入 active），stale 不循环回起点（新版本从 ingested 开始） | 铲屎官 review：normalizing 是瞬态不需要正式状态；captured 语义不准确；循环回 captured 不合理 | 2026-05-01 |
| KD-16 | Phase 0 即开启 hybrid 检索（BM25 + vec0），不延后到 Phase 1 | vec0 基础设施已跑通，Normalizer 处理时同步生成 embedding 即可 | 2026-05-01 |
| KD-17 | 导入事务原子性：raw file + doc row + passage rows + embedding rows 全部成功或可恢复 | 防止半落库状态（用户导入大文件时部分写入）；铲屎官确认为硬 AC | 2026-05-01 |
| KD-18 | evidence_passages 扩展必须兼容迁移，不破坏现有 thread/session passage | 新增 passage_kind 等列使用 DEFAULT 值，FTS5 触发器增量更新 | 2026-05-01 |
| KD-19 | 单用户系统无 ACL，导入知识默认 private（gitignored），分享通过显式导出 Pack | Cat Cafe 是单用户架构，多层 ACL 无意义 | 2026-05-01 |
| KD-20 | 去重策略：source_path 身份匹配 + source_hash 版本判断。路径同+hash 同→跳过；路径同+hash 异→新版本旧标 stale | 文件路径是版本关联纽带，hash 判断内容变化；复制+改名靠 Phase 2 LLM 语义去重 | 2026-05-01 |
| KD-21 | 治理字段策略：authority/doc_kind = LLM 建议+用户可改；activation = 系统默认 query；extraction_confidence = 系统不可改 | extraction_confidence 驱动自动分流（高→auto approve，低→needs_review），用户改的是知识判断不是置信度 | 2026-05-01 |
| KD-22 | 版本身份三层模型：source_path（源级）+ anchor dk:uuid（版本级，每版本新 UUID）+ pack_id（组织级，可变不影响数据） | 迁移/拆包只改 pack_id，不影响 passages/索引；新版本新 UUID 保持旧版本可追溯 | 2026-05-01 |
| KD-23 | Federated 结果不缓存、不注入 prompt、不自动回流，display-only | KD-7 citation-only 的具体化：外部结果只展示给用户，沉淀需显式 promote/mirror | 2026-05-01 |
| KD-24 | Normalizer 可复现性仅记录版本信息用于溯源，不做重跑机制 | Normalizer 是格式转换不是实验，输出不对就重新导入走新版本流程 | 2026-05-01 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | issue #569 发布，社区讨论 + 三猫收敛（chunk 存储方案确认） |
| 2026-04-23 | 社区反馈采纳（Normalizer 成本分级、验收标准补充、token budget） |
| 2026-04-30 | 代码核查 + 设计方向评论发布（7 条 Phase 0 结论 + Phase 1/2 愿景） |
| 2026-05-01 | F179 立项 + 第一轮三猫 Design Gate（gpt55+gpt52+opus-47）+ 铲屎官重写 spec |
| 2026-05-01 | 第二轮三猫 Design Gate（gpt55+gemini+opus-46）：P1 全部解决，KD-4 全票通过 |
| 2026-05-01 | 铲屎官接手 + 完备性审查（opus+gpt55）：OQ-10/11/12 关闭，新增 KD-17/18 + AC-013/014，embedding 可选 |
| 2026-05-02 | Phase 0 实现完成 + 合入 main（PR #9）：13/14 AC ✅，AC-011 fixture 独立任务 |
| 2026-05-03 | Phase 1 合入 main（PR #13）：8/8 AC ✅，Knowledge Hub 全功能上线（缅因猫 6 轮 review + 云端 review 2 轮） |

## Review Gate

- Phase 0: 架构级 → 跨猫 collaborative-thinking → 铲屎官拍板
- Phase 1: 前端 UI → 铲屎官确认 wireframe
- Phase 2: 架构级 → 猫猫讨论 + 铲屎官拍板

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Community** | [#569](https://github.com/zts212653/clowder-ai/issues/569) | 社区 issue 原始需求（愿景 + 架构原则 + 数据结构设计） |
| **Discussion** | `docs/discussions/issue-569-comment-draft.md` | 代码核查 + 设计方向评论文稿 |
| **Feature** | `docs/features/F129-pack-system-multi-agent-mod.md` | Pack 系统（共享存储层） |
| **Feature** | `docs/features/F169-agent-memory-reflex.md` | Agent Memory Reflex 愿景 |
