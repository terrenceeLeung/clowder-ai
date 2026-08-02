/**
 * F167 Phase O path B (2026-07-03): cron-side in-process telemetry source.
 *
 * Why:
 *   Eval cats have historically pulled telemetry via HTTP + session cookie
 *   (telemetry-adapter.ts). Since eval-cat invocations don't carry a session
 *   cookie, /api/telemetry/* endpoints return 401 (or connect-failed when the
 *   API isn't listening on 3004), and downstream RuntimeEvalSnapshot fields
 *   like counterWindow + groundingSampleEvidence stay `no-data` even when the
 *   API process has the real values in-process (LocalTraceStore, Prometheus
 *   registry, groundingSampleStore singleton, process.uptime()).
 *
 *   This module lets the daily cron collect exactly the same F167EvalInput
 *   from in-process sources (no HTTP, no cookie) and feed it to the same
 *   generateF167Snapshot() pure function eval cats already use. Bootstrap
 *   wires the runtime singletons; tests wire fakes.
 *
 *   See T7 design in thread_eval_a2a; F167 Phase O sibling-PR verdicts
 *   #77 (build) and #80 (build) frame the completeness gap this closes.
 */

import type { ClaimGroundingEvent } from '../grounding/types.js';
import type { LocalTraceStore, TraceSpanDTO } from '../telemetry/local-trace-store.js';
import type {
  EvalMetricsHistoryResponse,
  EvalMetricsSnapshot,
  EvalProcessInfo,
  EvalTraceSpan,
  EvalTraceStoreStats,
  EvalTracesResponse,
} from './telemetry-adapter.js';

/**
 * Interface used by domain/eval-domain-daily.ts execute() to collect
 * F167EvalInput without going through HTTP endpoints. Kept minimal so
 * tests can pass a fake and production wires the real singletons.
 *
 * Return-shape contract mirrors telemetry-adapter's HTTP responses so the
 * downstream generateF167Snapshot(input) call stays unchanged.
 */
export interface CronTelemetrySource {
  getTraces(): EvalTracesResponse;
  getTraceStats(): EvalTraceStoreStats;
  getMetrics(): Record<string, number>;
  getMetricsHistory(): EvalMetricsHistoryResponse;
  getGroundingSamples(): Promise<ClaimGroundingEvent[]>;
  getProcessInfo(): EvalProcessInfo;
}

/**
 * Convert a stored TraceSpanDTO to the EvalTraceSpan shape generateF167Snapshot
 * expects. The two shapes are nearly identical; the only omissions are `kind`
 * and `storedAt` (not consumed by F167 eval).
 */
function traceSpanDtoToEvalSpan(dto: TraceSpanDTO): EvalTraceSpan {
  return {
    traceId: dto.traceId,
    spanId: dto.spanId,
    ...(dto.parentSpanId != null ? { parentSpanId: dto.parentSpanId } : {}),
    name: dto.name,
    startTimeMs: dto.startTimeMs,
    endTimeMs: dto.endTimeMs,
    durationMs: dto.durationMs,
    status: dto.status,
    attributes: dto.attributes,
    events: dto.events,
  };
}

/**
 * Dependencies for InProcessCronTelemetrySource. Every dependency is injected
 * so tests can pass deterministic fakes without touching real singletons /
 * process.uptime(). Bootstrap (src/index.ts) wires the production values.
 */
export interface InProcessCronTelemetrySourceDeps {
  /** F153 in-process ring buffer. Bootstrap passes the singleton. */
  traceStore: LocalTraceStore;
  /**
   * Snapshot Prometheus counters into a flat {name -> value} record. Injected
   * so tests don't depend on a real Prometheus registry; production wires
   * the OTel Prometheus exporter's registry snapshot.
   */
  readMetrics: () => Record<string, number>;
  /**
   * Read the last N periodic metrics snapshots. Injected same reason.
   * Return [] if the runtime doesn't retain history — eval will just see
   * empty history (backward-compat with older servers).
   */
  readMetricsHistory: () => EvalMetricsSnapshot[];
  /**
   * Read grounding samples from getGroundingSampleStore().getSamples().
   * Sync or async — awaited by the source. Return [] if the store is not
   * wired (in-memory fallback impl).
   */
  readGroundingSamples: () => ClaimGroundingEvent[] | Promise<ClaimGroundingEvent[]>;
  /**
   * Wall-clock now in epoch ms. Injected so tests can freeze time; production
   * passes `() => Date.now()`.
   */
  now: () => number;
  /**
   * Process monotonic uptime in seconds. Injected so tests can pass fixed
   * values without touching real process.uptime(); production passes
   * `() => process.uptime()`.
   */
  processUptimeSec: () => number;
}

/**
 * Production impl wiring real in-process singletons.
 *
 * Bootstrap creates one instance and passes it via
 * `EvalDomainScheduleOpts.telemetrySource`. Tests instantiate directly with
 * fake deps to exercise generateF167Snapshot pathways deterministically.
 */
export class InProcessCronTelemetrySource implements CronTelemetrySource {
  constructor(private readonly deps: InProcessCronTelemetrySourceDeps) {}

  getTraces(): EvalTracesResponse {
    // Read all spans currently in the ring buffer. F167 eval only counts
    // spans + inspects attributes; there is no useful trace filter at the
    // cron level (no catId/invocationId context). Passing maxSpans caps the
    // response at the buffer capacity — the store returns at most that many.
    const stats = this.deps.traceStore.stats();
    const spans = this.deps.traceStore.query({ limit: stats.maxSpans });
    return { spans: spans.map(traceSpanDtoToEvalSpan), count: spans.length };
  }

  getTraceStats(): EvalTraceStoreStats {
    return this.deps.traceStore.stats();
  }

  getMetrics(): Record<string, number> {
    return this.deps.readMetrics();
  }

  getMetricsHistory(): EvalMetricsHistoryResponse {
    const snapshots = this.deps.readMetricsHistory();
    return { snapshots, count: snapshots.length };
  }

  async getGroundingSamples(): Promise<ClaimGroundingEvent[]> {
    return this.deps.readGroundingSamples();
  }

  getProcessInfo(): EvalProcessInfo {
    const uptimeSec = this.deps.processUptimeSec();
    const now = this.deps.now();
    // Match the exact derivation used by GET /api/telemetry/process-info
    // (routes/telemetry.ts) — floor to integer ms since bundleSnapshotSchema
    // requires counterWindow.startMs to be an integer.
    return {
      processStartMs: now - Math.floor(uptimeSec * 1000),
      uptimeSec,
    };
  }
}
