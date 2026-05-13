import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('embedIndexedItems (shared utility with batch splitting)', () => {
  it('splits >64 items into batches of 64', async () => {
    const { embedIndexedItems } = await import('../../dist/domains/memory/embed-utils.js');

    const batchSizes = [];
    const mockEmbedding = {
      isReady: () => true,
      embed: async (texts) => {
        batchSizes.push(texts.length);
        return texts.map(() => new Float32Array([0.1, 0.2]));
      },
      getModelInfo: () => ({ modelId: 'test', modelRev: 'v1', dim: 2 }),
    };

    const upserted = [];
    const mockVectorStore = {
      upsert: (anchor, vec) => upserted.push({ anchor, vec }),
      checkMetaConsistency: () => ({ consistent: true, reason: 'ok' }),
      initMeta: () => {},
    };

    const items = Array.from({ length: 150 }, (_, i) => ({
      anchor: `doc-${i}`,
      title: `Doc ${i}`,
      summary: `Summary ${i}`,
    }));

    await embedIndexedItems(items, mockEmbedding, mockVectorStore);

    assert.equal(upserted.length, 150, 'all 150 items should be embedded');
    assert.ok(
      batchSizes.every((s) => s <= 64),
      `no batch should exceed 64, got: ${batchSizes}`,
    );
    assert.equal(batchSizes.length, 3, 'should split 150 into 3 batches (64+64+22)');
  });

  it('handles exactly 64 items in single batch', async () => {
    const { embedIndexedItems } = await import('../../dist/domains/memory/embed-utils.js');

    let callCount = 0;
    const mockEmbedding = {
      isReady: () => true,
      embed: async (texts) => {
        callCount++;
        return texts.map(() => new Float32Array([0.1]));
      },
      getModelInfo: () => ({ modelId: 'test', modelRev: 'v1', dim: 1 }),
    };

    const mockVectorStore = {
      upsert: () => {},
      checkMetaConsistency: () => ({ consistent: true, reason: 'ok' }),
      initMeta: () => {},
    };

    const items = Array.from({ length: 64 }, (_, i) => ({
      anchor: `doc-${i}`,
      title: `Doc ${i}`,
    }));

    await embedIndexedItems(items, mockEmbedding, mockVectorStore);
    assert.equal(callCount, 1, 'exactly 64 items should be one batch');
  });

  it('skips when embedding service not ready', async () => {
    const { embedIndexedItems } = await import('../../dist/domains/memory/embed-utils.js');

    let embedCalled = false;
    const mockEmbedding = {
      isReady: () => false,
      embed: async () => {
        embedCalled = true;
        return [];
      },
      getModelInfo: () => ({ modelId: 'test', modelRev: 'v1', dim: 1 }),
    };

    const mockVectorStore = {
      upsert: () => {},
      checkMetaConsistency: () => ({ consistent: true, reason: 'ok' }),
      initMeta: () => {},
    };

    await embedIndexedItems([{ anchor: 'a', title: 'A' }], mockEmbedding, mockVectorStore);
    assert.equal(embedCalled, false, 'should not call embed when service not ready');
  });

  it('skips empty items array', async () => {
    const { embedIndexedItems } = await import('../../dist/domains/memory/embed-utils.js');

    let embedCalled = false;
    const mockEmbedding = {
      isReady: () => true,
      embed: async () => {
        embedCalled = true;
        return [];
      },
      getModelInfo: () => ({ modelId: 'test', modelRev: 'v1', dim: 1 }),
    };

    const mockVectorStore = {
      upsert: () => {},
      checkMetaConsistency: () => ({ consistent: true, reason: 'ok' }),
      initMeta: () => {},
    };

    await embedIndexedItems([], mockEmbedding, mockVectorStore);
    assert.equal(embedCalled, false, 'should not call embed for empty array');
  });
});
