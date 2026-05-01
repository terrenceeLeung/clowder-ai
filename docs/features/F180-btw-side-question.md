---
feature_ids: [F180]
related_features: [F108]
topics: [ux, side-channel, lightweight-query]
doc_kind: spec
created: 2026-05-01
---

# F180: BTW Side Question — Thread 内轻量旁路提问

> **Status**: spec | **Owner**: 布偶猫 (Opus 4.6) | **Priority**: P1

## Why

铲屎官在讨论 F179 时需要查 F129/F059 的知识，只能开新 thread，打断工作流。Claude Code 的 `/btw` 提供了"不离开当前对话、顺手问一个小问题"的范式。Cat Cafe 复刻这个语义，但适配多猫架构：固定猫、轻量上下文、知识注入、不污染主线。

铲屎官原话：
> "我在聊方案的时候，比如聊 F179，里面遇到了 F129、F059 的知识，我想去问，只能开新的 thread，好麻烦。"
> "btw 就是很轻量的，甚至不应该可以多猫 at、mention。就是问一个固定的猫，轻量的问题。"

## What

### Phase A: 核心旁路通道

**命令**：`/btw <question>`
- 不解析 `@mention`，问题里的 `@codex` 当普通文本
- 目标猫 = 当前 thread 的 primary/preferred cat（无则系统 default）

**上下文拼装**（超轻）：
- thread memory summary
- 最近 5 轮消息
- 自动识别 `F\d{3}` → 注入 1 个 feature doc 摘要 + 1 次 search_evidence（top 3）
- 注入 side-question prompt 片段：禁 quality-gate / 不更新 BACKLOG / 不写决策

**约束**：
- 禁工具（disableMcp + disableTools）
- 短超时（30s）
- 不落 MessageStore、不进 digest/decisions/session chain
- 禁嵌套（深度=1）
- 回复过长或问题过复杂 → 提示"这不适合 btw，请走正常消息"

**API**：新旁路 endpoint，不走 `/api/messages`，不触发 queue/active invocation

**前端**：`/btw` 本地消费，显示 loading → 替换为结果，带 🔖 BTW 视觉标记（灰底卡片）

## Acceptance Criteria

### Phase A（核心旁路通道）
- [ ] AC-A1: Hub 输入 `/btw F129 push 做到哪了？` → 当前猫回答，带 BTW 视觉标记
- [ ] AC-A2: btw 回答不出现在 thread 消息历史（刷新后消失）
- [ ] AC-A3: btw 回答不进入 thread memory summary / decisions / digest
- [ ] AC-A4: 问题含 `F\d{3}` 时自动注入对应 feature doc 摘要 + evidence
- [ ] AC-A5: btw 内再输入 `/btw` 被拒绝（深度=1）
- [ ] AC-A6: btw 请求超时 30s 后优雅降级，不影响主线

## Dependencies

- **Related**: F108（Side-Dispatch Concurrent Invocation）— 概念相关但实现独立，btw 比 F108 轻量得多

## Risk

| 风险 | 缓解 |
|------|------|
| side agent 的 token usage 混入主线计费 | 独立计费路径，btw 调用标记 `ephemeral: true` |
| feature doc 注入撑大上下文，"轻量"变"重量" | 硬预算：最多 1 doc 摘要 + 3 条 evidence，超过降级 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不支持多猫 @mention，固定当前 thread 猫 | 防止 btw 退化为轻量版 post_message，重踩 queue/governance | 2026-05-01 |
| KD-2 | 不落 MessageStore | 每个 aggregator 都要尊重 filter 太脏，不落库失败成本低（再问一次） | 2026-05-01 |
| KD-3 | F\d{3} 自动注入但预算卡死 | 这是比 Claude Code 多出来的真正价值，但不能让注入把轻量撑成重量 | 2026-05-01 |
| KD-4 | 禁嵌套（深度=1） | 简化心智，btw 是旁路减负不是可递归主线 | 2026-05-01 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-01 | 立项（三猫讨论收敛） |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F108-side-dispatch-concurrent-invocation.md` | 并发 invocation 基础设施（概念相关） |
| **Reference** | Claude Code `src/commands/btw.tsx` + `forkedAgent.ts` | 原版实现参考 |
