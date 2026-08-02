import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Fake LocalTraceStore: only implements the surface CronTelemetrySource needs
// (query + stats). Avoids importing the real store to keep this unit test
// self-contained.
function makeFakeTraceStore(spans = [], statsOverride = {}) {
  return {
    query: () => spans,
    stats: () => ({
      spanCount: spans.length,
      maxSpans: 10_000,
      maxAgeMs: 24 * 60 * 60 * 1000,
      oldestStoredAt: spans.length > 0 ? spans[0].storedAt : null,
      newestStoredAt: spans.length > 0 ? spans[spans.length - 1].storedAt : null,
      ...statsOverride,
    }),
    // Unused by CronTelemetrySource but part of the interface
    add: () => {},
    hydrate: () => {},
    clear: () => {},
  };
}

// F167 Phase O path B (2026-07-03 T7 sub-commit C1): verify the in-process
// telemetry source produces the same shape telemetry-adapter.ts HTTP responses
// would, so the downstream generateF167Snapshot(input) call is unchanged.
describe('InProcessCronTelemetrySource (F167 Phase O path B)', () => {
  it('getProcessInfo mirrors /api/telemetry/process-info derivation exactly', async () => {
    const { InProcessCronTelemetrySource } = await import(
      '../../dist/infrastructure/harness-eval/cron-telemetry-source.js'
    );
    const source = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore(),
      readMetrics: () => ({}),
      readMetricsHistory: () => [],
      readGroundingSamples: () => [],
      now: () => 1_780_000_100_000,
      processUptimeSec: () => 3600.789,
    });
    const info = source.getProcessInfo();
    assert.equal(info.uptimeSec, 3600.789);
    // Must be integer ms (bundleSnapshotSchema requires int) — matches
    // routes/telemetry.ts:236-238 exactly.
    assert.equal(info.processStartMs, 1_780_000_100_000 - Math.floor(3600.789 * 1000));
    assert.equal(Number.isInteger(info.processStartMs), true);
  });

  it('getTraces converts DTOs preserving parentSpanId when present, omitting when absent', async () => {
    const { InProcessCronTelemetrySource } = await import(
      '../../dist/infrastructure/harness-eval/cron-telemetry-source.js'
    );
    const spans = [
      {
        traceId: 't1',
        spanId: 's1',
        parentSpanId: 'sp1',
        name: 'cat_cafe.invocation',
        kind: 1,
        startTimeMs: 100,
        endTimeMs: 200,
        durationMs: 100,
        status: { code: 0 },
        attributes: { 'agent.id': 'opus-47' },
        events: [],
        storedAt: 1_780_000_000_000,
      },
      {
        traceId: 't2',
        spanId: 's2',
        // no parentSpanId
        name: 'cat_cafe.llm_call',
        kind: 1,
        startTimeMs: 300,
        endTimeMs: 400,
        durationMs: 100,
        status: { code: 0 },
        attributes: {},
        events: [],
        storedAt: 1_780_000_100_000,
      },
    ];
    const source = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore(spans),
      readMetrics: () => ({}),
      readMetricsHistory: () => [],
      readGroundingSamples: () => [],
      now: () => 1_780_000_200_000,
      processUptimeSec: () => 60,
    });
    const traces = source.getTraces();
    assert.equal(traces.count, 2);
    assert.equal(traces.spans[0].parentSpanId, 'sp1');
    assert.equal('parentSpanId' in traces.spans[1], false, 'must omit parentSpanId when DTO lacks it');
    // Sanity: kind + storedAt not carried into EvalTraceSpan (not consumed)
    assert.equal('kind' in traces.spans[0], false);
    assert.equal('storedAt' in traces.spans[0], false);
  });

  it('getTraceStats passes through LocalTraceStore.stats() unchanged', async () => {
    const { InProcessCronTelemetrySource } = await import(
      '../../dist/infrastructure/harness-eval/cron-telemetry-source.js'
    );
    const source = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore([], { spanCount: 42, oldestStoredAt: 1000, newestStoredAt: 5000 }),
      readMetrics: () => ({}),
      readMetricsHistory: () => [],
      readGroundingSamples: () => [],
      now: () => 1_780_000_200_000,
      processUptimeSec: () => 60,
    });
    const stats = source.getTraceStats();
    assert.equal(stats.spanCount, 42);
    assert.equal(stats.oldestStoredAt, 1000);
    assert.equal(stats.newestStoredAt, 5000);
  });

  it('getMetrics + getMetricsHistory delegate to injected readers', async () => {
    const { InProcessCronTelemetrySource } = await import(
      '../../dist/infrastructure/harness-eval/cron-telemetry-source.js'
    );
    const source = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore(),
      readMetrics: () => ({ cat_cafe_a2a_inline_action_checked: 7 }),
      readMetricsHistory: () => [
        { timestamp: 1000, metrics: { cat_cafe_a2a_inline_action_checked: 3 } },
        { timestamp: 2000, metrics: { cat_cafe_a2a_inline_action_checked: 7 } },
      ],
      readGroundingSamples: () => [],
      now: () => 1_780_000_200_000,
      processUptimeSec: () => 60,
    });
    assert.equal(source.getMetrics().cat_cafe_a2a_inline_action_checked, 7);
    const history = source.getMetricsHistory();
    assert.equal(history.count, 2);
    assert.equal(history.snapshots[1].metrics.cat_cafe_a2a_inline_action_checked, 7);
  });

  it('getGroundingSamples awaits async readers and returns empty array for unwired store', async () => {
    const { InProcessCronTelemetrySource } = await import(
      '../../dist/infrastructure/harness-eval/cron-telemetry-source.js'
    );
    const asyncSource = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore(),
      readMetrics: () => ({}),
      readMetricsHistory: () => [],
      readGroundingSamples: async () => [
        { catId: 'opus-47', threadId: 't1', tool: 'x', claim: 'y', verdict: 'verified' },
      ],
      now: () => 1_780_000_200_000,
      processUptimeSec: () => 60,
    });
    const samples = await asyncSource.getGroundingSamples();
    assert.equal(samples.length, 1);
    assert.equal(samples[0].catId, 'opus-47');

    // Empty (unwired) store returns [] — must NOT throw, must NOT block eval.
    const emptySource = new InProcessCronTelemetrySource({
      traceStore: makeFakeTraceStore(),
      readMetrics: () => ({}),
      readMetricsHistory: () => [],
      readGroundingSamples: () => [],
      now: () => 1_780_000_200_000,
      processUptimeSec: () => 60,
    });
    assert.deepEqual(await emptySource.getGroundingSamples(), []);
  });
});
