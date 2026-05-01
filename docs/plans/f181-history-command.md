# F181 /history Command Implementation Plan

**Feature:** F181 — `docs/features/F181-thread-re-entry-commands.md`
**Goal:** Add `/history` connector command so users can see recent conversation rounds when switching back to a thread in IM
**Acceptance Criteria:**
- AC-1: `/history` defaults to latest 1 round
- AC-2: `/history N` supports N=1~5
- AC-3: Round splitting correct (user message = boundary, multi-cat replies in same round)
- AC-4: Streaming messages excluded
- AC-5: Parallel with cat output, no blocking
- AC-6: Unit tests
- AC-7: Feishu + WeCom rendering
**Architecture:** Register in core-commands.ts, add handleHistory to ConnectorCommandLayer. Round splitting: walk MessageStore backwards, user messages (catId === null) are boundaries. Truncate content for IM rendering.
**前端验证:** No — pure backend connector command

---

## Task 1: Register `/history` command

**Files:**
- Modify: `packages/shared/src/core-commands.ts`

**Step 1:** Add entry to CORE_COMMANDS array after `/status`:

```typescript
{
  name: '/history',
  usage: '/history [N]',
  description: '查看本线程最近对话（按轮次）',
  category: 'connector',
  surface: 'connector',
  source: 'core',
},
```

**Step 2:** Run: `cd packages/shared && pnpm build`

**Step 3:** Commit: `feat(F181): register /history command [宪宪/Opus-46🐾]`

---

## Task 2: Add CommandResult kind + deps

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`

**Step 1:** Add `'history'` to `CommandResult.kind` union (after `'status'`)

**Step 2:** Add `messageStore` to `ConnectorCommandLayerDeps`:

```typescript
readonly messageStore?: {
  getByThread(threadId: string, limit?: number, userId?: string):
    StoredMessage[] | Promise<StoredMessage[]>;
};
```

Import `StoredMessage` type or use inline minimal type (only need `catId`, `content`, `timestamp`, `source`, `deliveryStatus`, `deletedAt`).

---

## Task 3: Write failing test for `/history`

**Files:**
- Modify: `packages/api/test/connector-command-layer.test.js`

**Step 1:** Add `stubMessageStore` helper:

```javascript
function stubMessageStore(messages = []) {
  return {
    getByThread: async (threadId, limit) => {
      return messages
        .filter(m => m.threadId === threadId && !m.deletedAt && (!m.deliveryStatus || m.deliveryStatus === 'delivered'))
        .slice(-(limit ?? 50));
    },
  };
}
```

**Step 2:** Write tests:

```javascript
describe('/history', () => {
  it('returns latest 1 round by default', async () => {
    const messages = [
      { id: '001', threadId: 't1', catId: null, content: '连接池设几个？', timestamp: 1000 },
      { id: '002', threadId: 't1', catId: 'opus', content: '建议 3 个', timestamp: 2000 },
    ];
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore({ connectorId: 'feishu', externalChatId: 'chat1', threadId: 't1', userId: 'u1' }),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore(messages),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history');
    assert.equal(result.kind, 'history');
    assert.ok(result.response.includes('连接池设几个'));
    assert.ok(result.response.includes('建议 3 个'));
  });

  it('/history 2 returns 2 rounds', async () => {
    const messages = [
      { id: '001', threadId: 't1', catId: null, content: 'Round 1 question', timestamp: 1000 },
      { id: '002', threadId: 't1', catId: 'opus', content: 'Round 1 answer', timestamp: 2000 },
      { id: '003', threadId: 't1', catId: null, content: 'Round 2 question', timestamp: 3000 },
      { id: '004', threadId: 't1', catId: 'opus', content: 'Round 2 answer', timestamp: 4000 },
    ];
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore({ connectorId: 'feishu', externalChatId: 'chat1', threadId: 't1', userId: 'u1' }),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore(messages),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history 2');
    assert.equal(result.kind, 'history');
    assert.ok(result.response.includes('Round 1 question'));
    assert.ok(result.response.includes('Round 2 answer'));
  });

  it('groups multi-cat replies into same round', async () => {
    const messages = [
      { id: '001', threadId: 't1', catId: null, content: '请 review', timestamp: 1000 },
      { id: '002', threadId: 't1', catId: 'opus', content: '宪宪的回复', timestamp: 2000 },
      { id: '003', threadId: 't1', catId: 'codex', content: '砚砚的回复', timestamp: 3000 },
    ];
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore({ connectorId: 'feishu', externalChatId: 'chat1', threadId: 't1', userId: 'u1' }),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore(messages),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history');
    assert.ok(result.response.includes('宪宪的回复'));
    assert.ok(result.response.includes('砚砚的回复'));
  });

  it('returns empty message for thread with no messages', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore({ connectorId: 'feishu', externalChatId: 'chat1', threadId: 't1', userId: 'u1' }),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore([]),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history');
    assert.equal(result.kind, 'history');
    assert.ok(result.response.includes('还没有消息'));
  });

  it('rejects N > 5', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore({ connectorId: 'feishu', externalChatId: 'chat1', threadId: 't1', userId: 'u1' }),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore([]),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history 10');
    assert.ok(result.response.includes('1-5'));
  });

  it('no binding returns prompt', async () => {
    const layer = new ConnectorCommandLayer({
      bindingStore: stubStore(null),
      threadStore: stubThreadStore(),
      frontendBaseUrl: 'https://cafe.example.com',
      messageStore: stubMessageStore([]),
    });
    const result = await layer.handle('feishu', 'chat1', 'u1', '/history');
    assert.equal(result.kind, 'history');
    assert.ok(result.response.includes('没有绑定'));
  });
});
```

**Step 3:** Run: `cd packages/api && node --test test/connector-command-layer.test.js`
Expected: FAIL (handleHistory not implemented)

---

## Task 4: Implement handleHistory

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`

**Step 1:** Add case in `handle()` switch:

```typescript
case '/history':
  return this.handleHistory(connectorId, externalChatId, userId, cmdArgs);
```

**Step 2:** Implement `handleHistory`:

```typescript
private async handleHistory(
  connectorId: string,
  externalChatId: string,
  userId: string,
  args: string,
): Promise<CommandResult> {
  const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
  if (!binding) {
    return { kind: 'history', response: '📍 当前没有绑定的 thread。用 /new 创建或发送消息自动创建。' };
  }

  const roundCount = args.trim() ? parseInt(args.trim(), 10) : 1;
  if (isNaN(roundCount) || roundCount < 1 || roundCount > 5) {
    return { kind: 'history', response: '❌ 用法: /history [1-5]（默认 1 轮）', contextThreadId: binding.threadId };
  }

  if (!this.deps.messageStore) {
    return { kind: 'history', response: '❌ 消息存储不可用', contextThreadId: binding.threadId };
  }

  const messages = await this.deps.messageStore.getByThread(binding.threadId, 100, userId);
  if (messages.length === 0) {
    return { kind: 'history', response: '📜 本线程还没有消息。', contextThreadId: binding.threadId };
  }

  // Split into rounds: user message (catId === null) = boundary
  const rounds: Array<typeof messages> = [];
  let currentRound: typeof messages = [];

  for (const msg of messages) {
    if (msg.catId === null && currentRound.length > 0) {
      rounds.push(currentRound);
      currentRound = [];
    }
    currentRound.push(msg);
  }
  if (currentRound.length > 0) rounds.push(currentRound);

  // Take the last N rounds
  const selected = rounds.slice(-roundCount);

  // Format
  const MAX_CONTENT = 200;
  const lines: string[] = [];
  for (const round of selected) {
    for (const msg of round) {
      const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const sender = msg.catId ? `🐱 ${msg.catId}` : '👤 你';
      const content = msg.content.length > MAX_CONTENT
        ? msg.content.slice(0, MAX_CONTENT) + '…'
        : msg.content;
      lines.push(`**${sender}** [${time}]: ${content}`);
    }
    lines.push('---');
  }
  // Remove trailing separator
  if (lines[lines.length - 1] === '---') lines.pop();

  const header = roundCount === 1 ? '📜 最近 1 轮对话：' : `📜 最近 ${selected.length} 轮对话：`;
  return {
    kind: 'history',
    response: `${header}\n\n${lines.join('\n')}`,
    contextThreadId: binding.threadId,
  };
}
```

**Step 3:** Run tests: `cd packages/api && node --test test/connector-command-layer.test.js`
Expected: ALL PASS

**Step 4:** Run full check: `pnpm check && pnpm lint`

**Step 5:** Commit: `feat(F181): implement /history connector command [宪宪/Opus-46🐾]`

---

## Task 5: Wire messageStore into ConnectorCommandLayer at startup

**Files:**
- Modify: wherever `ConnectorCommandLayer` is instantiated (likely `packages/api/src/index.ts` or similar startup file)

**Step 1:** Find instantiation site, add `messageStore` to deps

**Step 2:** Run integration test: `cd packages/api && node --test`

**Step 3:** Commit: `feat(F181): wire messageStore into ConnectorCommandLayer [宪宪/Opus-46🐾]`

---

## Verification

- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `node --test test/connector-command-layer.test.js` — all /history tests pass
- [ ] Manual test: send `/history` in Feishu/WeCom connector → see formatted output
