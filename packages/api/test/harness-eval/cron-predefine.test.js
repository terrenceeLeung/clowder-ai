import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';

// F167 Phase O path B (2026-07-05 T7 sub-commit C4): cron-side predefine
// helper integration test. Verifies:
//   - happy path: reads telemetry source → writes raw YAML → returns sourceRefs
//   - fail-soft: telemetry throws → returns undefined + onError called (no throw)
//   - injected clock: dateStr deterministic
//   - domain slug flows into filename

function makeFakeSource(overrides = {}) {
  return {
    getTraces: () => ({ spans: [], count: 0 }),
    getTraceStats: () => ({
      spanCount: 0,
      maxSpans: 10_000,
      maxAgeMs: 24 * 60 * 60 * 1000,
      oldestStoredAt: null,
      newestStoredAt: null,
    }),
    getMetrics: () => ({}),
    getMetricsHistory: () => ({ snapshots: [], count: 0 }),
    getGroundingSamples: async () => [],
    getProcessInfo: () => ({ processStartMs: 1_780_000_000_000, uptimeSec: 3600 }),
    ...overrides,
  };
}

describe('predefineF167SnapshotForCron (F167 Phase O path B C4)', () => {
  it('happy path: writes raw YAML + returns sourceRefs.snapshotName', async () => {
    const { predefineF167SnapshotForCron } = await import(
      '../../dist/infrastructure/harness-eval/cron-predefine.js'
    );
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-predefine-happy-'));
    try {
      const result = await predefineF167SnapshotForCron({
        telemetrySource: makeFakeSource(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        now: () => new Date('2026-07-05T02:59:59.000Z'),
      });
      assert.ok(result, 'must return sourceRefs on success');
      assert.equal(result.snapshotName, '2026-07-05-f167-a2a-snapshot.yaml');
      const filePath = join(tmpRoot, 'snapshots', '2026-07-05-f167-a2a-snapshot.yaml');
      assert.equal(existsSync(filePath), true, 'raw YAML must exist on disk');
      const parsed = parseYaml(readFileSync(filePath, 'utf8'));
      // Snake_case applied (see C2)
      assert.equal(parsed.feature_id, 'F167');
      // counter_window built from processInfo
      assert.equal(parsed.counter_window.duration_hours, 1, 'uptimeSec=3600 → durationHours=1');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('fail-soft: telemetry read throws → returns undefined + onError called (no rethrow)', async () => {
    const { predefineF167SnapshotForCron } = await import(
      '../../dist/infrastructure/harness-eval/cron-predefine.js'
    );
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-predefine-fail-'));
    const errors = [];
    try {
      const result = await predefineF167SnapshotForCron({
        telemetrySource: makeFakeSource({
          getTraces: () => {
            throw new Error('injected telemetry failure');
          },
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        now: () => new Date('2026-07-05T02:59:59.000Z'),
        onError: (err) => errors.push(err),
      });
      assert.equal(result, undefined, 'must return undefined on failure');
      assert.equal(errors.length, 1, 'onError must be called exactly once');
      assert.match(String(errors[0]), /injected telemetry failure/);
      // No YAML written
      const filePath = join(tmpRoot, 'snapshots', '2026-07-05-f167-a2a-snapshot.yaml');
      assert.equal(existsSync(filePath), false, 'raw YAML must NOT be written on failure');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('fail-soft: async getGroundingSamples rejects → returns undefined + onError called', async () => {
    const { predefineF167SnapshotForCron } = await import(
      '../../dist/infrastructure/harness-eval/cron-predefine.js'
    );
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-predefine-async-fail-'));
    const errors = [];
    try {
      const result = await predefineF167SnapshotForCron({
        telemetrySource: makeFakeSource({
          getGroundingSamples: async () => {
            throw new Error('grounding store down');
          },
        }),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        now: () => new Date('2026-07-05T02:59:59.000Z'),
        onError: (err) => errors.push(err),
      });
      assert.equal(result, undefined);
      assert.equal(errors.length, 1);
      assert.match(String(errors[0]), /grounding store down/);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('domainSlug flows into filename (e.g. memory slug produces memory basename)', async () => {
    const { predefineF167SnapshotForCron } = await import(
      '../../dist/infrastructure/harness-eval/cron-predefine.js'
    );
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-predefine-slug-'));
    try {
      const result = await predefineF167SnapshotForCron({
        telemetrySource: makeFakeSource(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'memory',
        now: () => new Date('2026-07-05T02:59:59.000Z'),
      });
      assert.equal(result?.snapshotName, '2026-07-05-f167-memory-snapshot.yaml');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('injected clock produces deterministic dateStr regardless of wall time', async () => {
    const { predefineF167SnapshotForCron } = await import(
      '../../dist/infrastructure/harness-eval/cron-predefine.js'
    );
    const tmpRoot = mkdtempSync(join(tmpdir(), 'f167-predefine-clock-'));
    try {
      const result = await predefineF167SnapshotForCron({
        telemetrySource: makeFakeSource(),
        harnessFeedbackRoot: tmpRoot,
        domainSlug: 'a2a',
        // Frozen at UTC boundary — dateStr must reflect injected clock, not real Date.now()
        now: () => new Date('2026-12-31T23:59:59.999Z'),
      });
      assert.equal(result?.snapshotName, '2026-12-31-f167-a2a-snapshot.yaml');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
