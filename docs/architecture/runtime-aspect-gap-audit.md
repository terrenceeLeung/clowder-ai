---
topics: [runtime, harness, aspect-audit, pi, carrier, compensation-code, programmable-runtime]
doc_kind: research
created: 2026-07-28
authors: [宪宪/claude-fable-5 (A/C/E), 砚砚/gpt-5.6-sol (B/D/F/G)]
related: [pi-programmable-runtime-proposal.md, F194, F211, F225, F203, F161, F064, F177]
---

# Runtime 切面缺口审计 — 猫咖因 claude code/codex 切面不足而别扭的实现

> **目的**：盘点"因为 runtime 内部无介入点，被迫在宿主侧长出的补偿代码"。产出三用：
> ① 引入 pi 的受益证据清单（回答"受益是什么"）；② 未来 Programmable Agent Runtime Contract 的需求来源；③ spike 实验 D（carrier capability 矩阵）的猫咖侧需求列。
> **方法**：每个病灶四问——实现在绕什么弯 / 缺哪个切面 / 有切面代码长什么样 / pi 的哪个机制给了这个切面。全部证据带 文件:行号。

## 总榜（按"能删除多少宿主补偿状态机"排序，sol 提出的标准）

| # | 病灶 | 可删除/避免的补偿系统 | 别扭度 | pi 可解度 | 审计 |
|---|---|---|---|---|---|
| 1 | **B 收尾/传球检查** | 缓存首轮文本 + 二次 provider invocation + 两轮事件拼接的整套 remedial 链 | 5/5 | 5/5 | sol |
| 2 | **D 工具面管理** | 启动时静态白名单三套集合；KD-12 类 compaction 事故的根因 | 5/5 | 5/5 | sol |
| 3 | **C 压缩面** | token 骤降 60% 猜压缩 + hint 搭下轮 prompt 便车 + recall 补救全家桶 | 5/5 | 5/5 | 宪宪 |
| 4 | **A 注入面** | 三格式 hook 文件同步 + drift 检测器 + unreliable flag workaround | 5/5 | 5/5* | 宪宪 |
| 5 | **E 运行中交互** | freshness re-invoke 排队 + 回合级确认往返 | 4/5 | 4/5 | 宪宪 |
| 6 | **G session 连续性** | 五家 resume 失败字符串协议 + 双映射持续 reconcile | 5/5 | 3/5 | sol |
| 7 | **F liveness/诊断** | ps CPU 采样 + updatedAt 代理 + 千行 canonical helper | 5/5 | 3/5 | sol |

\* A 的可解度注：pi 解的是 pi 路径（不再给矩阵加行）；存量 carrier 的注入矩阵只随 carrier 退役而消失。

## 病灶详录

### A. 注入面 — L0/身份的进入方式 per-carrier 各一套（宪宪）

**绕的弯**：
- 投递方式被迫抽象成四通道枚举：`'message-prepend' | 'native-l0' | 'pack-only' | 'always-delivered'`（`packages/shared/src/types/prompt-hook.ts:124`）——枚举的存在本身 = 各 carrier 注入能力参差的化石。
- 为让各 runtime 有开工/收尾 hook，宿主要向 `.claude/hooks/`、`.codex/hooks.json`、`.gemini/hooks.json` **三种格式同步 shell 脚本**，并配 `checkDrift`/`applySync` 防漂移（`packages/api/src/agent-hooks/sync-targets.ts:54-190`）——一个"配置文件同步器 + drift 检测器"纯为补偿而生。
- Claude 官方注入口不可靠的书面自白：`invoke-single-cat.ts:1915` 注释原文 *"--append-system-prompt proved unreliable (cats didn't receive content)"* → 被迫手工 prepend 进 prompt 文本，并 *"intentionally do NOT pass systemPrompt to avoid double injection"*（双注入防御，:1908-1945）。
- OpenCode 的 L0 要写临时文件落盘传路径（:1774-1780）。

**缺的切面**：可编程、每 turn、fail-closed 的 system prompt 写入点。
**pi 的对应物**：`before_agent_start` 返回 `{systemPrompt}` —— 进程内函数调用，无文件、无同步、失败可见。

### B. 收尾面 — 一个缺失的 Stop hook 长出"第二次调用"系统（sol）

- Codex 生产链不触发 Stop hook → provider 声明 `needsServerRoutingGuard()`（`CodexAgentService.ts:709`）
- server 侧识别非法出口并限一次补救（`routing/guards/routing-guard-remedial.ts:1`）
- **牺牲真实 streaming**：缓存第一轮文本防止非法回复先显示（`route-serial.ts:1112`）
- 再跑一次 `codex exec resume`，区分"补路由 vs 整段替换"重新拼接两轮事件（`route-serial.ts:1912`）
- F064 提示词补丁 → F177 Claude Stop hook + 非 Claude re-invoke 两套补偿链——同一缺失切面在不同 carrier 上反复长适配层。

**缺的切面**：settle 前拦截 + **同 loop 内** follow-up。
**pi 的对应物**：settle 生命周期事件 + `sendMessage(followUp/steer)`。边界：出口是否合法由 backend 判定，extension 只是执行点。

### C. 压缩面 — 检测靠猜、投递靠等（宪宪）

**绕的弯**：
- **压缩检测 = 考古**：*"When usedTokens drops >60% from previous known value, the CLI [compacted]"*（`invoke-single-cat.ts:248, 2254-2258`）——用 token 数骤降 60% 反推"它刚才压缩了"。
- context fill 从 CLI 事件流 usage metadata 反推，还要分 exact/approx 置信度、处理 cumulative-only carrier 的 fallback（:2175-2227）。
- **警告无法实时送达**：`context-management-hint.ts` 头注释自白——system_info 到不了猫的认知，warn 提示只能 *"rides the prompt-injection channel… prepended on the cat's next invocation"* ——**警告要等下一轮 invocation 才被看到**，且 in-memory ephemeral（重启即丢，:50+）。
- 下游整条 F225 软层 + recall 三入口 + 开工自检，全是"压缩后补救"体系。

**缺的切面**：压缩前通知 + 可接管 + 每次 LLM call 前的 context 可见性。
**pi 的对应物**：`session_before_compact`（可取消/可接管）+ `context` 事件 + RPC `compact`/`set_auto_compaction` —— save/rewrite/restore 三防线的地基（详见 proposal §6.1）。

### D. 工具面 — 只有启动时静态裁剪（sol）

- readonly / agent-key / desktop 三套集合分别维护（`mcp-server/src/server-toolsets.ts:47`），启动时一次性注册全部选中工具（:516）
- 90+ schema ≈ 90k context，曾触发 OpenCode compaction 死循环（F161 KD-12），修复靠全局 context 上限这种粗手段

**缺的切面**：按 turn/session 动态改变 active tool surface。
**pi 的对应物**：`getActiveTools`/`setActiveTools` + 官方 deferred loading 模式。注意：toolkit 抽取是安全行为迁移非零风险重构（upstream Q4 结论），MCP 继续做其他 runtime 的 serving 面。

### E. 运行中交互 — 只能回合级排队（宪宪）

**绕的弯**：
- 消息投递是**队列+游标制**：`deliveryStatus: 'queued' | 'delivered' | 'canceled'` 生命周期 + `markDelivered` + per-cat ascending cursor（`stores/ports/MessageStore.ts:139, 316, 460`）——猫在跑时新消息只能 queued，等下一轮按 cursor 取。
- **函数名即病灶自白**：`freshnessReinvokeEnqueue`（`route-serial.ts:480`）——上下文不新鲜→排队→**重新调用一整轮**，因为不存在"中途递话"。
- 排队制的衍生复杂度：#697 StartupReconciler 要扫 `deliveryStatus=queued` 对账重启丢投（`MessageStore.ts:329`）。
- 反向同病：猫要问人只能整轮结束发卡片，等人点卡再被新 invocation 唤醒——一次确认 = 两轮生命周期 + 上下文重建。

**缺的切面**：运行中双向通道（人→猫注入；猫→人挂起问答）。
**pi 的对应物**：`steer`/`follow_up`（入向）+ `extension_ui_request/response`（出向）。边界：A2A 队列语义仍在 backend——steer 给的是投递通道，不是队列的替代。

### F. Liveness — 活性靠外部推断（sol）

- 三个互不等价数据源要持续协调：进程内 `InvocationTracker`、Redis lifecycle record、`updatedAt` 充当活性代理的 draft（F194 split-brain 根因，`F194:36`）
- canonical helper 超千行：parent/child namespace、draft freshness、zombie grace（`getThreadLiveInvocations.ts:1`）
- 底层用输出时间 + `ps` CPU 采样推断 busy/idle，Windows 不完整（`ProcessLivenessProbe.ts:1`）

**缺的切面**：结构化 lifecycle/heartbeat 事件。
**pi 的对应物**：agent/tool/settled/session 结构化事件——把"正常生命周期"从启发式升级为直接事实。**边界（sol 强调）**：崩溃、跨实例恢复、read model 仍属 Clowder control plane；**pi 不是去 Redis 的理由**。

### G. Session 连续性 — 五家协议各修各的（sol）

- Claude bg resume 每次新 UUID → 引入 `bg:${threadId}:${catId}` chain key（`invoke-single-cat.ts:770`）
- `SessionManager` 与 `SessionChainStore` 双映射持续 reconcile（`SessionManager.ts:18`）
- resume 失败识别 = Claude/Codex/Gemini/OpenCode/Kimi 五家字符串协议各一套（`invoke-helpers.ts:39`）
- 外部 runtime 的 opaque session 反向注册问题（F211:19）

**缺的切面**：session create/resume/fork/switch 的一等接口 + **workspace rebind**。
**pi 的对应物**：session tree + fork/clone/switch + entryId 游标——对猫咖拥有的 pi session 显著简化。**硬缺口（co-creator 指出）**：pi 无运行中切 cwd 能力 → worktree SOP 意味着换进程；候选解=进程池按 (catId, cwd) 键 + chain 传递 continuity，**未验证，列 spike 后验证项**。durable chain/thread binding 仍留 Clowder。

## 架构结论（两猫一致）

1. **受益的本质**：不是"少写 provider adapter"，而是**把 agent loop 外部的补偿逻辑移回可编程生命周期内部**。上表 1-5 名的补偿系统恰是猫咖最复杂、最难测、事故最多的代码带（route-serial 二次调用链、F194 千行 helper、sync-targets drift 检测器、60% 骤降猜测器）。
2. **"runtime core" 拆两层**：
   - **Agent-loop host**：pi 是第一个能完整实验全部切面的宿主——有希望，按猫按经济学定去留；
   - **Clowder coordination core**：身份/A2A/球权/记忆/durable chain/eval verdict 永远在猫咖（daemon/domain core），pi extension 只是连接它的一种 runtime adapter。
3. **Programmable Agent Runtime Contract 需求清单**（sol 起草，宪宪确认，共八项）：before-turn/context mutation · dynamic tool activation · tool-call policy (allow/deny/ask) · before-settle interception + same-loop follow-up · structured lifecycle/heartbeat · session create/resume/fork/switch · steer/UI request-response · **workspace rebind（或带连续性语义的 process handoff）**。pi 是首个参考实现 ≠ 永久绑定 pi。
4. **权限 package**（co-creator 指出）：pi-permission-system 作为 tool-hook 权限候选，先过 provenance/license/版本/绕过面审计；它管工具调用权限，不管进程被攻破后的 OS 隔离。

## 附：Auto-Harness / Harness Lab 对照（2026-07-28 三猫收敛，co-creator 方向）

### 猫咖自进化现状（F192 闭环，四层修改路径）

检测（weekly/3d 周期体检，非实时告警）→ verdict handoff（48h ack）→ 修改：① skill/L0 文本=下轮生效；② hooks=同步后下轮；③ backend 代码=**PR+rebuild+重启**（唯一需重启层，且 merge→重启无自动化衔接——7-23 verdict "runtime not refreshed" 实证）；④ MCP 工具 → re-eval 下周期复验。**一轮 ≈ 2~3 周**。

### 经三轮 co-creator 压力测试后的 pi 净优势（修正史保留）

- ~~拯救 F192 采数断链~~（划掉：那批 no-data 主因是本地 OTel 开关+旧进程运维态，pi 不解决）
- ~~独有 session fork~~（划掉：CC 有 SDK `forkSession`；猫咖 bg chainKey 补偿就在消化 CC 的 fork 行为）
- ✅ 行为级信号原生采集点（settle/compaction/工具事件，CC/codex 无处可埋；生态实证：@braintrust/pi-extension 已做 extension 埋点→eval 平台）
- ✅ extension 进化单元：介于文本层与 backend 层之间的新一层——**可执行代码的能力 + 文本层的生效速度**（显式 `ctx.reload()`，terminal operation，settled 后执行；非 watch mode，恰适合可审计 eval）
- ✅ fork AB 仪器化增益（CC 可做基础版；pi 增益=RPC 同进程编排 + 稳定 entryId 游标 + 树谱系保留废弃分支；fork 从 user message 分叉，非任意 tool event）

### S 级命题（sol）：三件套组合成实验机

单独看：tree=B 级便利、reload=开发提速、model recipe=配置管理。**组合后**：

> 能固定上下文（失败现场→sessionId+entryId→回归 fixture）、替换可执行 harness（settled 边界 reload 候选 revision）、自动回归并保留因果谱系（appendEntry 写 recipeHash/experimentArm/verdictId）的实验机。

派生能力：paired counterfactual（同前缀 AB）、**harness bisect**（对同一失败现场二分定位引入退化的 extension revision）、shadow harness（候选 policy 只记 would_block 不真拦，比较误杀/漏拦后转正——**权限系统上线的正确路径**）、canary rollout（部分 session 用 recipe B，异常只切配置不回滚 backend）。

边界（sol 守住的）：session tree 只固定对话上下文——完整复现还需 git snapshot、工具 fixture、model 版本、extension hash、recipe hash 一起钉死。

### 判分器接口（宪宪补）

实验机重跑后的 paired verdict 判分显式对接现有分野：掉球/工具调用/token/人工介入 = **machine predicate** 自动判；任务质量 = **judgment rubric** + verifier 猫（复用 #748 tagged-union 与 F192 verdict 体系）。否则"重测快、判分慢"成为新瓶颈。

### Model 动态装配（四层确定性合并，sol 起草）

`constitutional base + runtime capability profile + model recipe + task/phase overlay + experimental delta = EffectiveHarnessRecipe`。处方输入两类：客观 capability（context window/native deferred tools/thinking levels）+ eval 学到的画像（工具准确率/压缩后保持/长上下文偏移）。调的是执行结构（active tools/prompt 密度/compaction 阈值/settle 强度/ask-deny 阈值），不是性格文案。

### 生态调研结论（2026-07-28）

pi 生态（5382 包）：零件齐（@braintrust 埋点桥、pi-reason-harness 推理自优化、gentle-pi SOP 硬化、pi-smart-router 离线路由 eval）、**"eval→verdict→自动改 harness→回归验证"闭环成品空白**。研究界已证方向（Self-Harness weakness-mining 三阶段 40.5%→61.9%；HarnessX +14.5%）。F192 与 Self-Harness 结构同构——猫咖已拥有闭环里最难的 verdict 流程，缺的是"自动提案+回归门"一步。

### 首个 Harness Lab 实验（sol 设计概要，spike 通过后内部做，不进 #1221）

脱敏掉球 session → 固定 checkpoint/git/model/fixture → A=server remedial vs B=pi settle-check extension → appendEntry 写实验标记 → settled 后采同组指标 → 若干组 → F192 paired verdict → shadow/canary → promotion。附带验证五个工程前提：RPC tree 语义一致性、RPC 触发 reload、reload 后状态隔离、AB recipe 跨 session 泄漏、worktree/file state 与 checkpoint 联合恢复。

## 与 upstream #1221 的关系

本审计是猫咖侧（fork）的内部证据工作，**不进 #1221**（Design Gate 期间不扩设计）。若 gate 放行，实验 D 的 capability 矩阵直接以本文七病灶为"猫咖侧需求列"；Contract 八项可在 spike 数据支撑后作为后续提案；Harness Lab 全部属 spike 之后的内部实验层。
