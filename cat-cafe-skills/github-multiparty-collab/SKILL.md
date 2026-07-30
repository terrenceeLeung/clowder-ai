---
name: github-multiparty-collab
description: >
  多单位基于 GitHub PR+Issue 协作的外交协议：治理发现（先读 repo 声明的制度再启用协议）、
  唯一 writer 制（改 vs 通知）、Issue 契约回写闭环、裁决-落地-验收环（三层 ack 模型 + 版本锚定）、
  以 operator 名义发言的过目铁则。
  Use when: 与外部单位（其他 GitHub 账号的人类+AI 组合）在共享 repo 协作、跨单位设计收敛/合同冻结、
  发现别人权威文档的问题、里程碑后同步 Issue/PR 状态、准备以 operator 名义发 comment。
  Not for: 家内猫协作（用 cross-cat-handoff / request-review）、单团队自己 repo 的合入（用 merge-gate）。
  Output: governance profile + 合规的 GitHub comment / Issue 回写闭环 / 分类验收结论。
triggers:
  - "外部单位"
  - "跨单位"
  - "多方协作"
  - "multiparty"
  - "唯一 writer"
  - "writer 制"
  - "re-ack"
  - "boundary ack"
  - "以 operator 名义"
  - "跨单位设计收敛"
  - "contract freeze"
---

# GitHub Multiparty Collab — 跨单位协作外交协议

跨单位协作没有共享记忆/家规/信任，唯一共享真相 = repo 里的字。一切协议围绕**字的所有权、字的验收、字的状态同步**。每条规则来自真实翻车或 operator 重复纠偏，不是想象的最佳实践。

## 三类规则（先分清，再执行——条件化落到每个反射入口）

| 类别 | 含义 | 协议 |
|---|---|---|
| **恒定** | 无论对方 repo 什么制度都成立 | 1 身份 / 6 发言 / 7 不越权 |
| **profile 条件** | 仅当 repo **声明**了对应制度才启用 | 2 writer 制 / 3 契约回写 / 4 收敛环的 gate 制度 |
| **可移植方法** | 不依赖对方制度，术语映射到 repo 原生状态 | 版本锚、scope 限定表态、逐 diff 验收 |

## 协议 0：治理发现（进场第一步，产出 governance profile）

读协作声明载体（Epic issue / CONTRIBUTING / CODEOWNERS / 设计 README / roadmap），回答五元组：
**单位映射**（账号↔单位，谁是 maintainer/authority）；**truth 制度**（有无声明 writer/steward，粒度）；
**契约载体**（claim/决策/依赖记在哪）；**收敛制度**（ack 语义、gate 谁维护、响应检测 push/pull、SLA、触达 actor/channel）；
**不可逆权限**（merge/close 归谁——人、角色、还是声明的 bot 流程）。
**profile 声明了某制度 → 启用对应条件协议；没有声明 → 按 repo 原生流程行事**（如 CODEOWNERS+PR review
就是合法修错路径），不得把本 skill 的制度强加给对方（最多作为提议发出）。

## 协议 1：身份只认 GitHub 账号 [恒定]

判断"这是谁"的唯一依据 = GitHub 账号——对方单位的 AI 可能与自家猫**同名同模型**（实证撞过两次），
@ 前核对账号归属。**review independence 按账号/单位计**：同账号下不同 AI 互审不构成跨个体 review。

## 协议 2：唯一 writer 制 —— 改 vs 通知判断树 [profile 条件]

```
repo 声明了 writer 制（协议 0）？
├─ 否 → 按 repo 原生流程（开 PR / 走 CODEOWNERS review 即合法）
└─ 是 → truth 的 writer 是我方？
    ├─ 是 → 直接改（自己 scope 自治）
    └─ 否 → 不代写。带证据通知 owner 自更：引用原文 + 问题 + 建议措辞（落笔权在 owner）
```

镜像场景——别人的 PR 动了我方 truth：语义变更 → **请求撤回**（恢复基线，我方 writer 主导收敛）；
方向可取但越权 → **请求转提案**（我方 writer 裁决后落地）。
双向义务：自己的 PR 动了别人 scope，合入前主动挂对方 ack 依赖。

## 协议 3：契约回写闭环 + paper trail [profile 条件]

契约不回写 = 过时 = 下游按旧状态决策。**回写是闭环，不是发个通知**：

1. **枚举**受影响 artifact：从 Epic/claim/dependency/PR 显式链接列出本次里程碑 touched 的契约载体（触发点：PR 合入 / 裁决落定 / 认领确认 / DRI 变更 / gate 状态变化）
2. **分流**：我方 owned → 直改；别方 truth → 通知（旧值+证据 SHA+建议新值+@owner）并登记 pending
3. **完成定义**：别方项 = 看到 owner durable 回写**并逐字段核验**后才完成；只发通知评论 ≠ 完成
4. **发出 ≠ 送达**：不假设对方挂了自动监听（通知会沉底）。pending 台账 durable 登记（事项/对方/时间/链接）；响应检测**照 profile 声明**（push 订阅 / pull 巡检），**未声明时安全默认 pull**（喊查 / 进场顺路查）且不擅建订阅或触达通道；已响应→核验关闭；有 SLA 且超窗→由 profile 授权的 actor 走声明通道触达提醒；**无 SLA→只报告 pending 年龄并提议 SLA**——不自拟超时、不代触达、不假完成、不代改、不静默放弃
5. **线下通道聊出的结论 → 回写 repo 落字才生效**（触达通道不是真相通道）；paper trail：取代旧评论 → 编辑原评论顶部标注「已被 X 取代」或搭车主线通报，不去别人 issue 刷屏

## 协议 4：裁决-落地-验收环 —— 三层 ack 模型（细则+话术见 `refs/adjudication-loop.md`）

环：`意见（锚定版本）→ owner 落地（报新版本请求 re-ack）→ 验收（逐 diff + 残留分类，不信 claim）→ scope ack / 指出偏差 → 循环`

三层各归其位：**scope ack** [方法]——各受影响 writer 只对 `(artifact, version, 自己的 scope)` 表态；
**聚合 gate** [profile]——gate/status owner（按 profile，常为 PR author）聚齐 required acks 后更新状态；
**不可逆** [profile]——profile 声明的 authority 拍 merge/close。落地方不自证收敛；验收方不宣告全局 gate。
- **版本锚** [方法]：不带锚的 ack 无效（单 PR=SHA；跨 PR/repo=version matrix）；表态用结构化词（`ACCEPTED / ACCEPTED_WITH_CHANGES / REJECTED`、`X BOUNDARY ACK`），不用模糊语言。
- **缺席语义**：required ack pending **仍阻塞其聚合 gate closure**；不阻塞的只是无关工作与独立 gate。
  缺席≠同意，返回后补背书；pending 状态 durable 写进主线载体。

## 协议 5：一人多角色逐角色表态 + scope 限定 [方法]

同一账号身兼多角色 → 表态分部、每部标注角色。每次表态声明覆盖范围（「本评论只覆盖 X scope，
不替 Y 背书」）——沉默不是背书，但不声明会被当成背书。

## 协议 6：以 operator 名义发言的过目铁则 [恒定]

区分维度是**立场归属声明**，不是发帖账号（单账号单位里 operator 与 AI 共用账号）：
- **代表 operator 立场**：批准绑定 **exact final text + 目标位置 + 角色署名**——operator 逐字过目（大白话/时序例子讲到真懂）后才发；实质改写或换目标 = 重新过目。实证教训：未过目发出被要求删评论。
- **AI 起草/补充意见**：正文尾部起草署名（如「起草：<AI 个体名>/<模型型号>」），立场归属清晰。

## 协议 7：不越权 —— 双授权边界 [恒定]

不可逆动作（merge/close/删除）同时受两个边界约束，**都不越**：
- **repo authority**（profile 五元组之五）：声明归人 → 备好「合入条件快照」（谁 ack 了什么版本、谁 pending）交其拍板；声明是 bot 流程（如 auto-merge）→ 那就是合法 gate，不阻断、不强加人工点击
- **家内授权**：不可逆动作按家规升级 operator；不擅自启用新流程、不绕过 repo 声明的 review 要求

## Quick Reference：触发点 → 反射动作

| 触发点 | 反射 |
|---|---|
| 进入新的多方 repo | 跑协议 0 填 profile——后面所有反射都以它为前提 |
| 发现别人文档的错 | 有 writer 制 → 通知 owner 自更；无 → 按 repo 原生流程（开 PR 即合法） |
| 对方报「已修复」 | 逐 diff 验收 + 残留分类，然后才 scope ack |
| 自己落地完裁决 | 报版本请求 re-ack，不自宣收口 |
| PR 合入 / 裁决落定 | 枚举受影响契约载体，回写闭环跟到 durable |
| 要 @ 某个"熟悉的名字" | 先核对 GitHub 账号 |
| 准备以 operator 名义发言 | exact text + 目标绑定过目 |
| required ack 齐了 | gate owner 更新 gate；不可逆动作交 profile authority + 家内授权 |

## Common Mistakes（全部实证）

| 错误 | 后果 | 修复 |
|---|---|---|
| 把 writer 制/Issue 契约当 GitHub 通则 | 对无此制度的 repo 强加流程（误撤合法 PR、找不存在的 owner、阻断 bot gate） | 协议 0 先发现；无声明按原生流程 |
| 起草代发别人 truth 的修正 | operator 纠偏；越权破坏 writer 制 | 带证据+建议措辞通知 owner |
| 发了回写通知就当完成 | 契约仍过时，下游误导 | 追到 owner durable 回写并核验 |
| comment 未过目以 operator 名义发出 | 被要求删评论 | exact text + 目标绑定过目 |
| 按昵称/模型判断身份 | @ 错撞名对象（实证踩过） | 只认 GitHub 账号 |
| 表态/ack 不带版本锚 | 版本错位——ack 的和现状不是一个东西 | SHA / version matrix 锚定 |
| gate 状态越权（落地方自宣 closed / 验收方宣告全局关闭） | 抢走确认权 / 聚合权 | 三层各归其位（协议 4） |
| 要求验收 grep 一律 0 命中 | 误杀防御性 provenance 记录 | 命中分类：活语义=0，防御性逐项解释 |
| 表态不限定 scope | 被当成全局背书 | 明写"本评论只覆盖 X scope" |

## Pressure Test（发布/修订必跑）

两组 subagent 盲测回放（**越权诱因** / **通则误用**），场景与判据见 `refs/pressure-tests.md`——**两组全 PASS 才可发布**。

## 触发边界

- ✅ 多单位共享 repo 设计收敛/合同冻结（profile 声明制度→条件协议全开）；任何多方协作进场→先跑协议 0
- ❌ 家内猫互审代码 → `request-review` / `receive-review`
- ❌ 单团队自己 repo 的 PR 合入门禁 → `merge-gate`
- ⚠️ 灰例 1：家内猫在同一外部 repo 协作——家内沟通走家规，面向外部的动作走本 skill
- ⚠️ 灰例 2：无治理声明的外部 repo——恒定协议（1/6/7）+ 可移植方法生效；2/3/4 的 gate 制度按原生流程

## 相关 skill 与下一步

- `cross-cat-handoff` 是家内交接的**信息结构**，本 skill 是跨单位的**权利结构**；`merge-gate` 管自己
  repo 合入门禁；`receive-review` 处理上下级式反馈——本 skill 的裁决环是**对等单位间**双向收敛。
- 裁决环实操/五幕话术/分类验收 → `refs/adjudication-loop.md`；修订本 skill → 跑 `refs/pressure-tests.md`；
  收敛完成合入自己 repo → `merge-gate`。
