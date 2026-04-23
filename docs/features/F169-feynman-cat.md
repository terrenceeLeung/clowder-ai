---
feature_ids: [F169]
related_features: [F102, F163, F152, F100, F155]
topics: [memory, knowledge-engineering, feynman, teaching, visualization]
doc_kind: spec
created: 2026-04-22
---

# F169: Feynman Cat — 费曼式知识导览与知识图谱可视化

> **Status**: planning | **Owner**: Ragdoll | **Priority**: P1

## Why

### 核心问题

Cat Cafe 有四套记忆 feature（F102 存储、F163 熵减、F152 出征、F100 自进化），沉淀了丰富的 evidence（docs、decisions、lessons、research），但**没有消费层**。知识只能通过 search_evidence 被动检索，无法：

1. 看到知识的全貌和结构（哪些模块、模块之间什么关系）
2. 系统性地学习一个模块的知识
3. 在学习过程中发现知识库的盲区并反哺改进

### team experience（需求讨论 2026-04-22，完整语境）

**CVO 的三个目标**：
> 1. 增强 Cat Cafe 的知识工程——把 evidence 从"能搜到"升级为"能被可信导览和反哺改进"
> 2. 费曼式教学——猫教用户项目知识，同时发现知识盲区
> 3. CVO 自己需要深入理解 Cat Cafe 全貌（面试准备）

**核心洞察**（三猫讨论收敛）：
> "猫教你的过程就是知识库自我修复的过程。Teaching is the best debugging."

### 与现有 Feature 的关系

```
F102（done）：记忆怎么存和搜 — 基础设施（evidence_docs + edges + FTS + 向量）
F163（in-progress）：记忆怎么保持精准 — 三轴元数据 + authority 分层
F152（in-progress）：记忆怎么跨项目携带 — 出征 + 经验回流
F100（in-progress）：猫怎么自我进化 — 三模式 + 五级阶梯
F169（本 feature）：知识怎么被消费和反哺 — 图谱可视化 + 费曼导览
```

F169 是记忆系统的**消费层**，依赖 F102 的存储检索 + F163 的 authority 分层。

## What

### 两层模型

**Layer 1：知识图谱（结构层）**
- `docs/knowledge-map.yaml`：手工模块配置，定义模块名 + 包含的 anchors
- Graph API：读取 knowledge-map + evidence_docs + edges，返回模块级子图
- MemoryHub Explore tab：模块卡片 → feature 级图 + evidence 列表

**Layer 2：费曼导览（交互层）**
- 专属 feynman thread：模块唯一，system prompt 物理注入费曼协议
- FeynmanPromptSection：三层系统提示词（动态模块上下文 + 静态教学协议 + 静态护栏）
- Marker metadata 扩展：结构化 gap 提交（feynman_type / module / replay_question）

### 飞轮：discovery-to-improvement

```
导览暴露 gap（分钟级）
→ Feed candidate + metadata（即时）
→ CVO 审核 approve（天级）
→ 猫或人补 docs（天级）
→ rebuild index（分钟级）
→ 后续导览受益
```

MVP 证明：系统能把讲不清的问题转成可审核、可沉淀的知识改进。

## How

### Phase A-1：知识图谱（结构层）

| AC | 描述 |
|----|------|
| AC-A1-1 | `docs/knowledge-map.yaml` 创建，8 个核心模块（记忆、协作、游戏、消息、引导、外部连接、基础设施、身份治理），每个模块定义 name + anchors |
| AC-A1-2 | `GET /api/evidence/graph?module=X` 返回模块的 feature 节点 + edges + evidence 列表（含 authority） |
| AC-A1-3 | MemoryHub 新增 Explore tab，展示模块卡片（名称 + anchor 数 + evidence 数） |
| AC-A1-4 | 点击模块卡片展示 feature 级图（@xyflow/react + dagre）+ evidence 列表 |

### Phase A-2：费曼导览（交互层）

| AC | 描述 |
|----|------|
| AC-A2-1 | `POST /api/feynman/start` 创建专属 thread，初始化 `feynmanState` 到 thread metadata |
| AC-A2-2 | feynmanState schema：`{ v:1, module, anchors, status:'active'\|'completed', startedAt }` 存在 thread metadata |
| AC-A2-3 | FeynmanPromptSection 实现：检测 feynmanState → 注入三层系统提示词（模块上下文 + 教学协议 + 护栏） |
| AC-A2-4 | SystemPromptBuilder 集成：route 层读取 feynmanState → 传入 InvocationContext → 每次 invocation 动态注入 |
| AC-A2-5 | 模块唯一：同模块再次 start → 返回已有 threadId |
| AC-A2-6 | Explore 模块卡片上的"开始导览"按钮 → 调 start API → 跳转 feynman thread |
| AC-A2-7 | Marker metadata 扩展：callback handler 透传 metadata → Marker interface 加 metadata 字段 → YAML 序列化 |
| AC-A2-8 | 费曼导览能产出结构化 gap：retain-memory 提交含 `{ feynman_type, module, replay_question, evidence_anchors }` |
| AC-A2-9 | 猫讲完或用户说"差不多了"时输出 Delta Report（覆盖 anchors、gaps、Feed candidates、下次复查建议） |
| AC-A2-10 | 抗 sycophancy：用户质疑 validated evidence → 猫重检索后站住；用户新信息 → 标为 correction candidate |

### Phase A-1.5：knowledge-map-maintain skill

| AC | 描述 |
|----|------|
| AC-A1.5-1 | `knowledge-map-maintain` skill：手动触发，扫描 evidence_docs 对比 knowledge-map.yaml 找出未分类 anchor |
| AC-A1.5-2 | LLM 基于 module.name + module.description + 已有 anchors 上下文，对未分类文档做模块匹配 |
| AC-A1.5-3 | 可归入现有模块的 → 追加建议；不属于任何模块的 → 标记「建议新模块」，由 CVO 决策 |
| AC-A1.5-4 | knowledge-map.yaml 每个 module 增加 `description` 字段，作为 LLM 分类的语义锚点 |
| AC-A1.5-5 | 分类结果通过 rich block 展示供 review，确认后更新 knowledge-map.yaml 并 commit |

**设计要点**（CVO 2026-04-23 确认）：
- 触发不做自动化（maintainer 手动调用），分类做自动化（LLM 辅助）
- LLM 用当前 session 模型（sonnet 即可），不需要额外 apikey
- 新模块创建需 CVO 审批

### Phase B（预留，不在 MVP）

- Opportunistic replay：下次同模块导览提示"有 N 个待验证 gap"
- Metric proxy：按 module 统计 gap per session 趋势
- UI 结束按钮 + session 统计
- `/feynman` 命令（输入框快捷入口）
- MCP tools（start_feynman / feynman_complete）
- Session 重置功能

## Design Decisions

### DD-1：专属 thread 而非共享 thread

导览使用专属 feynman thread，不在现有 thread 中混用 SKILL.md。

**Why**：CVO 确认。上下文不污染 + 系统提示词统一注入。协议通过 system prompt 物理注入而非靠猫记住 skill，可靠性更高。

### DD-2：feynmanState 而非 projectPath

使用 `thread.feynmanState` 存储费曼状态，不用 `projectPath=feynman/{module}`。

**Why**：Design Gate 发现 projectPath 会被 invocation 当工作目录（只特判了 `games/`），feynman/{module} 会导致 CLI cwd 异常。feynmanState 和 guideState/bootcampState 同级，不侵入 projectPath 语义。

### DD-3：不做 Guide 级基础设施

不建独立状态机、lifecycle service、前端 overlay、flow YAML。

**Why**：Guide 是 UI 驱动的线性 wizard（配置流程，有 advance types：click/visible/input/confirm）。费曼是对话驱动的探索式教学。交互模式根本不同，不需要 Guide 的 UI 基础设施。

### DD-4：MVP 不做 replay 执行

replay_question 存入 marker metadata 但不执行验证。MVP 飞轮是 discovery-to-improvement（弱闭环），Phase B 做 improvement-to-verification（强闭环）。

**Why**：三猫讨论 + CVO 确认。纯手动 replay 没有 owner、没有系统提醒、提问人/补文档人/验证人分离，现实中不会发生。

### DD-5：knowledge-map.yaml 手动触发 + LLM 辅助分类

模块定义由 CVO 手工维护，anchor 分类由 `knowledge-map-maintain` skill 辅助。触发不做自动化，分类做自动化。

**Why**：模块是产品叙事不是数据分类，新增模块需 CVO 审批。但 anchor 归类是机械劳动，LLM 基于模块 description + 已有 anchors 上下文即可准确匹配。Maintainer 决定「何时整理书架」，LLM 帮忙「把书放对位置」。（CVO 2026-04-23 确认，替代原纯手工方案）

### DD-6：导览内容来源双层

evidence_docs 做检索入口（找方向），docs/*.md 做真相源（补细节）。

**Why**：和猫日常回答问题的模式一致，不需要新数据源。gpt52 建议 FeynmanPromptSection 预加载 anchors/authority/summary，不能只给抽象搜索指令。

## Constraints

| 约束 | 来源 | 对 F169 的含义 |
|------|------|---------------|
| 猫不自主删除/合并知识 | F163 KD-1 | gap/correction 进 Feed 审核，不直接改 docs |
| 知识过期由冲突驱动 | F163 KD-5 | 费曼猫不自动失效旧知识 |
| 外部知识 fail-closed | F152 KD-3 | 跨项目场景默认不回流全局层 |
| 所有能力可开关 | F163 KD-9 | Skill 天然可开关 |
| always_on 仅限 constitutional | F163 KD-7 | 费曼猫 prompt 不进 always_on |
| 沉淀过三问 | F100 KD-3 | 反哺只标记，不自动沉淀 |
| 文件大小 ≤350 行 | CLAUDE.md | FeynmanPromptSection 等文件遵守 |

## Estimation

| 组件 | 估算 |
|------|------|
| Phase A-1（Graph API + Explore tab + knowledge-map） | 300-500 LOC |
| Phase A-2（Feynman thread + FeynmanPromptSection + Marker metadata） | 450-700 LOC |
| **总计（含测试）** | **750-1200 LOC** |

## Discussion Trail

完整讨论记录见 `docs/plans/feynman-cat-discussion.md`（8 轮讨论，三猫 + CVO 共创）。
