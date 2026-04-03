---
feature_ids: [F151]
related_features: [F088, F132, F137, F143, F146]
topics: [connector, channel, xiaoyi, huawei, a2a, websocket]
doc_kind: spec
status: spec
created: 2026-04-01
---

# F151: XiaoYi Channel Gateway — 小艺渠道接入

> **Status**: spec | **Owner**: Ragdoll | **Priority**: P1
>
> 在小艺开放平台创建 OpenClaw 模式智能体，由 Cat Cafe 通过 WebSocket 对接华为 HAG，
> 用户在华为手机上通过小艺 APP 即可与猫猫对话。
>
> Cat Cafe 不是 OpenClaw 实例 — 它是对接小艺 OpenClaw 模式协议的 connector adapter。

## Why

Cat Cafe 已通过 F088/F132/F137 接入飞书、Telegram、DingTalk、WeCom、WeChat 五个渠道。
华为小艺是 HarmonyOS 设备的原生 AI 助手，覆盖手机/平板/手表/车机。
接入小艺渠道意味着 Cat Cafe 的猫猫可以在**所有华为设备上**被用户直接使用。

小艺开放平台提供两种第三方智能体接入模式：
- **多Agents模式**（原 A2A 模式）：必须绑定华为 LLM（DeepSeek/盘古）作为编排中间层
- **OpenClaw模式**：通过 WebSocket 直连华为 HAG 服务器，无 LLM 中间层

选择对接 OpenClaw 模式的理由：
1. 直连华为 HAG，无 LLM 中间层 → 低延迟、完全可控
2. 协议已知（`@ynhcj/xiaoyi` npm 包已公开源码）
3. Cat Cafe 直接作为 WebSocket 客户端连接 HAG，用户无需额外部署

**trade-off**：OpenClaw 模式不支持快捷指令、端侧插件、账号绑定、卡片等平台侧高级功能。
MVP 聚焦文本对话链路，这些高级功能不在本 feature 范围内。

## What

### 架构

```
用户 → 小艺 APP → 华为 HAG Server ←──WebSocket──→ XiaoYiAdapter (Cat Cafe)
                  (wss://hag.cloud.huawei.com        │
                   /openclaw/v1/ws/link)              ├→ Connector Gateway
                                                      │   ├→ Principal Link
                                                      │   ├→ Session Binding
                                                      │   └→ Command Layer
                                                      └→ Agent Router → Cat Agents
```

连接方向：**Cat Cafe 主动连接华为 HAG**（类似 DingTalk Stream 模式）。

### 核心 ID

| ID | 来源 | 生命周期 | 用途 |
|----|------|---------|------|
| `params.sessionId` | 华为 HAG 下发 | 跨 app 重启稳定 | 对话标识 → 映射到 Cat Cafe thread |
| `msg.sessionId`（顶层） | 华为 HAG 下发 | **每次开 app 刷新** | **不用！** 不稳定，已知坑（office-claw P1-1） |
| `params.id`（taskId） | 华为 HAG 下发 | 每条消息一个 | 回复路由 — 出站消息必须带对应 taskId |
| `agentId` | 用户在小艺平台配置 | 永久 | 标识智能体 + 用于认证 + externalChatId 命名空间 |

### 协议栈

| 层 | 技术 |
|----|------|
| 传输 | WebSocket (wss)：主 `wss://hag.cloud.huawei.com/openclaw/v1/ws/link`，备 `wss://116.63.174.231/openclaw/v1/ws/link` |
| 认证 | HMAC-SHA256: `signature = Base64(HMAC-SHA256(SK, timestamp_string))` — 注意：输入只有 timestamp，无 ak 前缀 |
| 消息 | A2A JSON-RPC 2.0，出站需两层信封（见下文） |
| 流式 | `status-update(working)` + `artifact-update('思考中…')` 占位 → `artifact-update` 逐帧推送（占位文字被替换，再逐字展示） |
| 保活 | 双机制：应用层 `{ msgType: "heartbeat", agentId }` 每 20s + WebSocket ping 每 30s（pong 超时 90s） |
| HA | 双服务器 active-active + 入站去重 (key: `sessionId+taskId`)，出站 session affinity（记录入站来源服务器，回包走同一通道） |
| 备链路 TLS | 备 IP `116.63.174.231` — IP 直连无域名 SNI，使用 `rejectUnauthorized: false`（与 `@ynhcj/xiaoyi` 参考实现一致） |

### 消息格式

入站（小艺→我们）— A2A JSON-RPC 请求：
```json
{
  "jsonrpc": "2.0",
  "method": "message/stream",
  "id": "msg-id",
  "params": {
    "id": "task-id",
    "sessionId": "user-session",
    "message": {
      "role": "user",
      "parts": [{ "kind": "text", "text": "你好" }]
    }
  }
}
```

出站（我们→小艺）— **两层信封**：

Layer 1（WebSocket 帧）：
```json
{
  "msgType": "agent_response",
  "agentId": "your-agent-id",
  "sessionId": "user-session",
  "taskId": "task-id",
  "msgDetail": "<stringified-json-rpc>"
}
```

Layer 2（msgDetail 内，序列化为字符串）：
```json
{
  "jsonrpc": "2.0",
  "id": "msg_1714600000000",
  "result": {
    "taskId": "task-id",
    "kind": "artifact-update",
    "append": false,
    "lastChunk": true,
    "final": true,
    "artifact": {
      "artifactId": "artifact_1714600000000",
      "parts": [{ "kind": "text", "text": "你好！" }]
    }
  }
}
```

其它 msgType：`clawd_bot_init`（连接后立即发）、`heartbeat`（每 20s）

**append 语义**：`false` = 替换整个 artifact 内容，`true` = 追加（必须只发 delta）

**流式序列**（单猫）：
1. `status-update(working)` — 设 task 状态（不带 message 文字！HAG 会把 message 渲染为持久条目）
2. `artifact-update('思考中…', append: false, final: false)` — 占位文字（后续会被替换）
3. `artifact-update(append: false)` — 首个 chunk，替换占位文字
4. `artifact-update(append: true)` — 后续 chunk，追加 delta 文本
5. `status-update(completed, final: true)` — 标记完成（`final` 跟随 state：working→false，completed/failed→true）
6. `artifact-update(lastChunk: true, final: true)` — 关闭 task

**多猫聚合**：多只猫的回复通过 `replyParts` Map 累积，以 replace 模式（`append:false`）发送完整文本，用 `---` 分隔。3s debounce 后发 final:true 关闭 task；新猫的 `sendPlaceholder` 取消 timer 继续等待。

**三层 timer 防御**：
- `STATUS_KEEPALIVE_MS = 20s` — 周期性 status-update(working) 防止 HAG 超时
- `DEFERRED_FINAL_MS = 3s` — 最后一次 sendReply 后的 debounce，等待多猫聚合
- `TASK_TIMEOUT_MS = 120s` — 僵尸任务安全网

### Phase A: P0 MVP

**目标**：跑通小艺↔Cat Cafe 文本对话链路。

1. **XiaoYiAdapter** — 新增 connector adapter
   - 实现 `IStreamableOutboundAdapter`
   - WebSocket 连接管理（connect / auth / heartbeat / reconnect）
   - 双服务器 active-active + session affinity
   - **taskId 生命周期**：per-session FIFO 队列 (`taskQueue`) + invocation 级绑定 (`claimTask`)。`sendPlaceholder` claim 队列中第一个未绑定 task，`sendReply` 通过 `activeTask` 绑定路由到正确 task。3s debounce 后 emitFinal + dequeue。
   - **协议层抽离**：`xiaoyi-protocol.ts` — 常量、类型、auth、message builders（质量门控文件大小合规）

2. **协议层**
   - `clawd_bot_init` 注册
   - `message/stream` 入站解析 → 标准 InboundMessage
   - `agent_response` 出站格式化：`status-update(working)` 占位 → `artifact-update` 逐帧推送 → `status-update(completed)` 收尾
   - `tasks/cancel` / `clearContext` 处理
   - 流式输出：收到请求立即发 `status-update(working)` + `artifact-update('思考中…')` 占位，首 token 到达后 `artifact-update(append:false)` 替换占位文字

3. **Gateway 集成**
   - Principal Link: `connectorId=xiaoyi`, `externalChatId=${agentId}:${params.sessionId}`, `externalSenderId=owner:{agentId}`
   - Session Binding: `params.sessionId` → threadId（注意：必须用 `params.sessionId`，不是顶层 `msg.sessionId`，后者每次打开 app 会刷新）
   - 用户身份：所有小艺对话归属 connector 配置者（OpenClaw 无用户级标识）
   - Command Layer: `/new` `/threads` `/use` `/where` `/thread`
   - Bootstrap 注册

4. **热加载**
   - .env 中添加 `XIAOYI_AK` / `XIAOYI_SK` / `XIAOYI_AGENT_ID` 后自动检测并连接
   - 集成点：`connector-secrets-allowlist` 注册 env key → `connector-reload-subscriber` 监听变更 → `connector-gateway-bootstrap` 初始化/销毁 adapter → `connector-hub` 注册平台配置项 + 状态页

### Phase B: P1 增强（后续）

| 能力 | 说明 |
|------|------|
| 图片/文件收发 | `kind: "file"` parts 解析 + 发送 |
| 推理过程展示 | `kind: "reasoningText"` 透传 |
| Push 通知 | 异步长耗时任务完成回调 |

## Acceptance Criteria

### Phase A (P0 MVP)

- [ ] AC-A1: XiaoYiAdapter 通过 WebSocket 连接华为 HAG 并完成 HMAC-SHA256 认证
- [ ] AC-A2: 双服务器 HA — active-active 双连接 + 入站去重 (`sessionId+taskId`)，出站 session affinity
- [ ] AC-A3: 双机制心跳保活（应用层 20s + WS ping 30s）+ 断线指数退避重连（max 10 次）
- [ ] AC-A4: 用户在小艺 APP 发送文本，猫猫收到并回复，小艺端展示回复
- [ ] AC-A5: 流式输出 — 先发 `status-update(working)` + `artifact-update('思考中…')` 占位，首 token 到达后替换并逐字展示
- [ ] AC-A6: Principal Link 正确建立 — `externalChatId=${agentId}:${params.sessionId}`, `externalSenderId=owner:{agentId}`
- [ ] AC-A7: Session Binding — `params.sessionId` 映射 thread；`/new` `/threads` `/use` `/thread` 正常工作
- [ ] AC-A8: 热加载 — `XIAOYI_AK/SK/AGENT_ID` 写入 .env 后自动连接；含 allowlist + hub + bootstrap + 状态页全链路

## Dependencies

- **Evolved from**: F088 (Multi-Platform Chat Gateway)，复用三层 connector 架构
- **Related**: F132 (DingTalk/WeCom)，DingTalk Stream 模式是最接近的参考实现
- **Related**: F143 (Hostable Agent Runtime)，统一 adapter 接口
- **External**: 华为小艺开放平台 OpenClaw 模式、HAG WebSocket 端点
- **ADR**: [ADR-014](/decisions/014-xiaoyi-connector-gateway.md) — 完整架构设计、核心 ID、双服务器 HA、流式输出

## Risk

| Risk | Mitigation |
|------|------------|
| 华为 HAG WebSocket 协议变更 | `@ynhcj/xiaoyi` 79 版本活跃迭代，可跟踪其更新 |
| OpenClaw 模式平台功能受限 | MVP 聚焦文本对话，高级功能不在本 feature 范围 |
| 无用户级标识（OpenClaw 固有限制） | 用 `owner:{agentId}` 做 senderId，所有对话归属 connector 配置者 |
| A2A 两个 sessionId 易混淆 | 强制用 `params.sessionId`（稳定），忽略顶层 `msg.sessionId`（不稳定） |
| 双服务器 active-active 复杂性 | 入站去重 `sessionId+taskId`；出站 session affinity 记录来源服务器；备 IP TLS 需显式信任华为 CA |

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | 选择 OpenClaw 模式而非多Agents模式 | 无 LLM 中间层，直连低延迟 | 2026-04-01 |
| 2 | Cat Cafe 内置适配而非部署 OpenClaw 实例 | 减少用户运维负担，一跳直连 | 2026-04-01 |
| 3 | `externalSenderId` 绑定 `owner:{agentId}` | OpenClaw 无用户级标识，所有对话归属 connector 配置者 | 2026-04-01 |
| 4 | 使用 `params.sessionId` 而非顶层 `msg.sessionId` | 顶层 sessionId 每次打开 app 刷新；params 内的跨会话稳定（office-claw P1-1 实测验证） | 2026-04-01 |
| 5 | 不做多小艺 agent 接入 | 单账号单 agent，scope 聚焦 | 2026-04-01 |
| 6 | adapter 内置 task 生命周期管理 | 流式出站必须带 taskId 回包；现有 `IStreamableOutboundAdapter` 接口不携带此上下文，由 adapter 内部 FIFO 队列 + invocation 级绑定管理（缅因猫 review R4/R5） | 2026-04-01 |
| 7 | `externalChatId` 带 `agentId:` 前缀 | 隔离命名空间，确保 binding key 全局唯一（缅因猫 review） | 2026-04-01 |
| 8 | status-update `final` 跟随 state | `final: state !== 'working'`。working→false，completed/failed→true。占位文字用 artifact-update 而非 status message（HAG 把 message 渲染为持久条目，真机验证 2026-04-03） | 2026-04-03 |
| 9 | 多猫 replyParts 聚合 + 3s debounce | 小艺 task 生命周期限制（一个 task 只能有一个 artifact），多猫回复必须在同一 artifact 内聚合 | 2026-04-03 |
| 10 | invocation 级 task 绑定 (claimTask) | 队列头推断在 QueueProcessor 立即启动下一 invocation 时有 3s 竞态窗口；改用 claimTask 跳过已绑定 task（缅因猫 review R5） | 2026-04-03 |

## Review Gate

- Phase A: 缅因猫 review + 铲屎官真机验证
