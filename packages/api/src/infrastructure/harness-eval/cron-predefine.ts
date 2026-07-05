/**
 * F167 Phase O path B (2026-07-05 C4): cron-side predefine helper.
 *
 * Bridges the pieces C1 + C2 + C3 introduced:
 *   1. Read in-process telemetry via CronTelemetrySource (C1).
 *   2. Feed to generateF167Snapshot pure function (existing f167-eval.ts).
 *   3. Serialize + write raw YAML via writeF167SnapshotYaml (C2).
 *   4. Return sourceRefs the caller passes to buildEvalCatInvocation (C3).
 *
 * Fail-soft contract:
 *   Any exception in the pipeline (telemetry read, snapshot generation, YAML
 *   write) is caught, logged to console.error, and the helper returns
 *   `undefined`. The cron caller passes no sourceRefs, which triggers the
 *   backward-compat eval-cat behavior (fetches + writes evidence itself).
 *
 * Extracted out of eval-domain-daily.ts execute() so it is unit-testable
 * without booting the full scheduler machinery.
 */

import type { EvalCatInvocationSourceRefs } from './eval-cat-invocation.js';
import type { CronTelemetrySource } from './cron-telemetry-source.js';
import { generateF167Snapshot, type F167EvalInput } from './f167-eval.js';
import { writeF167SnapshotYaml } from './snapshot-writer.js';

export interface PredefineF167Opts {
  telemetrySource: CronTelemetrySource;
  harnessFeedbackRoot: string;
  /** Filename suffix, e.g. 'a2a'. Snapshot lands at YYYY-MM-DD-f167-<slug>-snapshot.yaml. */
  domainSlug: string;
  /**
   * Injected clock — production passes `() => new Date()`, tests pass a
   * fixed instance so dateStr is deterministic.
   */
  now?: () => Date;
  /**
   * Optional error sink. Production omits (falls back to console.error);
   * tests inject a spy to assert fail-soft path.
   */
  onError?: (err: unknown) => void;
}

/**
 * Collect in-process telemetry, generate snapshot, write raw YAML.
 * Returns sourceRefs on success; undefined on any failure (see fail-soft contract).
 */
export async function predefineF167SnapshotForCron(
  opts: PredefineF167Opts,
): Promise<EvalCatInvocationSourceRefs | undefined> {
  try {
    // Parallel reads keep the cron tick fast — every reader is in-process
    // and returns synchronously except getGroundingSamples (may be Redis-backed).
    const [traces, metrics, metricsHistory, traceStats, groundingSamples, processInfo] = await Promise.all([
      Promise.resolve(opts.telemetrySource.getTraces()),
      Promise.resolve(opts.telemetrySource.getMetrics()),
      Promise.resolve(opts.telemetrySource.getMetricsHistory()),
      Promise.resolve(opts.telemetrySource.getTraceStats()),
      opts.telemetrySource.getGroundingSamples(),
      Promise.resolve(opts.telemetrySource.getProcessInfo()),
    ]);

    const input: F167EvalInput = {
      traces,
      metrics: metrics as Record<string, number>,
      metricsHistory,
      traceStats,
      groundingSamples,
      processStartMs: processInfo.processStartMs,
      processUptimeSec: processInfo.uptimeSec,
    };

    const snapshot = generateF167Snapshot(input);
    const nowDate = opts.now?.() ?? new Date();
    const dateStr = nowDate.toISOString().slice(0, 10);
    const written = writeF167SnapshotYaml({
      snapshot,
      harnessFeedbackRoot: opts.harnessFeedbackRoot,
      domainSlug: opts.domainSlug,
      dateStr,
    });
    return { snapshotName: written.snapshotName };
  } catch (err) {
    if (opts.onError) {
      opts.onError(err);
    } else {
      // Cron runs are audited via ledger; missing predefine surfaces as
      // no-data in eval artifacts (same as pre-C4 baseline).
      // eslint-disable-next-line no-console
      console.error('[eval-domain-daily] predefine failed:', err);
    }
    return undefined;
  }
}
