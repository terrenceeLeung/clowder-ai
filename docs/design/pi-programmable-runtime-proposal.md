---
topics: [pi, programmable-runtime, harness, carrier, compaction, extension, upstream-proposal]
doc_kind: proposal
created: 2026-07-27
status: submitted — upstream issue zts212653/clowder-ai#1221（2026-07-27）；UI 桥经 co-creator verdict 升格为 A（交互友好）
authors: [宪宪/claude-fable-5, 砚砚/gpt-5.6-sol(并行独立观点), co-creator]
---

# Proposal: Programmable Runtime Slot — 以 pi 为首个参考实现，修复 harness 不对称

> **目标读者**: clowder-ai upstream 仓 maintainer / 社区
> **性质**: 能力接口提案 + 参考实现路线，非"接入某个第三方项目"的绑定请求
> **本地状态**: 讨论收敛底稿（2026-07-26/27 七轮共创讨论），未立项、未动工
> **注**: 文中 F 号/KD/LL 为本 instance 的证据锚点，issue 提炼时替换为自包含摘要

---

## 1. Problem — Harness 不对称

clowder-ai 本质是一个 harness engineering 系统：在 CLI runtime 外包一层 L0 规则注入、MCP 工具、SOP、记忆闭环、eval。但这层投资在不同 runtime 上的"渗透率"严重不均：

| Runtime | 可编程性现状 | 家族 |
|---|---|---|
| claude code | hooks（可 block）、skills、MCP、settings —— 盒子最不黑 | 布偶猫（Claude）|
| codex CLI | config + AGENTS.md + MCP；**无可编程 hook、无 steer、无 compaction 控制、无动态工具** —— 全家最黑 | 缅因猫（GPT）|
| kimi ACP | login 特例、context 事件缺失（F161 KD-11）—— 半残 harness | Kimi |

**编制一半以上、且持续扩编的非 Claude 猫，享受的 harness 待遇最差。** 三个老病在它们身上无解：

1. **压缩失忆**（compaction 黑盒）：通用总结器不知道什么重要，典型丢失 = 球权状态、AC 进度、operator 指令原文（被有损转述）、中间排除结论。现有手段（L0 常驻 / context warn 自救 / 记忆 recall）全部作用于"压缩后"，且 recall 有致命前提——猫得知道自己忘了才会去查。
2. **工具面积膨胀**：90+ MCP 工具 schema ≈ 90k tokens（KD-12 实测曾把 opencode 压进 compaction 死循环；FU-4 至今 open）。对 128k context 的模型（如 spark）挂满即吃掉七成工作空间。工具注入是静态的，外挂只能做粗粒度白名单。
3. **运行中不可干预（双向）**：人进不去——codex 长任务中途无法纠偏（steer 不存在），只能等跑完或杀掉；猫出不来——执行途中需要人类决策时只能整轮终止、发卡、等下轮唤醒重建上下文；收尾时机（掉球高发点）同样无介入点。

这些痛的共同点：**全部卡在 runtime 内部主权边界上，外挂手段已经穷尽。**

## 2. 关键事实约束

- **pi 无法使用 Claude 订阅 OAuth；可用 ChatGPT 订阅、Kimi、及 20+ API-key provider**（operator 实测，2026-07）。因此 pi 的服务对象**恰好是** harness 待遇最差的缅因猫/Kimi 家族——不对称的修复面和 pi 的可用面完全重合。
- pi = provider-agnostic harness（TypeScript，四种运行模式：TUI / print / **RPC（strict LF-delimited JSONL over stdio）** / SDK），extension 体系官方支持注册 LLM-callable tools、拦截工具调用、接管 compaction、动态工具集。
- 官方立场无 MCP，但明示 "build an extension that adds MCP support" 为认可路径。
- GPT 订阅 OAuth 进 pi 的政策稳定性同样是外部依赖（今天 Claude 被封，OpenAI 政策也可能变）——列入风险，不可当恒定前提。

## 3. Mental Model — 价值甄别框架

**核心命题：pi 不是"又一个 CLI"，是第一个白盒 runtime。引入它的唯一正当理由是拿到 runtime 内主权，去治只有主权能治的病。其他好处都是搭车。**

每个候选价值点过三问，全过才进核心论据：

1. **痛是真的吗？** —— 有 F 号/KD/LL/eval 数据佐证，不是想象的痛
2. **只有 runtime 内主权能解吗？** —— 外挂能解的不算 pi 的价值
3. **解了可度量吗？** —— eval 测不出的价值不进 proposal

甄别结果（七轮讨论收敛）：

| 候选 | 判定 | 理由 |
|---|---|---|
| **Compaction 主权** | ✅ 核心 A | 痛最深、pi 独有介入点、eval-memory 可测 |
| **工具面积动态化** | ✅ 核心 A | per-turn 动态只有 runtime 内能做；静态裁剪外挂可做（诚实边界）|
| **运行中双向交互（steer + UI 桥）** | ✅ A | 出向 steer：codex 无等价物；回向 UI 桥：工具调用级人机交互。operator verdict（2026-07-27）：交互友好是独立价值维度，从 B+ 升格 |
| 掉球治理执行点 | A- | 判定服务 runtime 无关（见 §5.4）；pi 仅为缅因猫系补执行点 |
| 进程内观测埋点 | A- | 增益型：eval/摩擦数据从事后解析变实时采集 |
| per-turn L0 / provider 层 / 工具桥本身 | B | 外挂已解决或属接入必需件，不构成引入理由 |
| Session tree | B | 无既存痛证据（甄别中主动降级——优雅不等于痛）；留作实验台仪器 |

**甄别纪律：若一个方案只有 B 类收益，多养一个 runtime 的维护成本不划算。本提案成立的前提是三个 A 类。**

## 4. 提案核心 — 定义能力接口，而非绑定 pi

向 upstream 提的不是"接入 pi"，而是：**clowder-ai 需要一个 programmable runtime slot** —— 在 F143 四维模型（Transport × Binding × RuntimeContract × EventAdapter）的 RuntimeContract 维度增加一档 `programmable`，定义 harness 主权能力接口：

```
ProgrammableRuntimeContract（能力接口，任何满足者皆可为 carrier）:
  - compaction hook     压缩前通知 + 可接管/可取消
  - context filter      每次 LLM 调用前的 messages 过滤
  - dynamic toolset     运行中工具集增删（deferred loading）
  - steering            运行中消息注入（当前工具批次后生效）
  - ui delegation       UI 原语委托宿主实现（阻塞式问答可桥接宿主界面，见 §6.3）
  - settle interception 收尾前介入点（消息可检可矫正）
  - lifecycle events    进程内结构化事件（工具调用前后、turn/agent 生命周期）
```

pi 是**第一个参考实现**（当前唯一满足全部七项的开源 harness）。收益：① upstream 接受"接口 + 参考实现"远易于接受"绑定社区项目"；② pi 的 API 漂移被隔离在 adapter 层；③ 未来任何白盒 runtime 免费复用。

### 身份定位（讨论第一轮结论）

**pi 是 protocol/carrier 维度，不是猫 identity。** 延伸 F161 KD-1（"ACP 是 transport 不是 provider identity"）：model 决定头脑，harness 决定手脚；头脑不同 → 新猫，手脚不同 → 新 variant/protocol。落法：

- 架构层：不新增 `clientId: "pi"`；pi 作为 runtime/transport 配置（`runtime: { kind: "pi", transport: "stdio-rpc" }`）
- 产品层：需要独立召唤/AB 对比时注册 variant（如 `@sol-pi`），同猫族、共享 persona 来源、独立 catId 与 session chain；carrier 在 session 创建时固定，不可中途切换
- 初期挂试验分身跑 eval 校准 harness 差异（同 model 不同 harness 的 SOP 遵守度/行为差异 → F192 对照素材）

### 接入面（讨论第一轮结论，与并行独立分析一致）

**CLI + RPC mode，不用 SDK。** 理由：① 与现有 carrier 架构同构（子进程边界 + 事件流 → transformer → AgentMessage，F050/F149/F161 模式直接复用）；② 故障隔离 + 独立升级（SDK in-process 违反进程边界纪律；pi extension 拥有完整系统权限、无 sandbox，绝不能进 API 主进程）；③ RPC 控制面完整（prompt/steer/follow_up/abort、fork/switch_session、compact/set_auto_compaction、get_session_stats、extension_ui 子协议）。

工程要点：strict LF-delimited JSONL framing——**不可用通用 readline**（会被合法 JSON 字符串内的 U+2028/U+2029 截断），需独立 `PiRpcFramer`；以 `agent_settled`（非 `agent_end`）收口。

## 5. 架构设计

```
Cat identity / AgentRouter
      │
      ▼
PiAgentService（AgentService 接口）── ProcessPool / SessionBinding（复用 F149 栈）
      │  strict JSONL RPC (spawn: PI_CODING_AGENT_DIR=<per-cat> pi --mode rpc
      │   --no-extensions -e <clowder-extension> --no-prompt-templates ...)
      ▼
pi --mode rpc
  ├─ GPT / Kimi / ... provider
  └─ clowder-extension（瘦客户端，唯一第一方扩展）
        │ HTTP（短期 capability token，经 host-side broker）
        ▼
   clowder-ai backend :3006
        ├─ @cat-cafe/toolkit（工具真相源）
        └─ harness endpoints（settle-check / compaction-summary / policy / telemetry）
```

### 5.1 工具层：toolkit 双投影（P4 单一真相源）

代码现状已支持：`packages/mcp-server` 中工具已是结构化 `ToolDef = { name, description, inputSchema, handler }` 注册表，handler 为纯 TS 函数（HTTP 调 backend / 本地 SQLite），McpServer 只是薄壳；且已有按 runtime/凭证裁剪暴露的先例（F061 `READONLY_ALLOWED_TOOLS`、F178 `AGENT_KEY_TOOLS`）。

改造 = 把 ToolDef 层抽成 **`@cat-cafe/toolkit`**（runtime-agnostic 包），两个消费者：

- **MCP serving 面**（现状保留，claude code / codex / gemini / opencode 继续用，零行为变化）
- **clowder-extension serving 面**（pi 专用薄投影：循环 `registerTool()`，schema 做 zod/JSON-Schema → TypeBox 机械转换）

**MCP 从"工具的形态"降格为"工具的 serving 面之一"。** 加新工具零 extension 改动；未来新 harness = 加一个薄投影。

### 5.2 瘦 extension 原则（铁律）

**harness 的大脑一行不进 extension；extension 只是神经末梢。**

| 层 | 内容 | 归宿 |
|---|---|---|
| 决策层 | 家规判定、L0 编译、SOP 定义、工具 handler、记忆、eval 域 | backend/toolkit，零搬迁 |
| 执行点 | 生命周期哪个点触发什么检查 | extension，每 hook 几十行胶水：收事件 → HTTP 问 backend → 执行 verdict |

理由：① 防真相源分裂（业务逻辑散进 extension TS = 两个大脑）；② pi API 漂移只伤胶水层；③ backend harness endpoint 本来就是该长出的能力面（F064 判定逻辑已存在），**不为 pi 特制**。

### 5.3 agent_dir 编译式管控

`PI_CODING_AGENT_DIR`（已确认存在，指向 agent dir 本体）per-cat 生成，pi 的一切可变面 = cat-config 编译产物（F203 编译 L0 同款哲学）：

```
~/.cat-cafe/pi-agents/<catId>/        ← clowder-ai 唯一写者
  extensions/clowder-extension/       ← 只装第一方 bridge
  settings.json                       ← 生成（defaultProjectTrust 等）
  SYSTEM.md                           ← L0 + persona 编译产物
  skills/                             ← cat-cafe-skills 映射（pi 用 Agent Skills 标准，
                                         与本仓 SKILL.md 同源，候选直接软链）
  sessions/                           ← 与 cliSessionId 持久绑定
```

启动叠加 `--no-extensions -e <bridge> --no-skills --skill <allowlisted> --no-prompt-templates` 显式加载双保险；ambient `~/.pi/agent` 永不读取。headless 首跑信任：extension 处理 `project_trust` 事件程序化应答。

### 5.4 Harness endpoints（runtime 无关的大脑建设）

以掉球治理为例的分层落位——**判定一份，执行点各接各的**：

```
POST /api/harness/settle-check        ← backend，唯一真相源（F064 判定逻辑升格为服务）
  in:  最后一条 assistant 消息 + invocation 上下文（是否已调 hold_ball 等）
  out: verdict + 矫正指令文本

执行点：
  pi 猫          → extension：收尾事件 → settle-check → 不合规 followUp 注入矫正
                   （一次矫正机会，仍失败 → 记录上报，防死循环）
  claude code 猫 → Stop hook 接同一 endpoint（curl → exit 2 block）
  codex 猫(裸)   → 无执行点，维持 eval 事后测 ← 不对称的实证
```

**诚实结论：settle-check 本身不依赖 pi，claude code 今天就能接**——它属于独立可做的大脑建设；pi 的贡献是给缅因猫/Kimi 系补执行点。（此项因此从核心 A 降为 A-。）

## 6. 三根柱子详案

### 6.1 Compaction 主权 —— "从随机脑叶切除到受控手术"

pi 介入点：`session_before_compact`（可取消/可接管）、`context` 事件（每次 LLM 调用前过滤 messages）、`before_agent_start`（每 turn 注入）、`appendEntry`（extension 状态持久化，不占 LLM context）、RPC `compact` / `set_auto_compaction`。

**三道防线设计：**

1. **save（压缩前抢救）**：`session_before_compact` → 结构化关键状态外存（球权、feat/AC 进度、**operator 指令原文**、已排除路径清单）。此刻原始上下文完整，抢救无损。
2. **rewrite（压缩接管）**：弃默认总结，用猫咖分级压缩——工具输出压至结论；探索过程压成"查过 X/Y/Z，排除因为…"；**operator 消息逐字保留，永不转述**（压缩转述是"明确指令>推断"类事故的隐形来源）。
3. **restore（压缩后重灌）**：压缩后首 turn `before_agent_start` 自动注回状态卡——**不依赖猫意识到自己失忆**，unknown unknowns 结构性堵死。

副产品——**压缩审计**：防线 1 全量状态 vs 压缩后 context 的 diff 落盘。第一次能回答"压缩丢了什么"，审计数据反哺全家（布偶猫系的 L0/MEMORY/F225 策略从凭感觉变有数据）。

釜底抽薪——`context` 事件不等压缩：每次调用前主动裁陈旧大块工具输出，与工具面积动态化两头合力**推迟压缩到来**。治压缩最好的方式是少压缩。

分期：先上 1+3（无损外存+重灌，纯增益零风险）；防线 2 拿审计数据迭代（自定义总结做差可能不如默认，不冒进）。

### 6.2 工具面积动态化 —— 治 KD-12/FU-4

pi 官方 "Dynamic Tool Loading Pattern"（一等公民设计，非 hack）：全量 `registerTool` → 初始只激活 loader tool → loader 调 `setActiveTools` 增量激活；Anthropic 4.5+ / GPT-5.4+ 有 provider 级 native deferred loading。

落法：核心高频工具 10~15 个起步 + discover 元工具按需激活长尾。对 128k 猫是量级性工作空间释放。验证后模式反哺 MCP 面（按 cat/session 裁剪，现有白名单机制是雏形）。

### 6.3 运行中双向交互 —— steer（人→猫）+ UI 桥（猫→人）

现状：invocation 一旦跑起来就是黑箱——人不能进（纠偏只能杀任务重跑），猫不能出（问人只能整轮结束发卡片等下轮唤醒）。pi 补齐双向：

**出向 — steer**：RPC `steer` 一等公民命令（当前工具批次后生效）+ `follow_up`（settle 后生效）。Hub 场景：operator/其他猫对运行中的猫说"方向错了，先看 X"，无需杀任务。codex 无任何等价物。同一机制也是 6.1 restore 和 5.4 矫正注入的投递通道。

**回向 — UI 桥**：pi 的 `ctx.ui` 是宿主中立抽象——pi 不假设 UI 是终端，**谁是 RPC 客户端谁就是 UI 实现者**（官方设计意图，非 hack）。TUI 模式实现者是终端渲染；RPC 模式下实现者就是 clowder-ai。五步闭环：

```
① extension 在 hook 点（如 tool_call）拦住执行流（agent loop 暂停，非退出）
② extension 调 await ctx.ui.confirm(...) → RPC 序列化为 extension_ui_request(id) 推 stdout
③ PiAgentService 接住 → 转 Hub rich block 交互卡片（confirm/select/input 各有映射）
④ operator 点卡片 → extension_ui_response(id) 写回 stdin
⑤ extension 的 await 返回 → hook 返回 verdict → agent loop 从断点继续
```

注意 ①② 独立可用：hook 给拦截点，ctx.ui 给问人通道，**backend policy 决定何时把两者接起来**（不是每次拦截都问人）。

与现有 ask 卡片的本质区别 = 粒度：现有卡片是**回合级**（发卡→invocation 结束→点卡→新 invocation 重建上下文）；UI 桥是**工具调用级**（进程原地挂起，答案回来断点续跑，执行现场零丢失）。分工边界写死：UI 桥只做分钟级微决策（高危确认、歧义澄清）；需深思的决策仍走正常传球（回合级）。

产品含义（operator verdict 的核心）：**Hub 从"看结果的地方"变成"运行中协作面"**——猫在执行途中能举手，人在旁边能搭话，这是交互友好的结构性升级，也同时是权限 gap（§8）的第三选项：高危操作不必 hard-block 或放行，可以实时问人。

工程深水区四项：① 双层 timeout 协调（extension 侧 ≤ 桥侧，超时默认**拒绝**，猫收到拒绝自行改道或转 hold_ball）；② 交互必落 thread 留痕（持久化铁律，通道是结构化回调，痕迹可回放）；③ liveness 读模型新增 `waiting_operator` 状态（防 watchdog 误杀挂起进程）；④ **防打扰纪律**：弹卡资格由 backend policy 判定（决策漏斗硬条件：不可逆/高危才配弹），extension 无权自行弹窗——UI 桥是把决策漏斗压缩到工具粒度的运行时化，升级门槛一分不降，否则毁掉"放心不看"的授权哲学。

## 7. Non-goals（负面清单）

- ❌ **不替换 claude code/codex**——生产猫不动；pi 初期不承载生产球权
- ❌ **不为 pi 的多 provider 能力**——账户体系已有，此能力对本系统冗余
- ❌ **不废 MCP**——多 runtime 共享资产，继续为主 serving 面；extension 只是 pi 路径投影
- ❌ **不做订阅额度套利**——GPT OAuth 政策稳定性未证，最多观察项
- ❌ **不造"pi 猫"品种**——harness 不是 identity（§4）
- ❌ **第一阶段不复刻权限系统**（见 §8）

## 8. Gaps & Mitigations

| Gap | 现实 | 缓解 | 阶段 |
|---|---|---|---|
| 无权限系统 | 无 allow/deny/ask 引擎，默认全权执行 | `tool_call` hook 即权限原语（可 block/改 args）；社区 pi-permission-system 证明生态位；**UI 桥补第三选项**（机制见 §6.3）：policy 拦到高危操作 → Hub 卡片实时问 operator，不必 hard-block 或放行 | P1 接受（现有 CLI 猫本多 bypass 跑，风险不新增）；P2/P3 policy-hook + UI 桥权限流 |
| 无 OS sandbox | bash 直接用户权限（codex 有 seatbelt/landlock）| worktree 纪律 + 五条铁律 + agent_dir 隔离；**是接受不是解决**，长期容器化 | 接受并声明 |
| 无 subagent/fan-out | 原生无 Agent tool 类能力 | A2A 补位（本系统的跨猫编排本就是 subagent 替代）；extension 可 spawn `pi -p` 自建 | 接受 |
| 内置工具仅四件套 | 无 WebSearch/WebFetch | extension 补注册（toolkit 投影顺带解决）| P2 |
| Extension API 无版本承诺 | 活跃演化（repo badlogic → earendil-works 迁移中）| 版本 pin + 协议 fixture 测试（F105 管 opencode 同款）；adapter 层隔离 | 常态 |
| 供应链信任 | 社区主导项目进程内跑第一方代码 | lock 版本、第三方 extension 默认关闭、`-e` 仅显式加载第一方 bridge | 常态 |
| GPT OAuth 政策风险 | 外部依赖可变（Claude 已封第三方 harness 订阅）| API-key 路径兜底；风险声明进 issue | 声明 |

## 9. Validation Plan（可证伪假设）

试验分身（如 `@sol-pi`）+ 同 model 同 eval 集 AB 对照（pi carrier vs codex carrier）：

| 假设 | 指标 | eval 域 |
|---|---|---|
| 三防线降低压缩失忆 | 压缩后状态保持率（球权/AC/operator 指令问答）；压缩后首回合掉球率；重复劳动率（trajectory：重查已查内容次数）| eval-memory / eval-sop |
| 动态工具面释放 context | 稳态 context 占用；compaction 触发频率；128k 模型长任务存活时长 | eval-task-outcome |
| settle 矫正降掉球 | 掉球率（矫正前 vs 后）；矫正触发率与成功率 | eval-sop / eval-a2a |
| UI 桥交互友好且不扰人 | 高危操作拦截率；卡片响应时长；超时默认拒绝率；每任务弹卡次数（防打扰上限）| eval-friction / 人工 |
| （基线）pi carrier 无回归 | 同任务完成率/质量不低于 codex carrier | eval-task-outcome |

每项先定基线再开工；数据同时服务二阶用途——向 CC/codex upstream 提 feature request 的实证（"我们需要 compaction hook"）。

## 10. 分期路线（供 upstream 讨论，非本地承诺）

- **Phase 0 — Spike（~1 天）**：`pi --mode rpc` 跑通 prompt→事件流；extension `registerTool` schema 格式确认 + HTTP 调 backend；`context`/`session_before_compact` 事件行为实测；`setActiveTools` 会话中动态性；RPC 下 `extension_ui_request` 往返；`project_trust` 程序化应答。**六个问号全是小实验，出否决项即停。**
- **Phase 1 — 地基**：`@cat-cafe/toolkit` 抽包（纯重构，现有 runtime 零行为变化）；`PiAgentService` + `PiRpcFramer` + transformer；agent_dir 编译器；env-map 加行。
- **Phase 2 — 三根柱子**：clowder-extension（工具投影 + deferred loading）；compaction 防线 1+3；steer 通道 + UI 桥基础版（confirm/select → Hub 卡片，timeout + 落 thread）；settle-check endpoint + 双家族执行点（CC Stop hook 顺带接入）。
- **Phase 3 — 深水区**：compaction 防线 2（审计数据驱动）；policy hooks + UI 桥权限流（高危拦截→实时问人闭环）；进程内 eval 埋点。
- **Phase 4 — 定级**：eval 数据 → operator 决策：pi carrier 转正 / 维持实验台 / 退役。

## 11. 附录 — 甄别落选记录（体现纪律，供 reviewer 检验）

- **Session tree（fork/分支探索）**：无既存痛证据（三问第一问不过）——方案对比现用 expert-panel/多猫并行可覆盖。留作实验台仪器（失败分支 = eval 天然负样本）。若采用，需立规矩：球权只在一个 active branch。
- **Per-turn 动态 L0**：F203 静态注入已工作，动态化属锦上添花。
- **Provider/billing 层拦截**：env 注入（F171）已覆盖，HTTP 层精确审计留作观测项。
- **订阅额度多元化**：合规未证，不作论据。
- **"比 claude code 更好"叙事**：已废弃——claude 订阅进不了 pi，该对比无效；真实对比恒为 pi+GPT vs codex+GPT、pi+kimi vs kimi ACP。

---

*本文档为 upstream issue 底稿。待 co-creator 审定后提炼 issue 正文（语言/拆分粒度/投递仓另议）。*
