import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// F167 Phase O path B (2026-07-04 T7 sub-commit C3): sourceRefs field on
// EvalCatInvocationInput → EvalCatInvocationPacket.context. The cron pre-writes
// raw evidence YAML then passes { snapshotName } through this field so the
// eval cat can publish without fetching telemetry over HTTP.

// Matches the real registry schema (see docs/harness-feedback/eval-domains/eval-a2a.yaml
// as ground-truth; if the schema evolves, only this helper needs updating).
function makeMinimalDomain(overrides = {}) {
  return {
    domainId: 'eval:a2a',
    displayName: 'A2A Harness Eval',
    systemThreadId: 'thread_eval_a2a',
    evalCat: {
      catId: 'codex',
      handle: '@codex',
      model: 'gpt-5.5',
    },
    frequency: 'daily',
    sourceAdapter: 'f167-runtime-eval',
    sourceRefsKind: 'a2a-snapshot-attribution',
    threadPolicy: {
      role: 'working-home',
      stateSot: 'registry',
      allowedContent: ['longitudinal-analysis', 'verdict-discussion', 'handoff-drafts'],
    },
    legacyScheduledTaskIds: [],
    handoffTargetResolver: {
      featureId: 'F167',
      ownerCatId: 'opus-47',
      threadLookup: 'feature-thread',
    },
    sla: {
      acknowledgeHours: 24,
      reevalWithinHours: 72,
    },
    ...overrides,
  };
}

describe('buildEvalCatInvocation — sourceRefs passthrough (F167 Phase O path B C3)', () => {
  it('backward-compat: input without sourceRefs → packet.context has no sourceRefs key', async () => {
    const { buildEvalCatInvocation } = await import(
      '../../dist/infrastructure/harness-eval/eval-cat-invocation.js'
    );
    const packet = buildEvalCatInvocation({
      domain: makeMinimalDomain(),
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'disabled' },
    });
    assert.equal(
      'sourceRefs' in packet.context,
      false,
      'must NOT emit sourceRefs key when input.sourceRefs is undefined (keeps packet minimal for legacy callers)',
    );
  });

  it('input with sourceRefs.snapshotName → packet.context.sourceRefs echoed', async () => {
    const { buildEvalCatInvocation } = await import(
      '../../dist/infrastructure/harness-eval/eval-cat-invocation.js'
    );
    const packet = buildEvalCatInvocation({
      domain: makeMinimalDomain(),
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'disabled' },
      sourceRefs: { snapshotName: '2026-07-04-f167-a2a-snapshot.yaml' },
    });
    assert.deepEqual(packet.context.sourceRefs, {
      snapshotName: '2026-07-04-f167-a2a-snapshot.yaml',
    });
  });

  it('input with both snapshotName + attributionName → both echoed', async () => {
    const { buildEvalCatInvocation } = await import(
      '../../dist/infrastructure/harness-eval/eval-cat-invocation.js'
    );
    const packet = buildEvalCatInvocation({
      domain: makeMinimalDomain(),
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'disabled' },
      sourceRefs: {
        snapshotName: '2026-07-04-f167-a2a-snapshot.yaml',
        attributionName: '2026-07-04-f167-a2a-attribution.yaml',
      },
    });
    assert.equal(packet.context.sourceRefs?.snapshotName, '2026-07-04-f167-a2a-snapshot.yaml');
    assert.equal(packet.context.sourceRefs?.attributionName, '2026-07-04-f167-a2a-attribution.yaml');
  });

  it('input with only attributionName → snapshotName omitted', async () => {
    const { buildEvalCatInvocation } = await import(
      '../../dist/infrastructure/harness-eval/eval-cat-invocation.js'
    );
    const packet = buildEvalCatInvocation({
      domain: makeMinimalDomain(),
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'disabled' },
      sourceRefs: { attributionName: '2026-07-04-f167-a2a-attribution.yaml' },
    });
    assert.equal(packet.context.sourceRefs?.attributionName, '2026-07-04-f167-a2a-attribution.yaml');
    assert.equal(packet.context.sourceRefs?.snapshotName, undefined);
  });

  it('sourceRefs does not disturb other context fields (legacyCleanup, sla, etc)', async () => {
    const { buildEvalCatInvocation } = await import(
      '../../dist/infrastructure/harness-eval/eval-cat-invocation.js'
    );
    const packet = buildEvalCatInvocation({
      domain: makeMinimalDomain(),
      trendRefs: ['t1'],
      verdictRefs: ['v1'],
      legacyCleanup: { status: 'dry_run_ready', reportRef: 'r1' },
      sourceRefs: { snapshotName: '2026-07-04-f167-a2a-snapshot.yaml' },
    });
    assert.deepEqual(packet.context.trendRefs, ['t1']);
    assert.deepEqual(packet.context.verdictRefs, ['v1']);
    assert.deepEqual(packet.context.legacyCleanup, { status: 'dry_run_ready', reportRef: 'r1' });
    assert.equal(packet.context.sla.acknowledgeHours, 24);
    assert.deepEqual(packet.context.sourceRefs, {
      snapshotName: '2026-07-04-f167-a2a-snapshot.yaml',
    });
  });
});
