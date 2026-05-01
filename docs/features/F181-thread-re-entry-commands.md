---
feature_ids: [F181]
related_features: [F069, F072]
topics: [connector, commands, unread, history, thread, ux, im]
doc_kind: spec
created: 2026-05-02
---

# F181: Thread Re-entry Commands (/unread + /history)

> **Status**: spec | **Owner**: 布偶猫 (Opus 4.6) | **Priority**: P1

## Why

铲屎官在 IM 工具上并发指挥多个 thread 时，有两个认知断裂：
1. 切回旧线程时，看不到猫之前的回复（IM 推送淹没在消息流里）
2. 切到新线程时，忘了之前在这个线程说过什么

铲屎官原话：
> "我有一个诉求，我发现我在 IM 工具上和猫猫对话时，经常会写 threads 并发指挥。比如我在 thread a 发了一句话，我可能没等待 thread a 回复推送，我就切到 thread b 发别的。这里有两个问题，1. 我切到新线程 会忘记之前说过什么，或者猫猫回答了什么。2. 我切回原线程，先看上一次发送回复了什么，看不见。"

现有基建已具备（F069 ThreadReadStateStore + MessageStore），缺的是用户侧触发入口。

## What

在 ConnectorCommandLayer 增加两个 connector command，走现有 slash command 旁路（不进 invocation queue），利用已有数据层实现。

### `/unread` — 查看本线程未读消息

- 触发：用户在 IM 输入 `/unread`
- 行为：读 `ThreadReadStateStore.get(userId, threadId)` 拿 read cursor → `MessageStore.getByThreadAfter(threadId, lastReadMessageId)` 取未读消息 → 渲染回 IM
- 输出格式：按时间排列，每条含发言者身份 + 时间 + 内容摘要（超长截断）
- 边界：
  - 无未读 → 返回 "本线程没有未读消息"
  - 未读过多（>10 条） → 只显示最近 10 条 + "还有 N 条更早的未读"
  - 正在流式输出的消息（deliveryStatus='queued'）不计入未读

### `/history` — 查看本线程最近历史

- 触发：用户在 IM 输入 `/history` 或 `/history N`（N = 条数，默认 5，最大 20）
- 行为：读 `MessageStore` 取当前线程最近 N 条已完成消息 → 渲染回 IM
- 输出格式：按时间排列，每条含发言者（用户/猫）+ 时间 + 内容摘要
- 边界：
  - 线程为空 → 返回 "本线程还没有消息"
  - 正在流式输出的消息不包含在结果中

### 并发安全

两个命令走 `ConnectorCommandLayer`（line 229 `startsWith('/')` 拦截），不进 `QueueProcessor` 的 invocation queue。与猫的流式输出完全并行：

```
Path A (command):    /unread → ConnectorRouter → ConnectorCommandLayer → 读 store → 返回
Path B (invocation): 用户消息 → InvocationQueue → QueueProcessor → 猫 LLM → 流式输出
两条路径在 ConnectorRouter 分叉，互不阻塞。
```

### 注册

- `core-commands.ts`：注册 `/unread` 和 `/history`，category='connector', surface='connector'
- `ConnectorCommandLayer`：
  - 新增 `handleUnread(connectorId, externalChatId, userId)` handler
  - 新增 `handleHistory(connectorId, externalChatId, userId, args)` handler
  - deps 扩展：需要 `readStateStore: IThreadReadStateStore` + `messageStore: IMessageStore`

## Acceptance Criteria

- [ ] AC-A1: `/unread` 在无未读时返回"无未读消息"提示
- [ ] AC-A2: `/unread` 正确返回 read cursor 之后的已完成消息，按时间排列
- [ ] AC-A3: `/unread` 不包含 deliveryStatus='queued' 的正在输出消息
- [ ] AC-A4: `/unread` 超过 10 条时截断并提示剩余数量
- [ ] AC-A5: `/history` 默认返回最近 5 条消息
- [ ] AC-A6: `/history N` 支持自定义条数（1-20）
- [ ] AC-A7: 两个命令在猫流式输出期间可并行执行，不阻塞不被阻塞
- [ ] AC-A8: 有对应的单元测试
- [ ] AC-A9: 飞书 + 企微适配器正常渲染命令输出

## Dependencies

- **Related**: F069（Thread Read State — 提供 read cursor 基建）
- **Related**: F072（Mark All Read — 同一套 read state，验证基建可用）

## Risk

| 风险 | 缓解 |
|------|------|
| MessageStore 缺少 getByThreadAfter 方法 | 检查现有接口，必要时扩展（F069 getUnreadSummaries 已有类似逻辑） |
| 未读消息过多导致 IM 渲染超限 | 硬限 10 条 + 截断提示 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `/unread` 执行后是否自动推进 read cursor（即看完就标已读）？ | ✅ 是，必须推进。IM 侧从无 cursor 推进逻辑，纯 IM 用户 cursor 永远为 null，不推进则功能无效 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走 ConnectorCommandLayer 旁路，不进 invocation queue | 用户查未读时往往猫正在输出，排队会导致"想看时看不了" | 2026-05-02 |
| KD-2 | 复用 F069 ThreadReadStateStore，不新建数据层 | 基建已有，零架构变更 | 2026-05-02 |
| KD-3 | 正在流式输出的消息（deliveryStatus='queued'）排除在外 | 语义正确："未读"="猫说完了但我没看到"，正在说的等它说完 | 2026-05-02 |
| KD-4 | 多猫讨论后收敛为直线方案（/unread+/history），四层架构降级为 P1/P2 | 铲屎官指出"绕路了"——急性痛点是看不到回复，不是跨线程认知外挂 | 2026-05-02 |
| KD-5 | `/unread` 必须自动推进 read cursor（ack 到返回的最后一条消息） | IM connector 从不调 read API，纯 IM 用户 cursor 永远为 null。不推进则 `/unread` 在 IM 场景下无效 | 2026-05-02 |
| KD-6 | cursor 为 null 时 `/unread` 降级为 `/history` 语义（显示最近 N 条） | F069 冷启动兜底把 null cursor 当"全部已读"，直接返回空不符合用户预期 | 2026-05-02 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | 立项。多猫讨论（opus-47 + gpt55 + sonnet）→ 铲屎官收敛为直线方案 |
