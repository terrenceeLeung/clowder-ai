import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';

// F167 Phase O path B (2026-07-04 T7 sub-commit C2): raw snapshot YAML writer
// with camelCase → snake_case key conversion. Ensures the file cron writes at
// harnessFeedbackRoot/snapshots/ matches the shape bundle generators + eval
// cats expect (snake_case in YAML, camelCase in bundle JSON — see daily eval
// callback banner).

function makeMinimalSnapshot(overrides = {}) {
  return {
    featureId: 'F167',
    window: { startMs: 1000, endMs: 2000, durationHours: 24 },
    dataSource: 'in-process',
    generatedAt: '2026-07-04T02:59:59Z',
    generatedBy: 'F192 cron predefine',
    traceStoreStats: {
      spanCount: 0,
      maxSpans: 100,
      maxAgeMs: 1000,
      oldestStoredAt: null,
      newestStoredAt: null,
    },
    components: [],
    overallConfidence: 'no-data',
    summary: '',
    ...overrides,
  };
}

describe('snapshot-writer — key case helpers', () => {
  it('camelToSnake preserves lowercase strings and converts camelCase', async () => {
    const { camelToSnake } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    assert.equal(camelToSnake(''), '');
    assert.equal(camelToSnake('lowercase'), 'lowercase');
    assert.equal(camelToSnake('featureId'), 'feature_id');
    assert.equal(camelToSnake('counterWindow'), 'counter_window');
    assert.equal(camelToSnake('groundingSampleEvidence'), 'grounding_sample_evidence');
    // Value never starts uppercase in F167EvalInput/Snapshot; documented behavior
    assert.equal(camelToSnake('ID'), 'i_d');
  });

  it('snakeCaseKeys deep-converts nested objects + arrays + primitives', async () => {
    const { snakeCaseKeys } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const input = {
      featureId: 'F167',
      counterWindow: { startMs: 100, endMs: 200, durationHours: 24 },
      components: [
        { id: 'c1', activationCounts: { holdBallCount: 5 } },
        { id: 'c2', activationCounts: {} },
      ],
      nullField: null,
      arrayOfStrings: ['a', 'b'],
      alreadySnake: { child_key: 'x' },
    };
    const out = snakeCaseKeys(input);
    assert.equal(out.feature_id, 'F167');
    assert.equal(out.counter_window.start_ms, 100);
    assert.equal(out.counter_window.duration_hours, 24);
    assert.equal(out.components[0].id, 'c1');
    assert.equal(out.components[0].activation_counts.hold_ball_count, 5);
    assert.deepEqual(out.array_of_strings, ['a', 'b']);
    assert.equal(out.null_field, null);
    // Idempotent for already-snake keys
    assert.equal(out.already_snake.child_key, 'x');
  });

  it('snakeCaseKeys preserves primitive strings + numbers unchanged', async () => {
    const { snakeCaseKeys } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    assert.equal(snakeCaseKeys('a-string'), 'a-string');
    assert.equal(snakeCaseKeys(42), 42);
    assert.equal(snakeCaseKeys(null), null);
    assert.equal(snakeCaseKeys(undefined), undefined);
  });
});

describe('snapshot-writer — writeF167SnapshotYaml (F167 Phase O path B C2)', () => {
  it('writes to correct path + returns basename + snake_case YAML by default', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const snapshot = makeMinimalSnapshot({
        counterWindow: { startMs: 500, endMs: 3000, durationHours: 0.6944 },
        traceStoreStats: {
          spanCount: 42,
          maxSpans: 10_000,
          maxAgeMs: 86_400_000,
          oldestStoredAt: 1000,
          newestStoredAt: 2000,
        },
      });
      const result = writeF167SnapshotYaml({
        snapshot,
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
      });
      assert.equal(result.snapshotName, '2026-07-04-f167-a2a-snapshot.yaml');
      assert.equal(result.snapshotPath, join(tmpRoot, 'snapshots', '2026-07-04-f167-a2a-snapshot.yaml'));

      const written = readFileSync(result.snapshotPath, 'utf8');
      const parsed = parseYaml(written);
      // Snake_case applied by default
      assert.equal(parsed.feature_id, 'F167');
      assert.equal(parsed.counter_window.duration_hours, 0.6944);
      assert.equal(parsed.trace_store_stats.span_count, 42);
      assert.equal(parsed.trace_store_stats.oldest_stored_at, 1000);
      // Single-word keys stay as-is
      assert.equal(parsed.summary, '');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('respects snakeCase=false (camelCase preserved for legacy consumers)', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot({
          counterWindow: { startMs: 500, endMs: 3000, durationHours: 0.5 },
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
        snakeCase: false,
      });
      const parsed = parseYaml(readFileSync(result.snapshotPath, 'utf8'));
      assert.equal(parsed.featureId, 'F167');
      assert.equal(parsed.counterWindow.durationHours, 0.5);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('creates snapshots/ subdirectory if missing', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      // No snapshots/ dir yet — mkdirSync recursive should create it
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'memory',
        dateStr: '2026-07-05',
      });
      const written = readFileSync(result.snapshotPath, 'utf8');
      assert.ok(written.length > 0, 'yaml file must be non-empty');
      assert.equal(result.snapshotName, '2026-07-05-f167-memory-snapshot.yaml');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('domainSlug controls the filename suffix', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const a = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
      });
      const b = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'memory',
        dateStr: '2026-07-04',
      });
      assert.equal(a.snapshotName, '2026-07-04-f167-a2a-snapshot.yaml');
      assert.equal(b.snapshotName, '2026-07-04-f167-memory-snapshot.yaml');
      assert.notEqual(a.snapshotPath, b.snapshotPath);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
