---
feature_ids: [F179]
topics: [knowledge-governance, issue-569]
doc_kind: discussion
created: 2026-04-30
---

# Issue #569 评论草稿

> 待铲屎官确认后发到 GitHub

## 代码核查 + 设计方向 + Phase 1/2 愿景补充

基于 main 分支源码逐行核查，结合团队（Opus-46 + GPT-5.4 + GPT-5.5）多轮讨论。

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
- Open Question #2（chunk 存储方式）评论区已收敛为 evidence_passages，issue body 未更新。

---

### 二、Phase 0 设计方向（7 条结论）

**1. 知识导入独立于 Pack 系统。**
PackKnowledgeScope 是 Pack 安装生命周期的一环（同步扫目录），用户知识导入是独立流程（按需提交 + LLM 处理 + 用户审核）。新建独立模块，存储层共享 Evidence Store + pack_id 隔离。Pack 安装时可调用此模块，反之不然。

**2. anchor 用导入时生成的固定 ID，不包含 pack 名。**
当前 `pack:${packName}:${filename}` 格式，在知识跨包迁移时 anchor 变化导致 evidence_passages 的 doc_anchor 关联全部断裂。改为导入时生成一次、永远不变的稳定 ID（如 UUID）。pack_id 作为独立可变字段，迁移只改 pack_id。内容变更用 source_hash 检测，不影响 anchor。

**3. 原始文件默认存 gitignored 私有目录。**
F129 区分 Pack（可分享）和 Growth（本地私有）。用户导入知识默认私有（如 `.clowder/knowledge/`），防止敏感内容被 git add 意外 push。需要分享时显式导出到 Pack。

**4. 安全/PII 边界 Phase 0 前拍板。**
Normalizer 要把文档内容发给外部 LLM。哪些内容能发、需不需要 PII 扫描、private/team-shared/exportable 怎么分，必须开工前定。

**5. 状态机独立，不复用 MarkerQueue。**
知识的完整生命周期：captured → normalizing → normalized → approved → indexed → active → stale → retired。MarkerQueue 只适合轻量候选态，后半段状态（active/stale/retired）它没有。

**6. 对话式录入定义为 wizard。**
结构化引导流程（选领域 → 上传/粘贴 → 预览提取结果 → 确认入库），不做开放式语义提取。

**7. Normalizer 设计为独立可复用能力。**
不仅服务用户导入路径，也应能服务现有 docs/ 扫描路径（CatCafeScanner）和 Pack 安装路径（PackKnowledgeScope）。Phase 0 只接第一条，但接口预留后两条接入。

---

### 三、Phase 1 愿景补充：可视化导入是核心产品，不是 UI 附属

issue 写了 Knowledge Hub 面板和 ImportSession，但没展开产品形态。我们的看法：

**透视体验是最大产品差异点。** 大多数 RAG 工具是黑盒，用户不知道系统怎么理解了自己的文档。Knowledge Hub 要做到：用户能看到 Normalizer 怎么切分文档、每段来自原文哪里、置信度多少。

**分层展示，不要逐条 review。** 200 页合同切出 500 个 chunk，不能让用户逐个过。默认只展示低置信度项（"这段不确定怎么分类，你看一下"），高置信度静默通过，想看可展开。

**Retrieval Playground 是最强验收体验。** 用户导入文档后，立刻输入一个真实问题，系统精确命中刚导入的某个章节——"系统学会了"的信任感就建立了。

**所有格式进同一个 ImportSession。** PDF/DOCX/URL/粘贴内容走同一条流水线，不要每种格式一条散乱路径。

---

### 四、Phase 2 愿景补充

#### 冲突检测："异步审计，不在查询路径"是对的，但实现路径要务实

issue 的架构原则 6 正确——搜索时不做冲突检测。但"自动语义冲突检测"（发现两段话说的是反的）是学术界未完全解决的问题。

**务实路径：先做版本感知，再做人工标记冲突。**
- 同 subject_key 的多版本文档，默认返回最新版，标注"有旧版本存在"
- 用户手动标记"这两个说法矛盾"→ 系统记录 conflict_group
- 80% 真实冲突是过时信息，版本感知 + effective_at/version 字段就能解决
- 自动语义冲突检测作为增强能力，不作为 Phase 2 的验收标准

#### 外部知识库：Federated MVP 应该是 citation-only 透传

**Mirror 没有新架构挑战**——就是定时触发的 KnowledgeImporter，Normalizer 处理外部数据，走同一套治理。

**Federated 的难点是信任校准**：本地知识有完整治理（authority/activation/provenance），外部结果什么都没有。混排排序怎么做？

**Federated MVP 建议：不混排，citation-only 透传。** 外部结果单独展示为"来自 Confluence/Google Drive 的参考"，不跟本地知识混排。用户觉得有价值的，手动 Mirror 进来走治理。信任校准模型成熟后再做混排。

外部结果"是否沉淀成本地知识"必须是显式操作（promote/mirror），不能默认回流。

#### 知识进化：目标是"生成可审阅的草案"，不是"自动生成 skill"

当前 workflow 执行引擎不存在。直接说"知识进化为可执行 skill"跳了好几步。

**务实路径：稳定知识 → workflow/guardrail 草案 → 人审 → 案例验证 → Pack workflows/defaults。**
Skill 晋升必须有证据链——哪些 source、哪些场景验证通过。这是 L2 愿景，不是 Phase 0/1 验收项。

---

### 五、总结

**issue #569 的方向完全正确——这不是"给搜索补个 chunk"，是 Cat Cafe 从 coding memory 走向任意领域知识协作平台的关键。**

Phase 0 的核心是打通 Normalizer + chunk-level 检索 + 治理状态机。Phase 1 的核心是 Knowledge Hub 透视体验。Phase 2 的核心是外部知识联邦 + 版本/冲突治理 + 知识进化草案。

我们基于以上方向直接启动立项。

[铲屎官 + 宪宪/Opus-46🐾 + 砚砚/GPT-5.4🐾 + 砚砚/GPT-5.5🐾]
