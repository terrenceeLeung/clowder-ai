---
feature_ids: [F179]
topics: [knowledge-governance, issue-569]
doc_kind: discussion
created: 2026-04-30
updated: 2026-05-01
---

# Issue #569 评论草稿（v2）

> 已发布到 GitHub，最后更新 2026-05-01

## 代码核查 + 设计方向 + Phase 1/2 愿景补充

基于 main 分支源码逐行核查，结合团队两轮 Design Gate 讨论（Opus-46 + GPT-5.5 + GPT-5.4 + Opus-47 + Gemini-3.1-Pro）。

---

### 一、代码核查：issue 描述与代码不符之处

| issue 描述 | 代码实际 |
|-----------|---------|
| snippet 前 300/500 字截断 | CatCafeScanner 取**第一段** ≤300 字（extractSummary）；PackKnowledgeScope 取前 500 字（content.slice(0,500)）。两条路径，机制不同 |
| authority/activation 默认 mid | 无 mid 级别。authority 默认 observed，有 pathToAuthority() 按路径推断；activation 默认 query |
| Scanner 读 .md/.txt | Scanner 只读 .md，不支持 .txt |
| keywords 影响检索 | evidence_fts 只索引 title + summary，keywords 不参与全文检索 |

痛点 2（长文后半段丢）和痛点 5（PackKnowledgeScope 太薄）描述准确，无异议。

其他发现：
- Phase 2 知识进化依赖 workflow 执行能力，但 Cat Cafe 当前没有 workflow 执行引擎。PackCompiler 只把 workflow YAML 编译为 system prompt 文本，无程序化执行。

---

### 与原提案的主要调整

基于代码核查和多轮讨论，以下方案相对 issue 原始提案做了调整：

| 原提案 | 调整后 | 原因 |
|--------|--------|------|
| 增强 PackKnowledgeScope | 新建独立 KnowledgeImporter 模块 | PKS 是 Pack 安装生命周期的一环，用户导入是独立流程，不应耦合 |
| 复用 Marker pipeline 做治理 | 独立治理状态机 | Marker 缺少 active/stale/retired 后半段状态，不够用 |
| Phase 0 只做 BM25 | Phase 0 即开启 BM25 + vec0 hybrid 检索 | vec0 基础设施已跑通，不做人为分期 |
| keywords/topics/char_start 等字段延后到 Phase 1 | Phase 0 一次出齐 | 检索增强字段不应延后，否则 Phase 0 的检索质量验收缺基础 |
| 状态用 captured/normalizing/indexed | 改为 ingested，删除 normalizing/indexed | ingested 语义更准确；normalizing 是瞬态用 job tracker；indexed 与 active 重叠 |

设计目标（5 条）和架构原则（6 条）与 issue 原文完全一致，未修改。

---

### 二、Phase 0 设计方向（10 条结论，含 16 个 Key Decisions）

**1. 知识导入独立于 Pack 系统（KD-1）。**
PackKnowledgeScope 是 Pack 安装生命周期的一环（同步扫目录），用户知识导入是独立流程（按需提交 + LLM 处理 + 用户审核）。新建 KnowledgeImporter 模块，存储层共享 Evidence Store + pack_id 隔离。

**2. anchor 用导入时 UUID（`dk:<uuid>`），不含 pack 名（KD-2）。**
当前 `pack:${packName}:${filename}` 格式，在知识跨包迁移时 anchor 变化导致 evidence_passages 的 doc_anchor 关联全部断裂。改为导入时生成一次、永远不变的稳定 ID。pack_id 作为独立可变字段，迁移只改 pack_id。

**3. 原始文件默认存 gitignored 私有目录（KD-3）。**
用户导入知识默认私有（`.clowder/knowledge/`），防止敏感内容被 git add 意外 push。需要分享时显式导出到 Pack。

**4. PII 检测：接口预留 + 分阶段实现（KD-12）。**
定义 `IPiiDetector` 接口。Phase 0 默认正则检测（手机号、身份证、银行卡等结构化 PII）+ 知情同意弹窗。Phase 1 封装 [Microsoft Presidio](https://github.com/microsoft/presidio) 开源服务实现（MIT 协议，可本地部署，避免"检测 PII 又发外部"的套娃）。

**5. 状态机独立，不复用 MarkerQueue（KD-4, KD-15）。**
精简后的生命周期：`ingested → normalized → needs_review → approved → active → stale / retired`（异常：`failed`）。
- `ingested`（非 captured——用户主动导入，不是被动捕获）
- 删除 `normalizing`——Normalizer 处理进度由 job tracker 追踪，不占生命周期状态
- 删除 `indexed`——SQLite FTS5 写入即刻可查，合并入 `active`
- `stale` 不循环回起点——新内容创建新版本，旧版本保留 stale 标记
- 两轮三猫讨论（2:1 → 3:0）确认独立方案

**6. Normalizer 使用独立 LLM 配置（KD-13）。**
文档处理和猫的对话是不同工作负载。用户应能为 Normalizer 选择不同模型（如用便宜模型做批量文档处理），不复用 CatAgent provider。

**7. Phase 0 即开启 hybrid 检索（KD-16）。**
vec0 基础设施已在 Evidence Store 跑通。Phase 0 的 Normalizer 处理时同步生成 embedding，直接开启 BM25 + vec0 hybrid retrieval。不做"先 BM25，后加 vector"的人为分期。

**8. Normalizer 输出字段按 Phase 0/1/2 对齐，不做人为分期。**
Phase 0 一次 LLM 调用全出：结构字段（document_id, chunk_id, heading_path[], char_start/char_end 等）+ 治理字段（authority, activation, extraction_confidence 等）+ 溯源字段 + 检索增强（keywords[], topics[], dedupe_key）。Phase 1/2 字段只增加各自功能需要的（如 page_no, conflict_group_id）。

**9. 对话式录入定义为 wizard（KD-6）。**
结构化引导流程，不做开放式语义提取。API 层兼容 batch/connector 走同一 ImportSession。

**10. CatCafeScanner 接 Normalizer 作为 Phase 0 后 follow-up（KD-14）。**
Normalizer 设计为独立可复用能力（KD-5）。Phase 0 先证明 Normalizer 可用，完成后快速迭代将 CatCafeScanner 的 docs/ 扫描路径切换到 Normalizer。

---

### 三、Phase 1 愿景：可视化导入是核心产品

**透视体验是最大产品差异点。** 大多数 RAG 工具是黑盒。Knowledge Hub 要做到：用户能看到 Normalizer 怎么切分文档、每段来自原文哪里、置信度多少。

**Import Summary + 分层展示。** 高置信度自动归档，但入库前必须提供全局俯瞰视图（"共 120 个 chunk，3 个需确认，117 个已就绪"）。保持掌控感。

**Retrieval Playground + 就地调优。** 用户导入后立刻输入真实问题验证。召回不对时当场补关键词或调权——Playground 不只是测试，是最高效的治理反馈回路。

**Knowledge Texture。** doc_kind 驱动 UI 视觉区分（Policy/FAQ/Spec 不同底纹），扫视检索结果时一秒建立上下文预期。

**default Pack 毕业 = LLM 自动分包建议。** 超阈值时 LLM 分析主题分布，生成分包建议（"建议拆为 3 个包：API 文档 45 条、业务规则 60 条"），用户一键确认。不做硬阻断，不做空喊提示。

---

### 四、Phase 2 愿景

#### 冲突检测：先版本感知，再人工标记

同 subject_key 的多版本文档，默认返回最新版，标注"有旧版本存在"。用户手动标记矛盾 → 系统记录 conflict_group。80% 真实冲突是过时信息，版本感知 + effective_at 字段就能解决。自动语义冲突检测作为增强能力，不作为验收标准。

#### 外部知识库：Federated MVP = citation-only 透传（KD-7）

外部结果单独展示为"来自 Confluence/Google Drive 的参考"，不跟本地知识混排。用户觉得有价值的手动 Mirror 进来走治理。外部结果沉淀为本地知识必须是显式操作（promote/mirror），不能默认回流。

#### 知识进化：目标是"生成可审阅的草案"

务实路径：稳定知识 → workflow/guardrail 草案 → 人审 → 案例验证。Skill 晋升必须有证据链。

---

### 五、总结

**issue #569 的方向完全正确——这不是"给搜索补个 chunk"，是 Cat Cafe 从 coding memory 走向任意领域知识协作平台的关键。**

完成两轮 Design Gate（5 猫参与），16 个 Key Decisions 收敛。Phase 0 核心：KnowledgeImporter + Normalizer + hybrid 检索 + 治理状态机。Phase 1 核心：Knowledge Hub 透视体验。Phase 2 核心：外部知识联邦 + 版本/冲突治理 + 知识进化草案。

[铲屎官 + 宪宪/Opus-46🐾 + 砚砚/GPT-5.5🐾 + 砚砚/GPT-5.4🐾 + 宪宪/Opus-47🐾 + 烁烁/Gemini-3.1-Pro🐾]
