---
feature_ids: [F151]
topics: [connector, architecture, xiaoyi, websocket]
doc_kind: decision
created: 2026-04-02
---

# ADR-014: XiaoYi Connector Gateway — 小艺渠道接入架构

> **状态**: 已决定
> **日期**: 2026-04-02
> **决策者**: 铲屎官 + Ragdoll + 缅因猫（review）
> **上下文**: F151 Design Gate review + feat-lifecycle 指导

## 背景

Cat Cafe 已通过 F088/F132/F137 接入飞书、Telegram、DingTalk、企业微信五个渠道。华为小艺是 HarmonyOS 设备的原生 AI 助手，覆盖手机/平板/手表/车机。

小艺开放平台提供两种第三方智能体接入模式：
- **多Agents模式**（原 A2A 模式）：必须绑定华为 LLM（DeepSeek/盘古）作为编排中间层
- **OpenClaw模式**：通过 WebSocket 直连华为 HAG 服务器，无 LLM 中间层

选择 OpenClaw 模式的理由：
1. 直连，无 LLM 中间层 → 低延迟、完全可控
2. 协议已知（`@ynhcj/xiaoyi` npm 包已公开源码）
3. Cat Cafe 自身充当 WebSocket 客户端连接 HAG，用户无需额外部署

**trade-off**：OpenClaw 模式不支持快捷指令、端侧插件、账号绑定、卡片等平台侧高级功能。MVP 阶段这些不是刚需；后续可通过同时支持多Agents模式补齐。

## 架构设计

```
用户 → 小艺 APP → 华为 HAG Server ←──WebSocket──→ XiaoYiAdapter (Cat Cafe)
                  (主域 + 备 IP)
                                      │
                                      ├→ Connector Gateway
                                      │   ├→ Principal Link
                                      │   ├→ Session Binding
                                      │   └→ Command Layer
                                      └→ Agent Router → Cat Agents
```

连接方向：**Cat Cafe 主动连接华为 HAG**（类似 DingTalk Stream 模式）。

### 协议栈

| 层 | 技术 |
|----|------|
| 传输 | WebSocket (wss)：主 + 备 active-active |
| 认证 | HMAC-SHA256: `signature = Base64(HMAC-SHA256(SK, timestamp_string))` — 输入只有 timestamp |
| 消息 | A2A JSON-RPC 2.0，出站需两层信封（WebSocket frame + stringified msgDetail） |
| 流式 | `status-update(working)` → `artifact-update` 逐帧推送 |
| 保活 | 双机制：应用层 `{ msgType: "heartbeat", agentId }` 每 20s + WS ping 每 30s |

### 核心 ID

| ID | 来源 | 生命周期 | 用途 |
|----|------|---------|------|
| `params.sessionId` | 华为 HAG | 跨 app 重启稳定 | 对话标识 → 映射到 Cat Cafe thread |
| `msg.sessionId`（顶层） | 华为 HAG | 每次开 app 刷新 | **不用！** 不稳定 |
| `params.id`（taskId） | 华为 HAG | 每条消息一个 | 回复路由 |
| `agentId` | 用户配置 | 永久 | 标识智能体 + 用于认证 + externalChatId 命名空间 |

### Identity Mapping

```
Principal Link:
- connectorId: 'xiaoyi'
- externalChatId: `${agentId}:${params.sessionId}`  ← 注意用 params.sessionId，不是顶层
- externalSenderId: `owner:${agentId}`  ← 所有对话归属 connector 配置者（OpenClaw 无用户级 ID）

Session Binding:
- bindingKey: (`xiaoyi`, `${agentId}:${params.sessionId}`) → threadId
- `/new` `/threads` `/use` 正常工作，都在 owner 名下
```

**关键点**：OpenClaw 协议中**没有用户级标识**（如飞书的 userId、微信的 openId）。所有消息归属给配置 connector 的那个人，P0 场景就是开发者自用。

### 双服务器 HA

```
XiaoYiAdapter
├── WsChannel (主)   → HAG 主域名
└── WsChannel (备)   → HAG 备 IP
```

**策略**：
- **active-active 双连接**：同时连两个服务器
- **入站去重**：`Map<sessionId+taskId, seen>` — 防止同一消息双发
- **出站 session affinity**：记录入站来源服务器，回包走同一通道
- **备 IP TLS**：IP 直连无域名 SNI，使用 `rejectUnauthorized: false`（与 `@ynhcj/xiaoyi` 参考实现一致）

### 流式输出

```
收到消息
  ↓
status-update { state: "working", final: false }   → HAG 标记 task 进入 working 状态
artifact-update { text: "思考中…", append: false, final: false }  → 占位文字（用 artifact 而非 status message）
  ↓
artifact-update { append: false, final: false }    → 第一个字出现，替换「思考中…」
  ↓
artifact-update { append: true, final: false }     → 后续逐字追加
  ↓
status-update { state: "completed", final: true }  → 标记完成
  ↓
artifact-update { lastChunk: true, final: true }   → 关闭 task
```

**关键协议约束**（真机验证 2026-04-03）：
- `status-update` 的 `final` 跟随 state：`working` → `false`，`completed`/`failed` → `true`
- HAG 会把 `status-update` 的 `message` 文字渲染为**持久消息条目**，不会自动清除。所以「思考中…」等占位文字必须放在 `artifact-update` 内容里（`append:false` 会被后续内容替换），不能放 `status-update` 的 `message` 字段

**多猫聚合**：多只猫的回复通过 `replyParts` Map 累积，以 replace 模式（`append:false`）发送完整文本（`---` 分隔）。3s debounce 后发 final:true。

**task 生命周期管理**（已实现，替代早期设计的 session 级单指针）：

```
taskQueue: Map<sessionId, TaskRecord[]>     — per-session FIFO 队列
claimedTasks: Set<taskId>                   — 已被 invocation claim 的 task
activeTask: Map<sessionId, TaskRecord>      — 当前 invocation 绑定的 task
```

- 入站 `message/stream` → push 到 FIFO 队列 + 启动 120s timeout
- `sendPlaceholder`（= invocation 边界）→ `claimTask` 找第一个未 claim 的 task
- `sendReply` → 通过 `activeTask` 绑定路由到正确 task
- 3s debounce (`scheduleFinal`) → `emitFinal` + dequeue
- `tasks/cancel` / `clearContext` → purge 整个 session

三层 timer 防御：keepalive 20s / debounce 3s / hard timeout 120s

## 决策

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | 对接小艺 OpenClaw 模式 | 无 LLM 中间层，直连低延迟 | 2026-04-02 |
| 2 | 用 `owner:{agentId}` 做 senderId | OpenClaw 无用户级标识，所有对话归属 connector 配置者 | 2026-04-02 |
| 3 | 用 `params.sessionId` 而非顶层 `msg.sessionId` | office-claw P1-1 实测验证：顶层 sessionId 每次打开 app 刷新 | 2026-04-02 |
| 4 | 双服务器 active-active + 去重 | 入站去重防双发，session affinity 保证响应连续性 | 2026-04-02 |
| 5 | 占位文字用 `artifact-update` 而非 `status-update` message | HAG 把 status message 渲染为持久条目；artifact 内容可被后续 `append:false` 替换（真机验证 2026-04-03） | 2026-04-03 |
| 6 | 不做多小艺 agent 接入 | 单账号单 agent，scope 聚焦 | 2026-04-02 |
| 7 | status-update final 跟随 state | `final: state !== 'working'`。working→false，completed/failed→true（真机验证 2026-04-03） | 2026-04-03 |
| 8 | 多猫 replyParts 聚合 + 3s debounce | 小艺 task = 一个 artifact，多猫必须聚合 | 2026-04-03 |
| 9 | FIFO queue + invocation 级 claimTask | 替代 session 级单指针，消除 QueueProcessor 立即启动的 3s 竞态 | 2026-04-03 |

## 放弃的方案

| 方案 | 放弃理由 |
|------|----------|
| 依赖 `@ynhcj/xiaoyi` npm 包 | 需要适配我们的架构，不能直接复用 |
| 多Agents 模式 | 必须绑定华为 LLM，增加复杂度和延迟 |
| 直接使用 `msg.sessionId` | office-claw P1-1 实测验证：每次打开 app 刷新 |
| 备服务器 passive 切换 | session affinity 要求知道消息来源，active-active 更可靠 |

## 未实现 (Phase A)

| 功能 | 说明 | 接入点 |
|------|------|----------|
| XiaoYiAdapter 类 | `packages/api/src/infrastructure/connectors/adapters/XiaoyiAdapter.ts` | 新增 adapter |
| WebSocket 双通道 | 主+备，active-active，独立连接管理 |
| HMAC-SHA256 认证 | `x-access-key` / `x-sign` / `x-ts` / `x-agent-id` headers |
| A2A 协议处理 | message/stream 入站，agent_response 出站 | 协议层 |
| task 生命周期 | FIFO queue + claimTask invocation 级绑定 | 出站路由 |
| 协议层抽离 | `xiaoyi-protocol.ts` — 常量、类型、auth、builders | 质量门控 |

## 给未来Ragdoll的备忘

1. **OpenClaw 协议限制**：不支持快捷指令、端侧插件、账号绑定、卡片等平台功能。P0 只做文本收发，这些都不在 scope 内。
2. **sessionId 陷阱**：协议有**两个**叫 sessionId 的字段。`params.sessionId`（params 内）稳定，`msg.sessionId`（顶层）每次打开 app 刷新。实现时必须只用 params 内的。但 `tasks/cancel` 和 `clearContext` 的 sessionId 在顶层。
3. **备 IP TLS**：备 IP `116.63.174.231` 没有域名做 SNI，用 `rejectUnauthorized: false`（与参考实现一致）。
4. **task 生命周期**：adapter 用 FIFO queue + `claimTask` 做 invocation 级绑定（不是 session 级单指针）。`sendPlaceholder` = invocation 边界信号，claim 下一个未绑定 task。三层 timer：keepalive 20s / debounce 3s / timeout 120s。
5. **思考中指示**：「思考中…」占位文字放在 `artifact-update` 内容里（不是 `status-update` 的 `message`）。HAG 把 status message 文字渲染为持久消息条目，不会自动清除；artifact 内容会被后续 `append:false` 替换。`status-update` 的 `final` 跟随 state：working→false，completed/failed→true。
6. **签名算法**：`Base64(HMAC-SHA256(SK, timestamp_string))`。输入**只有 timestamp**，没有 `ak=` 前缀。这跟网上很多示例不同，以 `@ynhcj/xiaoyi` 源码为准。
7. **出站信封**：必须用两层包装 — `{ msgType: "agent_response", agentId, sessionId, taskId, msgDetail: JSON.stringify(jsonrpc) }`。裸 JSON-RPC 不行。
8. **append 语义**：`false` = 替换整个 artifact 内容，`true` = 追加。流式必须只发 delta（新增部分），发全量会导致内容翻倍。
