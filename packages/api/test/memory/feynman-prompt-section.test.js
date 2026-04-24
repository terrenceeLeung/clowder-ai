import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFeynmanPromptLines } from '../../dist/domains/cats/services/context/FeynmanPromptSection.js';

describe('buildFeynmanPromptLines', () => {
  const baseInput = {
    feynmanState: {
      v: 1,
      module: 'memory',
      anchors: ['F102', 'F163'],
      status: 'active',
      startedAt: Date.now(),
    },
    module: {
      name: '记忆与知识工程',
      description: '记忆存储与检索',
      anchors: ['F102', 'F163'],
    },
    threadId: 'thread-abc',
  };

  it('includes module name and anchors', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('记忆与知识工程'), 'should include module name');
    assert.ok(text.includes('F102, F163'), 'should include anchors');
  });

  it('includes thread ID', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('thread=thread-abc'), 'should include threadId');
  });

  it('uses interactive tour guide role (not 费曼老师)', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('互动导览猫'), 'should use interactive tour guide role');
    assert.ok(!text.includes('费曼老师'), 'should NOT use 费曼老师 role');
    assert.ok(text.includes('费曼导览'), 'should keep 费曼导览 as feature name');
  });

  it('includes interactive teaching: user re-expresses understanding', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('用自己的话说出理解'), 'should ask user to re-express');
    assert.ok(text.includes('讲清楚才算真懂'), 'should emphasize re-expression = real understanding');
    assert.ok(!text.includes('0/1/2'), 'should NOT use numeric scoring (non-LMS)');
    assert.ok(!text.includes('结课门槛'), 'should NOT have hard completion threshold');
  });

  it('includes progressive disclosure with anchor-type routing', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('feature spec'), 'should reference feature spec');
    assert.ok(text.includes('docs/features/'), 'should reference spec path for F-anchors');
    assert.ok(text.includes('doc:开头'), 'should route doc: anchors to their paths');
    assert.ok(text.includes('search_evidence 检索'), 'should fallback to evidence for other anchors');
  });

  it('treats gap discovery as side effect, not primary goal', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('不打断教学节奏'), 'gap recording should not interrupt teaching');
    assert.ok(!text.includes('主动标记为 gap'), 'should NOT actively hunt for gaps');
    assert.ok(text.includes('知识缺口'), 'should mention gap recording');
  });

  it('includes anti-sycophancy guardrails', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('sycophancy'), 'should include anti-sycophancy');
  });

  it('includes description when present', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('记忆存储与检索'), 'should include description');
  });

  it('omits description when absent', () => {
    const input = {
      ...baseInput,
      module: { name: '游戏系统', anchors: ['F090'] },
    };
    const lines = buildFeynmanPromptLines(input);
    const text = lines.join('\n');
    assert.ok(!text.includes('简介：'), 'should not include description line');
  });

  it('works without threadId', () => {
    const input = { ...baseInput, threadId: undefined };
    const lines = buildFeynmanPromptLines(input);
    const text = lines.join('\n');
    assert.ok(!text.includes('thread='), 'should not include thread= when no threadId');
  });
});
