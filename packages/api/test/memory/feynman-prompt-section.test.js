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

  it('includes teaching protocol with understanding states (non-LMS)', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('费曼老师'), 'should include teaching protocol');
    assert.ok(text.includes('Delta Report'), 'should include delta report instruction');
    assert.ok(text.includes('单轮单锚点'), 'should enforce single-anchor-per-turn');
    assert.ok(text.includes('清晰'), 'should use natural understanding states');
    assert.ok(text.includes('模糊'), 'should use natural understanding states');
    assert.ok(text.includes('待复习'), 'should use natural understanding states');
    assert.ok(!text.includes('0/1/2'), 'should NOT use numeric scoring (non-LMS)');
    assert.ok(!text.includes('结课门槛'), 'should NOT have hard completion threshold (non-LMS)');
  });

  it('includes anti-sycophancy guardrails (AC-A2-10)', () => {
    const lines = buildFeynmanPromptLines(baseInput);
    const text = lines.join('\n');
    assert.ok(text.includes('sycophancy'), 'should include anti-sycophancy');
    assert.ok(text.includes('correction candidate'), 'should include correction handling');
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
