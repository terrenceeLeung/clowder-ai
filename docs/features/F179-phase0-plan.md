---
feature_ids: [F179]
topics: [knowledge-governance, implementation-plan]
doc_kind: plan
created: 2026-05-01
---

# F179 Phase 0 Implementation Plan

**Feature:** F179 — `docs/features/F179-domain-knowledge-governance.md`
**Goal:** 用户能将 .md 领域知识导入 Evidence Store，经 LLM Normalizer 处理为三层结构，通过 hybrid 检索命中 chunk 级结果，并受治理状态机管理生命周期。
**Architecture:** 新建 `domains/knowledge/` 模块，包含 KnowledgeImporter（编排器）、Normalizer（LLM 处理）、GovernanceStateMachine（生命周期）、DomainPackManager（CRUD）、PiiDetector（安全）、KnowledgeStorage（原始文件）。所有数据写入现有 Evidence Store（evidence_docs + evidence_passages + evidence_vectors）。Schema V16 扩展 passage 列。
**Tech Stack:** TypeScript, SQLite (better-sqlite3), FTS5, vec0, node:test, Anthropic Messages API
**前端验证:** No — Phase 0 纯 API 层

**Acceptance Criteria:**

| # | 验收项 | 覆盖 Task |
|---|--------|-----------|
| AC-01 | KnowledgeImporter 独立于 Pack 系统，共享 Evidence Store | Task 7 |
| AC-02 | Normalizer 处理 .md，输出 source → document → passages 三层 | Task 5 |
| AC-03 | evidence_passages 存储 chunk 级数据（heading_path/chunk_index/char_start/char_end） | Task 1 |
| AC-04 | anchor 使用 dk:uuid，pack_id 独立可变 | Task 7 |
| AC-05 | .clowder/knowledge/ 自动 gitignored | Task 3 |
| AC-06 | 治理状态机独立运行（含 needs_review/rejected/failed） | Task 6 |
| AC-07 | Hybrid passage retrieval（BM25 + vec0）可用 | Task 8 |
| AC-08 | PII 安全边界拍板 | Task 2 |
| AC-09 | Normalizer 输出带 normalizer_version/model_id | Task 5 |
| AC-010 | 导入知识携带 authority/activation/provenance/extraction_confidence | Task 5 |
| AC-011 | Fixture demo Pack 端到端验收（MeowGrid） | Task 9 |
| AC-012 | Domain Pack CRUD + default 包自动创建 | Task 4 |
| AC-013 | 导入事务原子性 | Task 7 |
| AC-014 | evidence_passages 扩展不破坏现有 passage | Task 1 |

---

## Terminal Schema

### 新增列（Schema V16）

```sql
-- evidence_passages 扩展
ALTER TABLE evidence_passages ADD COLUMN passage_kind TEXT DEFAULT 'message';
ALTER TABLE evidence_passages ADD COLUMN heading_path TEXT;      -- JSON array
ALTER TABLE evidence_passages ADD COLUMN chunk_index INTEGER;
ALTER TABLE evidence_passages ADD COLUMN char_start INTEGER;
ALTER TABLE evidence_passages ADD COLUMN char_end INTEGER;

-- evidence_docs 扩展
ALTER TABLE evidence_docs ADD COLUMN governance_status TEXT;
ALTER TABLE evidence_docs ADD COLUMN extraction_confidence REAL;
ALTER TABLE evidence_docs ADD COLUMN doc_kind TEXT;
ALTER TABLE evidence_docs ADD COLUMN normalizer_version TEXT;
ALTER TABLE evidence_docs ADD COLUMN model_id TEXT;
ALTER TABLE evidence_docs ADD COLUMN source_updated_at TEXT;

-- domain_packs 表
CREATE TABLE IF NOT EXISTS domain_packs (
  pack_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);
```

### 核心接口

```typescript
// --- Governance ---
type GovernanceStatus =
  | 'ingested' | 'normalized' | 'needs_review'
  | 'approved' | 'active' | 'stale' | 'retired' | 'failed';

type PassageKind = 'message' | 'domain_chunk';

// --- Normalizer 输出 ---
interface NormalizedDocument {
  anchor: string;                    // dk:<uuid>
  title: string;
  summary: string;
  docKind: string;
  authority: F163Authority;          // LLM 建议值
  extractionConfidence: number;      // 0-1
  keywords: string[];
  topics: string[];
  language: string;
  normalizerVersion: string;
  modelId: string;
  chunks: NormalizedChunk[];
}

interface NormalizedChunk {
  chunkId: string;
  chunkIndex: number;
  headingPath: string[];
  contentMarkdown: string;
  plainText: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
  dedupeKey: string;
}

// --- Normalizer 依赖注入 ---
interface NormalizerLLM {
  generate(system: string, user: string): Promise<string>;
}

// --- Import ---
interface ImportResult {
  sourcePath: string;
  anchor: string | null;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  reason?: string;
  chunkCount?: number;
}

// --- PII ---
interface IPiiDetector {
  scan(text: string): PiiMatch[];
}

interface PiiMatch {
  type: 'phone' | 'id_card' | 'bank_card' | 'email';
  start: number;
  end: number;
  text: string;
}
```

---

## Task 依赖图

```
Task 1 (Schema V16) ─────────────────┐
Task 2 (PII Detector) ──┐            │
Task 3 (Storage) ──────┐ │            │
Task 4 (Domain Pack) ──┼─┼── Task 7 (Importer) ── Task 9 (E2E)
Task 5 (Normalizer) ───┤ │            │
Task 6 (Governance) ───┘ ┘            │
                        Task 8 (Search Enhancement) ┘
```

Task 1-6 可并行开发（各自独立）。Task 7 依赖 1-6。Task 8 依赖 1。Task 9 依赖全部。

---

## Task 1: Schema Migration V16

**覆盖:** AC-03, AC-014
**文件:**
- Modify: `packages/api/src/domains/memory/schema.ts:69` (CURRENT_SCHEMA_VERSION → 16)
- Modify: `packages/api/src/domains/memory/schema.ts:438-454` (add V16 migration block)
- Test: `packages/api/test/domains/memory/schema-v16.test.ts`

**实现要点:**

V16 migration block 追加在 V15 之后：
- 6 个 ALTER TABLE 加列到 evidence_passages（全部带 DEFAULT）
- 6 个 ALTER TABLE 加列到 evidence_docs（全部带 DEFAULT NULL）
- 1 个 CREATE TABLE domain_packs
- 每个 ALTER 包裹 try-catch（与 V13-V15 模式一致）
- passage_fts 触发器无需修改（只索引 content 列）

**测试:**
1. 空数据库：applyMigrations 后 evidence_passages 有 passage_kind 列
2. V15 数据库 + 已有 passages：V16 迁移后旧行 passage_kind = 'message'
3. 新行写入：INSERT evidence_passages 不带新列 → 成功（DEFAULT 值）
4. 新行写入：INSERT evidence_passages 带 passage_kind='domain_chunk' + heading_path + char_start/char_end → 成功
5. domain_packs 表存在且可 INSERT/SELECT

---

## Task 2: PII Detector（Regex）

**覆盖:** AC-08
**文件:**
- Create: `packages/api/src/domains/knowledge/PiiDetector.ts`
- Test: `packages/api/test/domains/knowledge/pii-detector.test.ts`

**实现要点:**

```typescript
const PATTERNS: Record<string, RegExp> = {
  phone: /1[3-9]\d{9}/g,
  id_card: /\d{17}[\dXx]/g,
  bank_card: /\b\d{16,19}\b/g,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
};

export class PiiDetector implements IPiiDetector {
  scan(text: string): PiiMatch[] { /* iterate patterns, collect matches */ }
}
```

**测试:**
1. 中文手机号检出（13812345678）
2. 身份证号检出（110101199001011234）
3. 银行卡号检出（6222021234567890123）
4. 邮箱检出
5. 无 PII 文本返回空数组
6. 单段文本多种 PII 同时检出
7. start/end 位置准确

---

## Task 3: Private Knowledge Storage

**覆盖:** AC-05
**文件:**
- Create: `packages/api/src/domains/knowledge/KnowledgeStorage.ts`
- Test: `packages/api/test/domains/knowledge/knowledge-storage.test.ts`

**实现要点:**

```typescript
export class KnowledgeStorage {
  constructor(private projectRoot: string) {}

  async ensureDir(): Promise<string>
  async ensureGitignore(): Promise<void>
  async saveRaw(sourceHash: string, content: string, originalName: string): Promise<string>
  async readRaw(sourceHash: string): Promise<string | null>
  async deleteRaw(sourceHash: string): Promise<void>
}
```

- 目录路径：`${projectRoot}/.clowder/knowledge/`
- gitignore 追加：检查 `.gitignore` 是否已含 `.clowder/knowledge/`，无则追加
- 文件存储：`<hash>/original.md` + `<hash>/meta.json`（原始文件名、导入时间）
- sourceHash = SHA-256(content)

**测试:**
1. ensureDir 创建目录
2. ensureGitignore 追加条目
3. ensureGitignore 不重复追加
4. saveRaw + readRaw 往返
5. deleteRaw 清理文件
6. 隔离测试：用临时目录不污染真实项目

---

## Task 4: Domain Pack Manager

**覆盖:** AC-012
**文件:**
- Create: `packages/api/src/domains/knowledge/DomainPackManager.ts`
- Test: `packages/api/test/domains/knowledge/domain-pack-manager.test.ts`

**实现要点:**

```typescript
export class DomainPackManager {
  constructor(private db: Database) {}

  ensureDefaultPack(): string          // upsert 'default' pack, return pack_id
  create(name: string, desc?: string): string   // create named pack
  list(): DomainPack[]                 // list all with doc counts
  rename(packId: string, newName: string): void
  delete(packId: string): void         // only if no active docs
}
```

- pack_id = slugify(name)（简单 lowercase + hyphen）
- 首次导入自动调用 ensureDefaultPack()
- rename 更新 domain_packs.name + evidence_docs.pack_id 在同一事务
- list 返回 JOIN domain_packs LEFT JOIN evidence_docs GROUP BY pack_id 的 doc count

**测试:**
1. ensureDefaultPack 创建 'default' 包
2. ensureDefaultPack 幂等
3. create 创建命名包
4. create 重名抛错
5. list 返回包列表含 doc count
6. rename 更新包名 + 关联文档的 pack_id
7. delete 空包成功
8. delete 有 active docs 的包拒绝

---

## Task 5: Normalizer

**覆盖:** AC-02, AC-09, AC-010
**文件:**
- Create: `packages/api/src/domains/knowledge/Normalizer.ts`
- Create: `packages/api/src/domains/knowledge/normalizer-prompt.ts`
- Test: `packages/api/test/domains/knowledge/normalizer.test.ts`

**实现要点:**

Normalizer 接收 NormalizerLLM 依赖注入（不直接依赖具体 SDK）：

```typescript
export class Normalizer {
  constructor(
    private llm: NormalizerLLM,
    private config: { version: string; modelId: string },
  ) {}

  async normalize(
    markdown: string,
    meta: { sourcePath: string; sourceHash: string },
  ): Promise<NormalizedDocument>
}
```

处理策略（按 token 估算——中文约 1.5 char/token）：
- 短文档（≤3000 字符 ≈ 2k tokens）：全文送 LLM
- 中文档（3000-12000 字符）：全文送 LLM，要求按章节分 chunk
- 长文档（>12000 字符）：heading-based 启发式预分段 → 每段独立送 LLM 摘要

LLM prompt 要求结构化 JSON 输出：
- title, summary, doc_kind, authority（建议值）
- chunks[]: heading_path, content, char_start, char_end
- keywords, topics, language
- extraction_confidence（0-1）

输出附带 config.version 和 config.modelId（AC-09）。

activation 默认 'query'——不由 LLM 决定（KD-21）。

**测试（mock LLM）：**
1. 短文档：返回 NormalizedDocument 含 title/summary/chunks
2. chunks 有 heading_path + char_start/char_end
3. 输出含 normalizerVersion + modelId
4. extractionConfidence 在 0-1 范围
5. LLM 返回异常 → 抛 NormalizerError
6. 空文档 → 抛错
7. 长文档 → 启发式预分段 + 多次 LLM 调用（验证调用次数）
8. authority 为建议值（constitutional/validated/candidate/observed 之一）
9. keywords/topics 为数组

---

## Task 6: Governance State Machine

**覆盖:** AC-06
**文件:**
- Create: `packages/api/src/domains/knowledge/GovernanceStateMachine.ts`
- Test: `packages/api/test/domains/knowledge/governance.test.ts`

**实现要点:**

```typescript
const VALID_TRANSITIONS: Record<GovernanceStatus, GovernanceStatus[]> = {
  ingested:      ['normalized', 'failed'],
  normalized:    ['needs_review', 'approved'],
  needs_review:  ['approved', 'retired'],
  approved:      ['active'],
  active:        ['stale', 'retired'],
  stale:         ['retired'],
  retired:       [],
  failed:        ['ingested'],
};

export class GovernanceStateMachine {
  constructor(private db: Database) {}

  transition(anchor: string, to: GovernanceStatus): void
  getStatus(anchor: string): GovernanceStatus | null
  listByStatus(status: GovernanceStatus, packId?: string): string[]
  autoRoute(anchor: string, confidence: number): GovernanceStatus
}
```

- transition 先读当前状态，验证 VALID_TRANSITIONS[from].includes(to)，更新 evidence_docs.governance_status
- autoRoute：confidence ≥ 0.8 → 'approved'，< 0.8 → 'needs_review'（阈值可配）
- listByStatus：SELECT anchor FROM evidence_docs WHERE governance_status = ?

**测试:**
1. ingested → normalized 成功
2. ingested → active 失败（无效跳转）
3. active → stale 成功
4. retired → 任何状态 失败（终态）
5. failed → ingested 成功（重试）
6. autoRoute：confidence=0.9 → approved
7. autoRoute：confidence=0.5 → needs_review
8. listByStatus 按状态过滤
9. getStatus 读取当前状态

---

## Task 7: Knowledge Importer（编排器）

**覆盖:** AC-01, AC-04, AC-013
**文件:**
- Create: `packages/api/src/domains/knowledge/KnowledgeImporter.ts`
- Test: `packages/api/test/domains/knowledge/knowledge-importer.test.ts`

**依赖:** Task 1-6 全部完成

**实现要点:**

```typescript
export class KnowledgeImporter {
  constructor(private deps: {
    store: IEvidenceStore;
    db: Database;
    storage: KnowledgeStorage;
    normalizer: Normalizer;
    governance: GovernanceStateMachine;
    packs: DomainPackManager;
    piiDetector: IPiiDetector;
    embedding?: IEmbeddingService;
    vectorStore?: VectorStore;
  }) {}

  async importFile(filePath: string, opts?: { packId?: string }): Promise<ImportResult>
  async importBatch(filePaths: string[], opts?: { packId?: string }): Promise<ImportResult[]>
}
```

importFile 编排流程（单一事务）：
1. 读取文件内容 + 计算 source_hash
2. **去重检查**（KD-20）：
   - 查询 evidence_docs WHERE source_path = filePath
   - source_hash 相同 → skip（返回 'skipped'）
   - source_hash 不同 → 旧文档标 stale，继续创建新版本
3. PII 扫描 → 有 PII 则标记 piiDetected（不阻断，Phase 0 只记录）
4. 存储原始文件到 .clowder/knowledge/
5. 调用 Normalizer → NormalizedDocument
6. **事务开始**（AC-013）：
   a. INSERT evidence_docs（anchor=dk:uuid, kind='pack-knowledge', governance_status='ingested'）
   b. INSERT evidence_passages × N（passage_kind='domain_chunk'）
   c. 如有 embedding → INSERT evidence_vectors × N
   d. 更新 governance_status → normalized → autoRoute
7. **事务结束**
8. 返回 ImportResult

anchor 格式：`dk:${crypto.randomUUID()}`（KD-2）。

pack_id 赋值：opts.packId ?? packs.ensureDefaultPack()（AC-012）。

**测试:**
1. 单文件导入 → evidence_docs + evidence_passages 都有数据
2. anchor 格式为 dk:uuid
3. pack_id 默认 'default'
4. 相同文件相同内容 → skip
5. 相同文件不同内容 → 新版本 + 旧版本 stale
6. 事务原子性：Normalizer 失败 → evidence_docs 无残留
7. 事务原子性：embedding 失败 → docs 和 passages 仍写入（embedding 可选）
8. PII 检测结果记录但不阻断
9. passage_kind = 'domain_chunk'
10. passages 有 heading_path / char_start / char_end

---

## Task 8: Passage Search Enhancement

**覆盖:** AC-07
**文件:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — searchPassages 方法
- Modify: `packages/api/src/routes/evidence-helpers.ts` — 结果类型扩展
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts` — 输出格式
- Test: `packages/api/test/domains/memory/passage-search-domain.test.ts`

**实现要点:**

当前 searchPassages 只搜 passage_fts(content)，不区分 passage_kind。增强：
1. 结果补充 heading_path / char_start / char_end 字段（从 evidence_passages JOIN 读取）
2. 结果补充父文档元数据（doc_kind / authority / activation / governance_status）
3. scope 新增 'knowledge' 选项——只搜 passage_kind='domain_chunk' 的行
4. EvidenceResult 类型扩展 headingPath / charStart / charEnd 可选字段
5. tool 输出格式：domain chunk 结果显示 heading path 和定位信息

**测试:**
1. domain_chunk passage 可被 BM25 命中
2. 长文档后半段 chunk 可被检索
3. 结果含 heading_path + char_start/char_end
4. 结果含父文档 authority / doc_kind
5. scope='knowledge' 过滤只返回 domain_chunk
6. scope='all' 返回 message + domain_chunk 混合
7. hybrid 模式：vec0 NN + BM25 融合 domain chunks

---

## Task 9: Fixture Demo + E2E Test

**覆盖:** AC-011
**文件:**
- Create: `packages/api/test/fixtures/meowgrid/architecture.md`
- Create: `packages/api/test/fixtures/meowgrid/operations-manual.md`（长文档，~3000 字）
- Create: `packages/api/test/fixtures/meowgrid/faq.md`
- Create: `packages/api/test/fixtures/meowgrid/troubleshooting.md`
- Test: `packages/api/test/domains/knowledge/e2e-meowgrid.test.ts`

**MeowGrid 虚构内容:**

"MeowGrid 分布式调度引擎"——虚构的分布式任务调度系统，保证不在 LLM 训练数据中。文档覆盖：
- 架构概览（短文档）：MeowGrid 的 Whisker Coordinator + PawWorker + NapQueue 组件
- 运维手册（长文档）：部署、扩缩容、监控、故障恢复——**关键操作步骤在文档后半段**
- FAQ（Q&A 格式）："如何处理 FurBall Deadlock？""NapQueue 满了怎么办？"
- 故障排查（heading-heavy）：错误码对照表、日志分析步骤

**E2E 测试流程:**
1. 创建测试用 Evidence Store + 内存 SQLite
2. 初始化全部 F179 组件
3. importBatch 导入 4 个 MeowGrid 文档
4. 验证 governance 状态链：ingested → normalized → approved/needs_review → active
5. **固定 query set 检索验证:**
   - "MeowGrid 故障恢复步骤" → 命中运维手册后半段 chunk
   - "FurBall Deadlock 处理方法" → 命中 FAQ 对应条目
   - "PawWorker 扩缩容" → 命中运维手册相关章节
   - "Whisker Coordinator 架构" → 命中架构文档
6. 每个结果验证：有 heading_path, char_start/char_end, authority, doc_kind
7. 输出 Recall@5 和 Precision@5 baseline 数值（不设阈值）

---

## LLM 适配器（Normalizer 依赖）

Phase 0 提供 Anthropic Messages API 适配器：

```typescript
// packages/api/src/domains/knowledge/adapters/anthropic-normalizer.ts
import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicNormalizer(config: {
  apiKey: string;
  model: string;
}): NormalizerLLM {
  const client = new Anthropic({ apiKey: config.apiKey });
  return {
    async generate(system, user) {
      const msg = await client.messages.create({
        model: config.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return msg.content[0].type === 'text' ? msg.content[0].text : '';
    },
  };
}
```

需要新增依赖：`@anthropic-ai/sdk`。

---

## 实施顺序建议

```
Week 1: Task 1 (Schema) + Task 2 (PII) + Task 3 (Storage) — 基础设施
Week 2: Task 4 (Packs) + Task 5 (Normalizer) + Task 6 (Governance) — 核心能力
Week 3: Task 7 (Importer) + Task 8 (Search) — 集成
Week 4: Task 9 (E2E) — 验收
```

Task 1-3 无依赖可并行。Task 4-6 无互相依赖也可并行。Task 7 是集成点，需等 1-6。Task 8 只依赖 Task 1。Task 9 依赖全部。
