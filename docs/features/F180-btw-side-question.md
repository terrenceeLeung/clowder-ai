---
feature_ids: [F180]
related_features: [F108]
topics: [ux, side-channel, lightweight-query]
doc_kind: spec
created: 2026-05-01
---

# F180: BTW Side Question — Thread 内轻量旁路提问

> **Status**: in-progress | **Owner**: 布偶猫 (Opus 4.6) | **Priority**: P1

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

**上下文**：全量注入，不做额外截断
- 复用与主对话相同的上下文拼装策略（message history + thread memory）
- 系统 prompt 与主对话一致（自然命中 provider 侧 KV cache）

**工具策略：可读不可写，可查不可发**
- 只读 allowlist：`search_evidence`、`reflect`、`read_session_digest`、`get_thread_context`
- 禁止所有写入/协作类工具（post_message、create_task、hold_ball、multi_mention 等）
- 模型自行决定是否查询，不做预注入（去掉 F\d{3} 正则匹配 + evidence 预注入 hack）

**Agent Loop**：
- 1 次 agent loop（模型跑完就结束），用户视角 one-shot
- loop 内工具调用次数不限，30s timeout 兜底
- 不支持用户追问——需要深入讨论请走正常消息

**约束**：
- 短超时（30s）
- 不落 MessageStore、不进 digest/decisions/session chain
- 禁嵌套（深度=1）
- 回复过长或问题过复杂 → 提示"这不适合 btw，请走正常消息"

**API**：新旁路 endpoint `POST /api/btw`，不走 `/api/messages`，不触发 queue/active invocation

**前端**：`/btw` 本地消费，显示 loading → 替换为结果，带 🔖 BTW 视觉标记（灰底卡片）

## Acceptance Criteria

### Phase A（核心旁路通道）✅
- [x] AC-A1: Hub 输入 `/btw F129 push 做到哪了？` → 当前猫回答，带 BTW 视觉标记
- [x] AC-A2: btw 回答不出现在 thread 消息历史（刷新后消失）
- [x] AC-A3: btw 回答不进入 thread memory summary / decisions / digest
- [x] AC-A4: btw 可使用只读工具（search_evidence 等）查询知识，禁止写入类工具
- [x] AC-A5: btw 内再输入 `/btw` 被拒绝（深度=1）
- [x] AC-A6: btw 请求超时 30s 后优雅降级，不影响主线

### Phase B: Web UX 优化 ✅

**目标**：优化 btw 在 Web Hub 上的交互体验

**设计参考**：`pencil-design/new.pen` Screen 5 (BTW Card Polish) + Screen 6 (Autocomplete UX)

**确定方向**（设计稿已通过 review）：
1. **独立 BtwCard 组件** — 紫色 header（"旁路问答 · {catName}解答"）+ 问题高亮区 + 回答区 + footer（耗时 + 工具使用 + "刷新后消失"）。右对齐 75% 宽度，虚线边框，bg-surface-secondary。Header 中猫名动态渲染（基于 thread primary cat）
2. **Markdown 渲染** — 回答区支持粗体、列表、代码块（Geist Mono），区别于纯文本
3. **History 快捷入口** — 卡片 header 内 History 按钮，打开本地历史（sessionStorage，跨刷新不落库）
4. **Feature ID 自动补全** — 输入 `/btw F...` 时触发 Matching Features 下拉，显示 feature ID + 标题
5. **BTW 输入模式** — 输入 `/btw` 前缀或点击旁路按钮后，输入框紫色高亮边框标识 btw 模式

**待定**：快捷键触发（如 `Ctrl+B`），实现时决定

**不做**：IM 适配。IM 无 ephemeral message 能力，强行适配是降级体验，不如不做。

### Phase B AC
- [x] AC-B1: BtwCard 独立组件渲染，视觉区分于主线消息
- [x] AC-B2: btw 回答支持 markdown（粗体/列表/代码块）
- [x] AC-B3: History 按钮可查看本地 btw 历史（sessionStorage）
- [x] AC-B4: 输入 `/btw F` 触发 feature ID 自动补全下拉
- [x] AC-B5: btw 模式下输入框有视觉区分（紫色边框）

## Dependencies

- **Related**: F108（Side-Dispatch Concurrent Invocation）— 概念相关但实现独立，btw 比 F108 轻量得多

## Risk

| 风险 | 缓解 |
|------|------|
| side agent 的 token usage 混入主线计费 | 独立计费路径，btw 调用标记 `ephemeral: true` |
| 只读工具调用延长响应时间 | 30s timeout 硬上限；一般 1-2 次工具调用在 10s 内完成 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不支持多猫 @mention，固定当前 thread 猫 | 防止 btw 退化为轻量版 post_message，重踩 queue/governance | 2026-05-01 |
| KD-2 | 不落 MessageStore | 每个 aggregator 都要尊重 filter 太脏，不落库失败成本低（再问一次） | 2026-05-01 |
| KD-3 | 只读工具 allowlist，不做预注入 | CC 源码分析后修订：模型自行决定查什么比预注入更准确；"可读不可写，可查不可发"原则 | 2026-05-02 |
| KD-4 | 禁嵌套（深度=1） | 简化心智，btw 是旁路减负不是可递归主线 | 2026-05-01 |
| KD-5 | 上下文全量注入，不截断 | CC 给 compact boundary 后全量消息；我们 5条/1000token 截太狠，影响回答质量 | 2026-05-02 |
| KD-6 | 1 次 agent loop / one-shot / 不支持追问 | CC 也是 one-shot；需追问说明问题不适合 btw | 2026-05-02 |
| KD-7 | Phase B 卡片 header 猫名动态渲染 | btw 目标猫由 thread primary cat 决定，header 不应硬编码 | 2026-05-03 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-01 | 立项（三猫讨论收敛） |
| 2026-05-02 | CC 源码对比 → 修订 KD-3/5/6（工具策略 + 上下文 + 轮次） |
| 2026-05-02 | Phase A merged (PR #14) — 6 轮 review，含 agent-key 封堵、timer 清理、nesting guard scoping |
| 2026-05-03 | Phase B 设计稿完成（暹罗猫 Pencil mockup），布偶猫 review 通过 |
| 2026-05-03 | Phase B merged (PR #18) — BtwCard + markdown + history + autocomplete + purple border |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F108-side-dispatch-concurrent-invocation.md` | 并发 invocation 基础设施（概念相关） |
| **Reference** | Claude Code `src/commands/btw.tsx` + `forkedAgent.ts` | 原版实现参考 |
| **Design** | `pencil-design/new.pen` Screen 5 + Screen 6 | Phase B 视觉稿（暹罗猫） |
