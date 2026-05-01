// F179: Normalizer — LLM-driven content processing (mock LLM)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Normalizer } from '../dist/domains/knowledge/Normalizer.js';

function createMockLlm(response) {
  return {
    callCount: 0,
    async generate(_system, _user) {
      this.callCount++;
      return typeof response === 'function' ? response(_system, _user) : JSON.stringify(response);
    },
  };
}

const SAMPLE_MD = `# Architecture Overview

MeowGrid uses a distributed architecture with three core components.

## Whisker Coordinator

The Whisker Coordinator manages task scheduling and load balancing across all PawWorker nodes.

## PawWorker

PawWorker nodes execute individual tasks. Each node can handle up to 1000 concurrent tasks.
`;

const VALID_LLM_RESPONSE = {
  title: 'Architecture Overview',
  summary: 'MeowGrid distributed architecture with Whisker Coordinator, PawWorker, and task scheduling.',
  docKind: 'architecture',
  authority: 'candidate',
  extractionConfidence: 0.92,
  keywords: ['MeowGrid', 'distributed', 'scheduler'],
  topics: ['architecture', 'distributed-systems'],
  language: 'en',
  chunks: [
    {
      headingPath: ['Architecture Overview'],
      contentMarkdown: 'MeowGrid uses a distributed architecture with three core components.',
      plainText: 'MeowGrid uses a distributed architecture with three core components.',
      charStart: 24,
      charEnd: 90,
      tokenCount: 12,
      dedupeKey: 'arch-overview-intro',
    },
    {
      headingPath: ['Architecture Overview', 'Whisker Coordinator'],
      contentMarkdown: 'The Whisker Coordinator manages task scheduling and load balancing across all PawWorker nodes.',
      plainText: 'The Whisker Coordinator manages task scheduling and load balancing across all PawWorker nodes.',
      charStart: 115,
      charEnd: 209,
      tokenCount: 16,
      dedupeKey: 'whisker-coordinator',
    },
    {
      headingPath: ['Architecture Overview', 'PawWorker'],
      contentMarkdown: 'PawWorker nodes execute individual tasks. Each node can handle up to 1000 concurrent tasks.',
      plainText: 'PawWorker nodes execute individual tasks. Each node can handle up to 1000 concurrent tasks.',
      charStart: 224,
      charEnd: 315,
      tokenCount: 17,
      dedupeKey: 'pawworker',
    },
  ],
};

describe('Normalizer', () => {
  it('produces NormalizedDocument with title/summary/chunks', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test-model' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    assert.equal(result.title, 'Architecture Overview');
    assert.equal(result.summary.length > 0, true);
    assert.equal(result.chunks.length, 3);
  });

  it('chunks have headingPath + charStart/charEnd', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test-model' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    const chunk = result.chunks[1];
    assert.deepEqual(chunk.headingPath, ['Architecture Overview', 'Whisker Coordinator']);
    assert.equal(typeof chunk.charStart, 'number');
    assert.equal(typeof chunk.charEnd, 'number');
    assert.ok(chunk.charEnd > chunk.charStart);
  });

  it('output includes normalizerVersion + modelId (AC-09)', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '2.1.0', modelId: 'claude-haiku-3' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    assert.equal(result.normalizerVersion, '2.1.0');
    assert.equal(result.modelId, 'claude-haiku-3');
  });

  it('extractionConfidence is 0-1 range', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    assert.ok(result.extractionConfidence >= 0 && result.extractionConfidence <= 1);
  });

  it('authority is a valid F163Authority value', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    const validAuthorities = ['constitutional', 'validated', 'candidate', 'observed'];
    assert.ok(validAuthorities.includes(result.authority));
  });

  it('keywords and topics are arrays', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    assert.ok(Array.isArray(result.keywords));
    assert.ok(Array.isArray(result.topics));
    assert.ok(result.keywords.length > 0);
  });

  it('LLM error throws NormalizerError', async () => {
    const llm = { async generate() { throw new Error('API timeout'); } };
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    await assert.rejects(
      () => normalizer.normalize(SAMPLE_MD, { sourcePath: '/docs/arch.md', sourceHash: 'abc123' }),
      (err) => err.message.includes('Normalizer failed'),
    );
  });

  it('empty document throws', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    await assert.rejects(
      () => normalizer.normalize('', { sourcePath: '/docs/empty.md', sourceHash: 'def456' }),
      (err) => err.message.includes('empty'),
    );
  });

  it('anchor format is dk:uuid', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    assert.match(result.anchor, /^dk:[0-9a-f-]{36}$/);
  });

  it('chunks have sequential chunkIndex', async () => {
    const llm = createMockLlm(VALID_LLM_RESPONSE);
    const normalizer = new Normalizer(llm, { version: '1.0.0', modelId: 'test' });
    const result = await normalizer.normalize(SAMPLE_MD, {
      sourcePath: '/docs/arch.md',
      sourceHash: 'abc123',
    });
    result.chunks.forEach((chunk, i) => {
      assert.equal(chunk.chunkIndex, i);
    });
  });
});
