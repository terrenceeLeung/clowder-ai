import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';

// F167 Phase O path B (2026-07-04 T7 sub-commit C2, updated 2026-07-09 for
// review request-changes on PR #92): raw snapshot YAML writer with
// camelCase → snake_case key conversion. Output shape MUST match what
// eval-a2a-artifact-parsers.ts:parseMarkdownYaml expects — `--- ... ---`
// frontmatter block followed by body YAML. Pure YAML output (2026-07-04
// original impl) failed round-trip: `missing YAML frontmatter`. This
// version emits the correct shape, and the tests exercise the full
// writer → parseSnapshot round-trip to catch any future regression.

/**
 * Split a raw snapshot file into frontmatter YAML + body YAML using the
 * same regex the production parser uses. Test helper mirroring
 * parseMarkdownYaml so the test asserts the actual on-disk shape, not
 * some intermediate representation.
 */
function splitFrontmatterBody(raw) {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch)
    throw new Error('missing YAML frontmatter — writer output does NOT match parseMarkdownYaml contract');
  const body = raw.slice(frontmatterMatch[0].length);
  return {
    frontmatter: parseYaml(frontmatterMatch[1] ?? ''),
    body: parseYaml(body) ?? {},
  };
}

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

describe('snapshot-writer — writeF167SnapshotYaml frontmatter+body shape (F167 Phase O path B C2)', () => {
  it('output starts with --- frontmatter --- block that parseMarkdownYaml can extract', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
      });
      const raw = readFileSync(result.snapshotPath, 'utf8');
      // Must open with `---` (frontmatter marker) — the ORIGINAL bug fixed here
      assert.ok(
        raw.startsWith('---\n') || raw.startsWith('---\r\n'),
        `must start with '---' marker, got: ${raw.slice(0, 40)}`,
      );
      // splitFrontmatterBody uses the exact same regex the production parser
      // (parseMarkdownYaml) uses — so if this throws, production parser throws.
      const parts = splitFrontmatterBody(raw);
      assert.ok(parts.frontmatter, 'frontmatter must parse');
      assert.ok(parts.body, 'body must parse');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('frontmatter contains feature_id + generated_at + doc metadata (snake_case)', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot({ generatedAt: '2026-07-04T02:59:59Z' }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
      });
      const { frontmatter } = splitFrontmatterBody(readFileSync(result.snapshotPath, 'utf8'));
      assert.equal(frontmatter.doc_kind, 'harness-feedback');
      assert.equal(frontmatter.feedback_type, 'eval-snapshot');
      assert.equal(frontmatter.feature_id, 'F167');
      assert.equal(frontmatter.eval_snapshot_id, 'eval-F167-2026-07-04');
      assert.equal(frontmatter.generated_at, '2026-07-04T02:59:59Z');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('body contains window / counter_window / components / trace_store_stats in snake_case', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot({
          counterWindow: { startMs: 500, endMs: 3000, durationHours: 0.6944 },
          traceStoreStats: {
            spanCount: 42,
            maxSpans: 10_000,
            maxAgeMs: 86_400_000,
            oldestStoredAt: 1000,
            newestStoredAt: 2000,
          },
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-04',
      });
      const { body } = splitFrontmatterBody(readFileSync(result.snapshotPath, 'utf8'));
      assert.equal(body.window.duration_hours, 24);
      assert.equal(body.counter_window.duration_hours, 0.6944);
      assert.equal(body.trace_store_stats.span_count, 42);
      assert.equal(body.trace_store_stats.oldest_stored_at, 1000);
      assert.equal(body.summary, '');
      // feature_id should NOT appear in body (it's a frontmatter field)
      assert.equal('feature_id' in body, false, 'feature_id belongs in frontmatter, not body');
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
      const { frontmatter, body } = splitFrontmatterBody(readFileSync(result.snapshotPath, 'utf8'));
      // In camelCase mode, frontmatter still has snake_case for doc_kind /
      // feedback_type / feature_id / eval_snapshot_id / generated_at because
      // the frontmatter object is snake by construction (parser demands it).
      // snakeCase=false only means the object BODY's dynamic keys stay camel.
      assert.equal(frontmatter.feature_id, 'F167');
      assert.equal(body.counterWindow.durationHours, 0.5);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('creates snapshots/ subdirectory if missing + basename correct', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-writer-'));
    try {
      const result = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'memory',
        dateStr: '2026-07-05',
      });
      const raw = readFileSync(result.snapshotPath, 'utf8');
      assert.ok(raw.length > 0, 'yaml file must be non-empty');
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

// ─── Round-trip regression (2026-07-09 review fix) ─────────────
//
// The 2026-07-08 PR #92 review found that pure YAML output failed
// parseSnapshot with `missing YAML frontmatter`. This suite verifies the
// full writer → real parseSnapshot round-trip so any future writer change
// that breaks the contract fails here BEFORE reaching daily eval bundle
// generation.

describe('snapshot-writer — parseSnapshot round-trip (2026-07-09 review regression)', () => {
  it('writer output is parseable by production parseSnapshot() — feature_id survives round-trip', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const { parseSnapshot } = await import('../../dist/infrastructure/harness-eval/a2a/eval-a2a-artifact-parsers.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-roundtrip-'));
    try {
      const written = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot({
          counterWindow: { startMs: 500, endMs: 3000, durationHours: 1.5 },
          components: [
            {
              id: 'counter-window',
              name: 'counter-domain denominator availability',
              confidence: 'high',
              activationCounts: {},
              frictionCounts: { telemetryCounterWindowMissing: 0 },
            },
          ],
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-09',
      });

      // If writer output shape is wrong, this throws
      // "missing YAML frontmatter" — the exact error from the review.
      const parsed = parseSnapshot(written.snapshotPath);

      assert.equal(parsed.featureId, 'F167');
      assert.equal(parsed.evalSnapshotId, 'eval-F167-2026-07-04');
      assert.equal(parsed.generatedAt, '2026-07-04T02:59:59Z');
      assert.equal(parsed.window.durationHours, 24);
      assert.equal(parsed.counterWindow?.durationHours, 1.5);
      assert.equal(parsed.components.length, 1);
      assert.equal(parsed.components[0].id, 'counter-window');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('round-trip preserves snake_case component friction/activation count keys', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const { parseSnapshot } = await import('../../dist/infrastructure/harness-eval/a2a/eval-a2a-artifact-parsers.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-roundtrip-'));
    try {
      const written = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot({
          components: [
            {
              id: 'eval-domain-daily',
              name: 'daily eval domain scheduler slot guard',
              confidence: 'high',
              activationCounts: { 'eval_domain_daily.eval_a2a_runs_per_day': 1 },
              frictionCounts: {
                'eval_domain_daily.eval_a2a_duplicate_runs_per_day': 0,
                'legacy.dynamic_task_defs.harness_fit_digest_count': 0,
              },
            },
          ],
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-09',
      });
      const parsed = parseSnapshot(written.snapshotPath);
      const comp = parsed.components[0];
      assert.equal(comp.id, 'eval-domain-daily');
      assert.equal(comp.activationCounts['eval_domain_daily.eval_a2a_runs_per_day'], 1);
      assert.equal(comp.frictionCounts['eval_domain_daily.eval_a2a_duplicate_runs_per_day'], 0);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('round-trip when counterWindow is absent — parseSnapshot returns without counterWindow field', async () => {
    const { writeF167SnapshotYaml } = await import('../../dist/infrastructure/harness-eval/snapshot-writer.js');
    const { parseSnapshot } = await import('../../dist/infrastructure/harness-eval/a2a/eval-a2a-artifact-parsers.js');
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-snapshot-roundtrip-'));
    try {
      const written = writeF167SnapshotYaml({
        snapshot: makeMinimalSnapshot(), // no counterWindow
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        dateStr: '2026-07-09',
      });
      const parsed = parseSnapshot(written.snapshotPath);
      assert.equal(parsed.featureId, 'F167');
      assert.equal(parsed.counterWindow, undefined);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
