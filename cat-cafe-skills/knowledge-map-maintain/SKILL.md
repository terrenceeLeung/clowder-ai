---
name: knowledge-map-maintain
description: >
  扫描 evidence_docs 对比 knowledge-map.yaml，LLM 辅助分类未归入的 anchor。
  Use when: maintainer 手动触发知识图谱维护，需要整理未分类的 evidence anchor。
  Not for: 自动触发、新模块创建（需 CVO 决策）。
  Output: 分类建议 rich block → 确认后更新 knowledge-map.yaml 并 commit。
triggers:
  - "knowledge map maintain"
  - "知识图谱维护"
  - "整理知识图谱"
  - "knowledge-map"
  - "更新 knowledge map"
---

# Knowledge Map Maintain — 知识图谱分类维护

你是 maintainer 的知识整理助手。任务：找出 evidence_docs 中未被 `docs/knowledge-map.yaml` 收录的 anchor，用 LLM 辅助分类到合适模块。

**设计原则**：触发不做自动化（maintainer 手动调用），分类做自动化（LLM 辅助）。新模块创建需 CVO 审批。

---

## Step 1: 获取未分类 anchor

调用 `GET /api/evidence/unclassified` 获取未分类 anchor 列表。

如果 API 不可用，告知 maintainer："unclassified API 不可用，无法获取完整未分类列表。请检查 API 服务状态后重试。" 然后中止。不要尝试用 search_evidence 做不完备的差集。

**如果没有未分类 anchor**：告知 maintainer "知识图谱已完整，无需更新"，结束。

---

## Step 2: 加载模块上下文

读取 `docs/knowledge-map.yaml` 的模块定义，构建分类上下文：

对每个模块，整理：
- `name`：模块名称
- `description`：模块描述（语义锚点）
- 已有 anchors 列表（作为同类参考）

---

## Step 3: LLM 分类

对每个未分类 anchor，基于其 `kind`、`title`、`anchor` 格式，匹配最合适的模块：

分类规则：
1. anchor 以 `F` 开头 + 数字 → feature，对比各模块已有 feature 的主题归类
2. anchor 以 `doc:decisions/` 开头 → decision，对比各模块已有 decision 的领域归类
3. 其他格式（lesson、research、session 等）→ 根据 title 语义与模块 description 匹配

分类结果分两类：
- **可归入现有模块**：指定目标模块 + 理由
- **建议新模块**：说明为什么现有模块都不合适 + 建议的模块名和 description

---

## Step 4: 展示分类结果

通过 rich block 展示分类建议，格式：

```
📋 Knowledge Map 分类建议

已分类: {classifiedCount} / 总计: {total}
未分类: {unclassifiedCount}

── 归入现有模块 ──

模块: {moduleName}
  + {anchor} ({kind}) — {title}  理由: {reason}
  + {anchor} ({kind}) — {title}  理由: {reason}

模块: {moduleName}
  + {anchor} ({kind}) — {title}  理由: {reason}

── 建议新模块（需 CVO 决策） ──

建议模块: {suggestedName}
  描述: {suggestedDescription}
  + {anchor} ({kind}) — {title}

请确认分类建议，我将更新 knowledge-map.yaml 并提交。
```

等待 maintainer 确认。

---

## Step 5: 执行更新

收到确认后：

1. 读取当前 `docs/knowledge-map.yaml`
2. 将确认的 anchor 追加到对应模块的 `anchors` 列表
3. 如果 CVO 批准了新模块，添加新模块（含 name + description + anchors）
4. 写入更新后的 YAML
5. git add + commit：`chore(F169): update knowledge-map — classify {N} anchors`

**注意**：不要自行创建新模块，即使 LLM 建议了也要等 CVO 明确批准。

---

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 自行创建新模块 | 新模块需 CVO 审批，只能建议不能执行 |
| 把 session/thread 类 anchor 硬塞进 feature 模块 | 按 kind + title 语义匹配，不确定就标「建议新模块」 |
| 跳过 rich block 直接改 YAML | 必须先展示分类建议等 maintainer 确认 |
| API 不可用时放弃 | 用降级方案（read YAML + search_evidence 做差集） |
| 分类时只看 anchor ID 不看 title | anchor 格式只是初筛，title 语义是最终判断依据 |
