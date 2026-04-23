import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { MarkerQueue } from '../../dist/domains/memory/MarkerQueue.js';

describe('MarkerQueue metadata', () => {
  let dir;
  let queue;

  beforeEach(() => {
    dir = join(tmpdir(), `marker-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    queue = new MarkerQueue(dir);
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  });

  it('submit preserves metadata in YAML and roundtrips', async () => {
    const marker = await queue.submit({
      content: 'Test gap',
      source: 'callback:ragdoll:inv1',
      status: 'captured',
      metadata: {
        feynman_type: 'gap',
        module: 'memory',
        replay_question: 'What is evidence authority?',
      },
    });

    assert.ok(marker.id);
    assert.deepEqual(marker.metadata, {
      feynman_type: 'gap',
      module: 'memory',
      replay_question: 'What is evidence authority?',
    });

    const listed = await queue.list();
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].metadata, marker.metadata);
  });

  it('submit without metadata omits metadata field', async () => {
    const marker = await queue.submit({
      content: 'Plain marker',
      source: 'callback:ragdoll:inv2',
      status: 'captured',
    });

    assert.equal(marker.metadata, undefined);

    const listed = await queue.list();
    assert.equal(listed[0].metadata, undefined);
  });

  it('metadata with correction type (AC-A2-8)', async () => {
    const marker = await queue.submit({
      content: 'User corrected fact about F102',
      source: 'callback:ragdoll:inv3',
      status: 'captured',
      metadata: {
        feynman_type: 'correction',
        module: 'memory',
        evidence_anchors: 'F102',
      },
    });

    assert.equal(marker.metadata.feynman_type, 'correction');
    assert.equal(marker.metadata.module, 'memory');
  });

  it('sanitizes metadata keys (rejects non-alphanumeric)', async () => {
    const marker = await queue.submit({
      content: 'Injection attempt',
      source: 'callback:ragdoll:inv4',
      status: 'captured',
      metadata: {
        valid_key: 'ok',
        'bad-key': 'dropped',
        UPPER: 'dropped',
        '../../path': 'dropped',
      },
    });

    assert.equal(marker.metadata.valid_key, 'ok');
    assert.equal(marker.metadata['bad-key'], undefined);
    assert.equal(marker.metadata['../../path'], undefined);
  });

  it('strips CR/LF from metadata values (YAML injection defense)', async () => {
    const marker = await queue.submit({
      content: 'YAML injection attempt',
      source: 'callback:ragdoll:inv5',
      status: 'captured',
      metadata: {
        feynman_type: 'gap\nstatus: approved',
        module: 'memory\r\ncontent: |',
      },
    });

    assert.ok(!marker.metadata.feynman_type.includes('\n'), 'should strip newlines');
    assert.ok(!marker.metadata.module.includes('\n'), 'should strip newlines');

    const listed = await queue.list();
    assert.equal(listed[0].metadata.feynman_type, 'gap status: approved');
    assert.equal(listed.length, 1);
  });
});
