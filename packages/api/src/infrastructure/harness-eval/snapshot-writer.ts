/**
 * F167 Phase O path B (2026-07-04): serialize RuntimeEvalSnapshot as raw YAML
 * evidence at `harnessFeedbackRoot/snapshots/YYYY-MM-DD-f167-<domain>-snapshot.yaml`.
 *
 * The written basename is fed into buildEvalCatInvocation's sourceRefs field,
 * so the eval cat can pass { snapshotName } to cat_cafe_publish_verdict and
 * the MCP tool reads the file from disk without the cat re-fetching telemetry.
 *
 * Key-case contract:
 *   Raw snapshot YAML historically uses snake_case (e.g. counter_window,
 *   counter_window.duration_hours) while bundle JSON uses camelCase (e.g.
 *   counterWindow.durationHours). See daily eval:a2a cron callback banner:
 *     "counter_window (snake_case) in raw snapshot YAML ...
 *      counterWindow (camelCase) in bundle JSON ... both refer to same field".
 *
 *   This writer accepts a `snakeCase` option (default true) that recursively
 *   renames object keys before serialization. Tests exercise both modes so
 *   future readers (bundle generator / eval cats) can trust the convention.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { RuntimeEvalSnapshot } from './f167-eval.js';

export interface WriteF167SnapshotOpts {
  snapshot: RuntimeEvalSnapshot;
  /** Absolute path to the harness-feedback root (contains snapshots/, attributions/, etc). */
  harnessFeedbackRoot: string;
  /** Domain suffix in filename, e.g. 'a2a', 'memory'. */
  domainSlug: string;
  /** 'YYYY-MM-DD' — usually the cron fire date in UTC. */
  dateStr: string;
  /**
   * Convert camelCase → snake_case for raw YAML compatibility (default true).
   * Set false only when downstream consumers explicitly need camelCase (rare —
   * matches the historical eval-cat manual writing convention).
   */
  snakeCase?: boolean;
}

export interface WriteF167SnapshotResult {
  /** Basename used as `sourceRefs.snapshotName` when publishing the verdict. */
  snapshotName: string;
  /** Absolute path where the YAML was written. */
  snapshotPath: string;
}

/**
 * camelCase → snake_case. Preserves the first character's case (so
 * `featureId` → `feature_id`, `abcDef` → `abc_def`). Runs left-to-right so
 * consecutive capitals like `URLPath` become `u_r_l_path` — F167 snapshot
 * fields avoid this pattern, so the simple regex is enough.
 */
export function camelToSnake(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * Deep-convert plain-object keys camelCase → snake_case. Preserves arrays and
 * primitives; class instances are returned unchanged (defensive — we don't
 * expect any in RuntimeEvalSnapshot, but this keeps the transformation lossless
 * when called on partial inputs).
 */
export function snakeCaseKeys<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => snakeCaseKeys(item)) as unknown as T;
  if (input !== null && typeof input === 'object' && (input as object).constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[camelToSnake(k)] = snakeCaseKeys(v);
    }
    return out as unknown as T;
  }
  return input;
}

/**
 * Serialize a RuntimeEvalSnapshot to raw YAML at
 *   `<harnessFeedbackRoot>/snapshots/<dateStr>-f167-<domainSlug>-snapshot.yaml`
 * Creates the snapshots/ subdirectory if absent. Returns the basename +
 * absolute path so callers can (a) put basename into sourceRefs.snapshotName,
 * (b) log the absolute path for debugging.
 *
 * Throws on I/O errors. Cron callers should wrap in try/catch and fall back to
 * NOT sending sourceRefs (eval cat will see standard invocation without
 * pre-written evidence — backward-compat with current behavior).
 */
export function writeF167SnapshotYaml(opts: WriteF167SnapshotOpts): WriteF167SnapshotResult {
  const snapshotName = `${opts.dateStr}-f167-${opts.domainSlug}-snapshot.yaml`;
  const snapshotPath = join(opts.harnessFeedbackRoot, 'snapshots', snapshotName);
  const doSnakeCase = opts.snakeCase ?? true;
  const serializable = doSnakeCase ? snakeCaseKeys(opts.snapshot) : opts.snapshot;
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, stringifyYaml(serializable), 'utf8');
  return { snapshotName, snapshotPath };
}
