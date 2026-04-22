---
feature_ids: []
topics: [memory, knowledge-engineering, teaching, metacognition, llm-wiki]
doc_kind: research
created: 2026-04-21
---

# 费曼猫知识教学引擎 — 讨论记录

> **阶段**: 讨论中（未立项） | **参与者**: CVO + 布偶猫 + 缅因猫(gpt52) + 缅因猫(codex)
> **日期**: 2026-04-21

## 背景：讨论怎么开始的

CVO 发起的三个交叉目标：
1. 结合 Karpathy LLM Wiki 理念，增强 Cat Cafe 的知识工程
2. 让猫猫能教用户项目知识（费曼学习法）
3. CVO 自己要用 Cat Cafe 准备面试（从 contributor 升级到 maintainer 级理解）

**CVO 的核心愿景（第二轮澄清）**：
- 做好知识工程是初衷，费曼猫是知识工程的消费层
- 分两面：面 1 自身知识工程增强（猫猫出征 + 借 LLM Wiki 东风推广）；面 2 用 Cat Cafe 打样（费曼猫教用户，反哺系统）
- 产品化导向，不仅是个人工具

## 讨论脉络

### 1. Cat Cafe vs LLM Wiki 对比

**LLM Wiki 三层架构**：Raw Sources → Wiki Pages → Schema
**Cat Cafe 对应关系**：`docs/*.md` → `evidence_docs (SQLite)` → `edges + authority/status`

| 维度 | LLM Wiki | Cat Cafe |
|------|----------|---------|
| Ingest 标准 | 宽（丢文件进来 LLM 编译） | 严（pathToAuthority 路径规则 + frontmatter 规范） |
| 治理深度 | 浅（无 authority 分层、无生命周期） | 深（四级 authority + 三轴元数据 + 审核流） |
| 透明度 | 高（人和 agent 看同一份 markdown） | 低（agent 看 SQLite，人看 MemoryHub，有信息不对称） |
| 消费模式 | Query 单向（用户问系统答）+ 查询反哺（写回 wiki） | 检索为主（search_evidence），缺教学式交互 |

**关键发现**：LLM Wiki 的 Query 有反哺机制（好问题写回 wiki page），Cat Cafe 的 search_evidence 是纯只读的。知识复利靠对话中的 marker 提取，不靠检索。

**结论**：不做 LLM Wiki 的竞品，借其 Query 反哺理念增强 Cat Cafe 的知识消费层。

### 2. 产品定位收敛

- Cat Cafe 的知识治理是开发的**副产品**，不是独立产品
- Cat Cafe 自身是最好的打样（"用 Cat Cafe 开发，你自然获得知识治理"）
- 不做第五套记忆系统，在 MemoryHub 内进化
- 不做 RawSourceScanner / 宽泛 ingest（和 Cat Cafe 严格 ingest 哲学冲突）
- 不降低 ingest 标准，而是降低用户达到标准的成本

### 3. 费曼猫的本质

- **费曼猫 = 交互式元认知** = F100 的 Mode D (Teaching Evolution)
- **费曼猫 = LLM Wiki Query 的增强版**（+Quiz +反哺 +抗 sycophancy）
- 教学过程暴露 knowledge gap → 反哺改善文档 → 飞轮效应
- 抗 sycophancy 是核心设计约束：置信度锚定 evidence authority，不锚定用户反应

### 4. 已确认的技术事实

讨论中澄清了 Cat Cafe 记忆系统的实际工作方式：

**authority 生成**：完全自动，`pathToAuthority()` 纯函数根据文件路径推导：
- `docs/decisions/` → validated，`docs/features/` → validated
- `lessons-learned.md` / `shared-rules.md` → constitutional
- 其他 → observed

**索引更新时机**：有 fingerprint 机制。新会话时前端检查 fingerprint 是否变化 → 变了就提示"索引已过期" → 用户点"更新索引"触发 bootstrap 重建。不需要手动重启。

**Marker 回流路径**：猫调用 `retain-memory` callback → MarkerQueue.submit({content, source, status:'captured'}) → Feed UI 审核 → approve 后 MaterializationService 写入 evidence_docs。Marker 提交时只有 content，没有 kind；kind 由 materialize 阶段决定（默认 lesson）。

### 5. Design Gate 讨论（三猫参与）

四个设计问题及结论：

**Q1 检索 Scope** — 三猫共识：默认 `scope=docs, mode=hybrid, depth=summary, dimension=project`。Quiz/Explore 只搜 docs。Explain 可 fallback 到 threads summary（标注低置信度）。

**Q2 反哺 Marker Kind** — gpt52 深入分析被采纳：gap/correction/relation 是发现来源（feynman_type），不是 evidence kind。不新增 kind，content 写清楚即可。反哺真正价值是发现 gap 后去改 docs/*.md。

**Q3 Quiz 题源** — 三猫一致：标准题（可评分）仅 constitutional + validated；开放题（不评分）candidate 可用；observed 禁止出题。fail-closed。

**Q4 Phase A Scope** — 三猫一致但后续讨论推翻了"只做 SKILL.md"的方案（见下文）。

### 6. 入口与隔离问题（CVO 追问触发）

CVO 问："纯 skill？对话入口在哪里？"

分析了三种入口方案：
- A: 普通 thread + skill（无隔离、无入口提示、无索引检查时机）
- B: 专用 thread（类似狼人杀 /g 命令，创建独立 thread）
- C: MemoryHub 内嵌（加 Learn tab）

参考了狼人杀的实现模式：`/g` 命令 → `POST /api/game/start` → 创建专用 thread（route marker: `games/werewolf`）→ GameShell 全屏覆盖 UI。

初步倾向方案 B（专用 thread），但 CVO 指出**还没到定方案的阶段**。

### 7. CVO 的方向审视（第三轮）

CVO 提出的关键质疑：
> "错题本、quiz 记录、进度都应该落盘成文件或数据库，也要有 MCP 工具承载吧？然后我们这个东西的初衷是做好知识工程的一部分，这里有没有跑偏？"

**审视结论：有跑偏风险。**

费曼猫的初衷是知识工程的消费层（让用户能用治理好的知识）。但讨论中逐渐膨胀为一个**学习管理系统**（quiz 记录、错题本、进度追踪、专用 UI）。这偏离了知识工程的核心。

## 外部调研：LLM Wiki 生态的教学/Quiz 现状

### 核心发现

**LLM Wiki 生态没有内置教学功能。** lucasastorian/llmwiki 和 nashsu/llm_wiki 都只做知识编译和组织，不做教学。

**生态中的零星实现：**
- tonbistudio/llm-wiki：可从 wiki 页生成 Obsidian 格式 flashcard（最接近的）
- awesome-llm-wiki 中有 fork 支持 flashcard 生成，但都是简单的问答对提取
- DeepTutor Claude Skill：知识图谱 + RAG + 自适应 Quiz（独立项目，非 LLM Wiki 分支）
- adaptive-knowledge-graph：贝叶斯技能追踪 + 实时评估（学术原型）
- LECTOR（arxiv 2508.03275）：LLM 增强的间隔重复调度（学术论文）

**关键 gap：没有人把知识治理和教学评估统一起来。**

生态分两个阵营：
1. **知识管理**（LLM Wiki、Obsidian 插件）—— 只管组织，不管教
2. **学习平台**（Anki + LLM、AI 家教）—— 只管教，不管知识来源的可信度

没有项目同时解决：知识治理（authority/lifecycle）+ 结构化学习 + 评估 + 间隔重复。

**这意味着：如果 Cat Cafe 做到了，这是一个差异化的空白市场。但也意味着没有参考实现可以借鉴。**

### 和费曼猫的关系

| 费曼猫能力 | 生态现状 | Cat Cafe 优势 |
|-----------|---------|-------------|
| 基于知识库的问答 | LLM Wiki Query 已有 | Cat Cafe 有 authority 分层，回答更可信 |
| Quiz 出题 | 独立工具有（Anki+LLM） | Cat Cafe 能按 authority 控制题源质量 |
| 错题本/进度 | 商业平台有（Vokos/RemNote） | 无优势，需要从零建 |
| 知识反哺 | LLM Wiki write_page 有 | Cat Cafe 有审核流（Feed），更严谨 |
| 间隔重复 | Anki/LECTOR 已成熟 | 无优势，不建议自建 |

## 缅因猫 gpt52 独立评审（第一轮）

### 核心判断

> **CVO 的担心是对的，讨论已经有跑偏迹象。F169 应该收缩为 MemoryHub 的费曼式知识导览与验证模式，不是学习管理系统。**

### 定位结论

费曼猫 = **知识工程的交互式验证器**：验证层 + 消费层，不是学习管理系统。

两个验证目标：
1. 用户能不能通过现有知识被讲明白
2. 猫能不能用现有 evidence 稳定讲明白

如果讲不明白 → 知识工程动作（补 docs、改 summary、补 relation、标 conflict），不是学习管理动作。

### MVP 边界（gpt52 第一轮版）

**包含：**
1. Evidence-grounded Explain（按 authority 标注来源，无证据就说缺口）
2. Teach-back Check（1-3 个理解校准问题，不做长期分数）
3. Explore / 导览（知识路线，如"F102 → F163 → F152 → F100"）
4. Gap / Correction 反哺（走现有 retain-memory → MarkerQueue → Feed）
5. Session 总结（已讲内容、仍不清楚的问题、已提交候选数）

**明确不做：** 错题本、长期学习进度、间隔重复、专用 Quiz DB、新 MCP 工具、专用 thread 游戏化 UI、自适应学习模型。

---

## 第四轮：知识图谱方向（CVO 发起）

### CVO 提出知识图谱可视化

CVO："我们要不要构建知识图谱？我们可以结构化的呈现知识，比如协作系统 | 记忆系统 | xxx"

随后确认方向：
> "用户打开 memoryhub，有一个地方能看到现在的知识图谱，里面分了模块（等于是 evidence 另一种呈现？），进入模块，可以费曼式导览。"

### 基础设施盘点

**已有的图数据：**
1. `edges` 表：`(from_anchor, to_anchor, relation)` — 5 种关系（evolved_from / blocked_by / related / supersedes / invalidates）
2. `evidence_docs` 表：anchor、kind、authority、status、summary 等丰富元数据
3. Feature frontmatter `topics` 字段（如 `[memory, knowledge-engineering]`）——**但未存入 evidence_docs**
4. `@xyflow/react` + `@dagrejs/dagre` 已安装（Mission Control 的 DependencyGraphTab 已在用）

**关键 Gap：**
- edges 仅在 IndexBuilder rebuild 时从 `related_features` frontmatter 生成 → 大量 evidence 无显式 edges
- topics 未入 evidence_docs → 无法按主题查询/聚类
- 无 graph API endpoint → 前端无法获取子图
- 无模块/聚类概念 → 用户看到扁平搜索结果，不是结构化知识地图

### 架构提案：两层模型

```
Layer 1: 知识图谱（结构层）
  Topic Modules (主题模块)
  ├── 记忆系统 [memory, knowledge-eng]
  │   ├── F102 (存储基座) ──related── F163
  │   ├── F163 (生命周期) ──evolved── F152
  │   ├── F152 (出征记忆)
  │   └── F100 (自进化)
  ├── 协作系统 [a2a, collaboration]
  ├── 游戏系统 [game, mode]
  └── 基础设施 [infrastructure, runtime]

Layer 2: 费曼导览（交互层）
  用户点击"记忆系统"模块
  → 猫沿 edges 路径导览：F102 → F163 → F152
  → 每个节点：evidence-grounded explain
  → 关键节点：teach-back check
  → 发现 gap → retain-memory → Feed
```

### 缅因猫 gpt52 第二轮评审结论

**总判断**：方向正确，但 MVP 必须收紧成"人工策划知识地图 + 显式边图谱 + 费曼式导览"。

**Q1 Topic Module** → **B：手工配置**。模块是产品叙事不是数据分类，自动聚类是过度工程。事实校正：frontmatter topics 已被 CatCafeScanner 合进 `keywords`，但混了 section heading，不能当干净 taxonomy。MVP 不需要 schema migration，只需 `docs/knowledge-map.yaml`。

**Q2 Graph 粒度** → **混合渐进，首屏 feature 级**。图展示骨架（feature/decision），列表展示细节（lesson/research/discussion 做 supporting evidence）。evidence 级全量图太密且大量节点无边。

**Q3 隐式 edges** → **硬拒绝**。同 topic 只说明"同架子上"，不说明"有关系"。区分三类：显式边（画线）、模块归属（分组）、建议边（进 Feed 审核，不进正式图）。图谱最怕"看起来很聪明但边不可信"。

**Q4 费曼导览入口** → **Explore 内嵌导览**，不要专用 thread。专用 thread 把心智拉向 LMS，也扩大工程面���等场景成熟再考虑。

**Q5 知识工程范畴** → **是**。四个跑偏红线：自动聚类→图谱算法项目、隐式边→信任污染、thread+错题本→LMS、导览脱离 authority→普通 chatbot。

---

## 开放问题状态

| 编号 | 问题 | 状态 | 结论 |
|------|------|------|------|
| OQ-1 | Quiz 记录怎么存？ | 已收敛 | MVP 不持久化学习者状态。走 Feed 反哺。Session 总结即"记录" |
| OQ-2 | 费曼猫定位 | 已收敛 | 验证层 + 消费层 = 交互式知识验证器 |
| OQ-3 | 入口方案 | 已收敛 | MemoryHub Explore tab 内嵌导览，不创建专用 thread |
| OQ-4 | Quiz 题型设计 | 降级 | MVP 不做独立 Quiz 引擎，Teach-back check 足够 |
| OQ-5 | 间隔重复 | 已收敛 | 不自建。后续可做 Anki 导出 |
| OQ-6 | MVP 边界 | 已收敛 | 知识地图 + 图谱 API + Explore tab + 导览 v0 |
| OQ-7 | Module 来源 | 已收敛 | 手工配置（knowledge-map.yaml），不做自动聚类 |

## 三猫共识 MVP

三猫（布偶猫 + 缅因猫 gpt52 x2 轮）在所有关键问题上达成一致。

### MVP 包含的 4 件事

1. **Knowledge Map 配置** — `docs/knowledge-map.yaml`，手工定义 4-6 个模块（记忆系统、协作系统、出征、自进化、基础设施、产品/Hub），每模块指定 entry anchor + 成员 anchors + 关联 keywords。

2. **Graph API（只读）** — `GET /api/evidence/graph?module=memory`，返回：module metadata / nodes（feature+decision）/ explicit edges only / supporting evidence 列表。不做自动聚类，不做隐式边。

3. **MemoryHub Explore Tab** — 顶层模块卡片（grid）→ 模块详情：feature 级主图（@xyflow/react + dagre）+ supporting evidence 列表 + 节点详情抽屉。图上只画 edges 表的显式边。

4. **费曼导览 v0** — 模块详情页"开始导览"按钮，Explore 内触发：猫沿模块 anchors 讲解（每论断带 evidence anchor）→ Teach-back check → Gap/correction 生成 Feed-ready candidate → Session summary。

### 明确不做

自动聚类 | topics schema migration | evidence 级全量图 | 隐式 edges 写库 | 专用 thread | Quiz 引擎 | 错题本/进度 | 新 MCP 工具 | 间隔重复 | 自适应学习模型

### MVP 验收标准

- CVO 用它学完某个主题后能讲出清晰架构链
- 过程中发现至少 N 个真实知识 gap
- gap 能进入 Feed 并推动 docs 改善
- 猫不 sycophancy，能根据 evidence 站住或承认无证据
- 产品叙事：把 MemoryHub 从"搜索工具"升级成"知识地图 + 可信导览"

### 跑偏红线

| 行为 | 意味着 |
|------|--------|
| 开始做自动聚类模块 | 变成图谱算法项目 |
| 隐式关系写入 edges | 图谱可信度下降 |
| 加专用 thread + 错题本 + 进度 | 变成 LMS |
| 导览脱离 authority/evidence | 变成普通 chatbot |

## 关键约束（已确认）

| 约束 | 来源 | 影响 |
|------|------|------|
| 不自造沉淀库 | F100 KD-4 | 反哺走 Feed，不建新库 |
| 知识过期由冲突驱动 | F163 KD-5 | 费曼猫不自动失效旧知识 |
| 外部知识 fail-closed | F152 KD-3 | 跨项目场景默认不回流全局层 |
| 所有能力可开关 | F163 KD-9 | Skill 天然可开关 |
| depth=raw 仅 lexical | F102 AC-K3 | 费曼猫用 summary + hybrid |
| always_on 仅限 constitutional | F163 KD-7 | 费曼猫 prompt 不进 always_on |
| 沉淀过三问（复用+非显然+衰减） | F100 KD-3 | 反哺只标记，不自动沉淀 |

## 第五轮：反哺机制技术审视

### Marker 系统现状（代码事实）

- `MarkerQueue` 存储：id / content(string) / source / status / targetKind / createdAt
- `retain-memory` callback schema 接受 `tags` + `metadata: Record<string,string>`，但 handler 只提取 content，丢掉 metadata
- 自动提取的 candidate 原始有 kind/title/claim/why_durable/evidence/relatedAnchors/confidence，但入 marker 时拼成 `[kind] title: claim` 字符串
- Feed UI 只按 `[decision|lesson|method]` 前缀解析，无结构化字段

### 反哺 Gap

费曼反哺需要的 structured metadata（feynman_type / module / replay_question / evidence_anchors）在当前 marker 系统无落地位置。

**方案 A：纯文本反哺（能用但不可追踪）**
把 feynman context 塞进 content 字符串。人工审核 Feed 可用，但无法程序化追踪 replay、无法按 feynman_type 过滤、无法做模块统计。

**方案 B：扩展 marker metadata（~20 行改动）**
在 callback handler 传 metadata 到 MarkerQueue → Marker interface 加 metadata 字段 → YAML 序列化写出。代价小，但让 replay_question 和 feynman_type 有了结构化锚点。

**待 CVO 决策。** 布偶猫倾向 B。

### Replay verdict（三猫修正共识，CVO 已确认 2026-04-22）

gpt52 主动修正了之前「四步缺一不可」的立场。CVO 质疑成立：纯手动 replay 没有 owner、没有系统提醒、提问人/补文档人/验证人分离，现实中不会发生。

**修正结论：replay 是验证增强，不是 MVP 启动飞轮的前置条件。**

去掉 replay 后飞轮仍然能转（discovery-to-improvement flywheel）：

```
MVP 闭环（Phase A）：
导览暴露 gap → Feed candidate → approve → docs 改进 → rebuild → 后续使用受益

Phase B 验证闭环：
保存 replay_question → rebuild 后标记 verification_due
→ 下次模块导览时提示"有 N 个待验证 gap" → 一键 replay
→ 结果进入质量指标（gap per session 趋势）
```

MVP 做法：marker metadata 里保留 `replay_question` 字段（只存不跑），Phase B 做 opportunistic replay + metric proxy。

### knowledge-map 主题投递（LLM Wiki 调研结论）

LLM Wiki compile 机制：混合模式 — 用户定义初始 schema/conventions，LLM 在 compile 时动态决定每个 source 归入哪个 page。新 source 加入后 LLM 读取内容、提取概念，更新已有 page 或创建新 page。

对 Cat Cafe 的启示：knowledge-map.yaml 定义初始模块框架（CVO 手动维护），新 feature 的模块归属让猫建议。MVP 不需要自助加主题能力（新 feature ~1-2/周，手动加一行 YAML 不算负担）。Explore tab 显示「未归类 evidence」区域提醒 CVO。Phase B 做 IndexBuilder 自动检测未归类 anchor → 建议模块 → Feed candidate → CVO 确认。

### Phase A 分两步

```
Phase A-1：knowledge-map.yaml + Graph API + Explore tab（纯展示，无交互风险）
Phase A-2：费曼导览 SKILL.md + Explore 内"开始导览" + marker 反哺（replay_question 只存不跑）
```

## 第六轮：导览呈现方式与交互机制

### 导览呈现方式

布偶猫初始建议方案 A（现有 thread + SKILL.md），CVO 反馈倾向专属 thread：上下文不污染 + 系统提示词统一注入。

审视后同意 CVO 判断。专属 thread 实现量（~260 LOC）和纯 SKILL.md（~150 LOC）差距不大，但可靠性差很多——协议是 system prompt 物理注入而非靠猫记住 skill。

**方案：复用游戏 thread 模式（projectPath = feynman/{module}）**

| 组件 | 工作量 | 说明 |
|------|--------|------|
| FeynmanPromptSection.ts | ~100 LOC | 检测 feynman thread → 注入模块上下文 + 费曼协议到 system prompt |
| POST /api/feynman/start | ~50 LOC | 创建专属 thread + 写系统消息 |
| SystemPromptBuilder 集成 | ~20 LOC | 类似 guide 注入位置 |
| Thread 列表过滤 | ~10 LOC | feynman/ 前缀和 games/ 同理 |
| feynman-cat/SKILL.md | ~50 LOC | 启动入口（识别意图 → 创建 thread → 引导切换） |
| knowledge-map.yaml | ~30 LOC | 模块配置 |

SKILL.md 角色从"协议载体"变为"启动入口"。协议本体在 FeynmanPromptSection.ts。

### CVO 确认的设计决策（2026-04-22）

**专属 thread**：✅ CVO 确认。上下文不污染 + 系统提示词统一注入。

**MCP Tools**：
- `start_feynman` — 不需要 MCP tool，由 UI 按钮直接调 API
- `feynman_complete` — MVP 不做。猫自然收尾即可

**Session 结束**：MVP 用方案 1+2 混合（不显式结束，猫在协议里有收尾意识——讲完或用户说"差不多了"→ 输出 delta report。Thread 持久保留可随时继续。Phase B 按需加 UI 结束按钮）。

**导览内容来源**：
- SQLite evidence_docs = 检索入口（search_evidence 找方向）
- 项目 docs/*.md = 真相源（补充细节，标注来源）
- 和猫日常回答问题的模式一致，不需要新数据源

**设计范围（vs Guide 系统对比）**：

| 要做 | 不做 |
|------|------|
| FeynmanSessionState schema | 独立状态机 |
| FeynmanPromptSection（system prompt 注入） | 前端 overlay / InteractiveBlock |
| POST /api/feynman/start | Flow YAML 步骤定义 |
| knowledge-map.yaml schema | 独立 session 存储（用 thread metadata） |
| Marker metadata 扩展 | Guide 级 lifecycle service |

费曼是对话驱动不是 UI 驱动，实现量约为 guide 系统的 1/3。

### 费曼导览协议（FeynmanPromptSection 内核）

1. **加载模块上下文**：读 knowledge-map.yaml → search_evidence(scope=docs, anchors) → 读 docs/*.md 补细节
2. **Evidence-grounded 讲解**：沿 edges 路径讲解，每个论断标注 anchor + authority
3. **Teach-back 检查**：关键节点后问用户复述，比对 evidence 判断理解准确度
4. **Gap 检测**（4 触发器）：No Evidence / Low Authority / Contradiction / User Correction
5. **Session 收尾**：Feynman Delta Report（覆盖 anchors、gaps、Feed candidates、下次复查建议）

抗 sycophancy 护栏：validated evidence 不因用户质疑改口，用户新信息标为 correction candidate。

## 第七轮：Design Gate（gpt52 review 完成 2026-04-22）

### 提交 Design Gate 的完整方案摘要

**产品目标**：知识图谱可视化 + 费曼式对话导览，让用户看到知识全貌并通过对话发现知识 gap。

**MVP 交付物**：
1. `docs/knowledge-map.yaml` — 手工模块配置
2. `GET /api/evidence/graph?module=X` — 只读 graph API
3. MemoryHub Explore tab — 模块卡片 → feature 级图 + evidence 列表
4. `POST /api/feynman/start` — 创建专属费曼 thread
5. `FeynmanPromptSection.ts` — system prompt 注入费曼协议
6. `feynman-cat/SKILL.md` — 启动入口
7. Marker metadata 扩展（~20 行）— 支撑结构化 gap 提交

**不做**：
- MCP tools（start/complete）
- UI 结束按钮
- replay 执行（只存 replay_question）
- 自动主题投递
- 独立状态机 / lifecycle service
- 前端 overlay

**飞轮**：discovery-to-improvement（导览暴露 gap → Feed → 补 docs → rebuild → 后续受益）

**Phase B 预留**：
- Opportunistic replay + metric proxy
- UI 结束按钮 + session 统计
- IndexBuilder 自动检测未归类 anchor
- MCP tools（结构化追踪）

### Design Gate 结果

**条件放行。** gpt52 发现 1 个 blocking + 3 个 P2 + 1 个 P3，全部采纳。

**P1（blocking）**：`projectPath=feynman/{module}` 不能用——现有 invocation 会把它当工作目录（只特判了 `games/`）。
→ **修正**：用 `thread.feynmanState`（和 guideState 同级的 thread metadata），projectPath 保持 `default`。

**P2**：SKILL.md 不能创建 thread（没有对应 MCP tool）。
→ **修正**：UI button 是唯一 start 入口。SKILL.md 只引导用户去 Explore 点击。

**P2**：FeynmanPromptSection 必须走 dynamic InvocationContext，不能只靠 thread title。
→ **修正**：route 层每次 invocation 读取 feynmanState → 传入 InvocationContext → SystemPromptBuilder 注入。

**P2**：Marker metadata 扩展 ~20 LOC 低估，实际需 60-120 LOC（含 schema 调整 + 测试）。
→ **修正**：接受修正估算。

**P3**：Delta report 需要明确触发边界。
→ **修正**：用户说"差不多了"或 anchors 全覆盖时输出，不是每轮输出。

**工作量修正**：Phase A-2 从 ~260 LOC 修正为 **450-700 LOC 含测试**。

## 第八轮：最终设计确认（CVO 通过 2026-04-22）

### UI 入口

MVP：MemoryHub Explore tab → 模块卡片上的"开始导览"按钮 → 创建/打开 feynman thread → 跳转 chat hub。
Phase B：可加 `/feynman` 命令（复用 `/game` 的 detectMenuTrigger 模式）。

### Thread 唯一性

模块唯一。每个模块最多一个活跃 feynman thread。再次进入同模块 → 打开已有 thread。不同模块各有独立 thread。

```
POST /api/feynman/start { module: "memory" }
→ 查找 feynmanState.module === "memory" 的现有 thread
→ 找到 → 返回已有 threadId
→ 没找到 → 创建新 thread → 返回新 threadId
```

### 系统提示词（FeynmanPromptSection 三层结构）

**层 1：动态模块上下文**（每次 invocation 从 knowledge-map.yaml + evidence_docs 读取）
- 模块名、包含的 anchors、每个 anchor 的 authority + summary
- 关系链（edges）
- authority 不足的 anchor 标注提醒

**层 2：静态教学协议**
- 沿关系链讲解，标注来源 [anchor + authority]
- 需要细节读 docs 原文
- 无 evidence 明确说"我没有记录"
- Teach-back：每个核心 feature 后问用户复述
- Gap 检测 4 触发器 → retain-memory + metadata

**层 3：静态护栏**
- 抗 sycophancy：validated evidence 不因质疑改口
- Authority 分层措辞
- Delta Report 触发条件（用户说"差不多了"或 anchors 全覆盖）

### 亮点总结

**一句话：猫教你的过程就是知识库自我修复的过程。Teaching is the best debugging.**

1. 消费即审计——每次学习自动暴露知识 gap
2. Authority 分层教学——猫诚实说"我不知道"，不 sycophancy
3. 导览产出 Knowledge Delta——学习对话变成知识工程事件
4. 反哺走审核流——gap → Feed → 补 docs → rebuild → 下次受益
5. Cat Cafe 自身的 dogfood 闭环——开发产生知识 → 导览消费 → 消费暴露缺口 → 改进

## 讨论完成，进入 F169 spec
