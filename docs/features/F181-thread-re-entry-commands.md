---
feature_ids: [F181]
related_features: []
topics: [connector, commands, history, thread, ux, im]
doc_kind: spec
created: 2026-05-02
---

# F181: Thread Re-entry Commands (/history)

> **Status**: in-progress | **Owner**: 布偶猫 (Opus 4.6) | **Priority**: P1

## Why

铲屎官在 IM 工具上并发指挥多个 thread 时，有两个认知断裂：
1. 切回旧线程时，看不到猫之前的回复（IM 推送淹没在消息流里）
2. 切到新线程时，忘了之前在这个线程说过什么

铲屎官原话：
> "我有一个诉求，我发现我在 IM 工具上和猫猫对话时，经常会写 threads 并发指挥。比如我在 thread a 发了一句话，我可能没等待 thread a 回复推送，我就切到 thread b 发别的。这里有两个问题，1. 我切到新线程 会忘记之前说过什么，或者猫猫回答了什么。2. 我切回原线程，先看上一次发送回复了什么，看不见。"

## What

在 ConnectorCommandLayer 增加 `/history` connector command，走现有 slash command 旁路（不进 invocation queue），以**对话轮次（Round）**为单位展示历史。

### 对话轮次（Round）定义

一个 Round = 一条用户消息 + 它触发的所有猫回复（直到下一条用户消息）。

```
Round N:   [用户消息] → [猫A回复] [猫B回复] [猫A补充...]
Round N+1: [用户消息] → [猫回复...]
```

多猫场景：用户发一条消息后，宪宪回了、砚砚也回了、A2A 互传——全属同一个 Round。

### `/history` — 按轮次查看本线程对话历史

- 触发：用户在 IM 输入 `/history` 或 `/history N`（N = 轮次数）
- 默认 `/history` = `/history 1` = 最新一轮：最近一次猫猫们的全部答复 + 触发它的用户消息
- `/history 2` = 最近 2 轮，以此类推
- 上限：N ≤ 5
- 输出格式：按时间排列，每条含发言者身份 + 时间 + 内容摘要（超长截断至 200 字）
- 边界：
  - 线程为空 → "本线程还没有消息"
  - 正在流式输出的消息（deliveryStatus='queued'）不包含在结果中
  - 最后一轮只有用户消息没有猫回复（猫还在处理中）→ 显示用户消息 + "⏳ 猫猫正在回复…"

### 实现

- **Round 切分算法**：从 MessageStore 倒序遍历消息，遇到用户消息（catId === null && !source）则标记 Round 边界，收集 N 个 Round
- **不依赖 ThreadReadStateStore**：纯读 MessageStore，零基建依赖

### 并发安全

命令走 `ConnectorCommandLayer`（line 229 `startsWith('/')` 拦截），不进 `QueueProcessor` 的 invocation queue。与猫的流式输出完全并行：

```
Path A (command):    /history → ConnectorRouter → ConnectorCommandLayer → 读 MessageStore → 返回
Path B (invocation): 用户消息 → InvocationQueue → QueueProcessor → 猫 LLM → 流式输出
两条路径在 ConnectorRouter 分叉，互不阻塞。
```

### 注册

- `core-commands.ts`：注册 `/history`，category='connector', surface='connector'
- `ConnectorCommandLayer`：
  - 新增 `handleHistory(connectorId, externalChatId, userId, args)` handler
  - deps 扩展：需要 `messageStore: IMessageStore`

## Acceptance Criteria

- [x] AC-1: `/history` 默认返回最近 1 个 Round（用户消息 + 全部猫回复）
- [x] AC-2: `/history N` 支持 N=1~5，超出范围提示
- [x] AC-3: Round 切分正确：以用户消息为边界，多猫回复归入同一 Round
- [ ] AC-4: 正在流式输出的消息不包含在结果中
- [x] AC-5: 命令在猫流式输出期间可并行执行，不阻塞不被阻塞
- [x] AC-6: 有对应的单元测试
- [x] AC-7: 飞书 + 企微适配器正常渲染命令输出

## Dependencies

- 无硬依赖。纯读 MessageStore（已有）

## Risk

| 风险 | 缓解 |
|------|------|
| Round 切分在 A2A 复杂场景下边界不清 | 简单规则：catId === null && !source 的消息 = 用户消息 = Round 边界 |
| 长回复导致 IM 渲染超限 | 每条消息截断至 200 字，整体输出上限 |

## Open Questions

（无开放问题）

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走 ConnectorCommandLayer 旁路，不进 invocation queue | 用户查历史时往往猫正在输出，排队会导致"想看时看不了" | 2026-05-02 |
| KD-2 | 砍掉 `/unread`，只做 `/history` | IM 侧 read cursor 从不推进（只有 Hub 前端推），`/unread` 在纯 IM 场景下失效。`/history` 按轮次查看不依赖 cursor | 2026-05-02 |
| KD-3 | 以"对话轮次 Round"为单位，不以消息条数 | 对齐用户认知模型："我问了什么、猫答了什么"。比 N 条消息更直觉 | 2026-05-02 |
| KD-4 | 正在流式输出的消息排除在外 | 语义正确：history 是"已完成的对话"，正在进行的等它完成 | 2026-05-02 |
| KD-5 | 多猫讨论（opus-47 + gpt55 + sonnet）→ 铲屎官收敛为直线方案，四层架构降级为后续增强 | 急性痛点是"看不到回复"，不是跨线程认知外挂 | 2026-05-02 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | 立项。多猫讨论 → 铲屎官收敛 → 砍 /unread，/history 按轮次 |
| 2026-05-02 | /history connector command merged (PR #11). AC-1/2/3/5/6/7 ✅. AC-4 deferred. |
