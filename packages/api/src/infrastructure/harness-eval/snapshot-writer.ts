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
 *
 * Output format: `--- <frontmatter> ---\n\n<body>` — matches
 * `eval-a2a-artifact-parsers.ts:parseMarkdownYaml` which hard-requires
 * `--- ... ---` frontmatter. Round-tripping through `parseSnapshot()` MUST
 * succeed for the sourceRefs contract to work end-to-end (2026-07-08 review
 * fix per thread_eval_a2a — pure YAML output failed parser round-trip).
 *
 * Field split:
 *   Frontmatter — identity/metadata read by `parsed.frontmatter.*`:
 *     doc_kind, feedback_type, feature_id, eval_snapshot_id, generated_at.
 *   Body — data read by `parsed.body.*`: window, counter_window, components,
 *     data_source, generated_by, trace_store_stats, overall_confidence,
 *     summary, grounding_sample_evidence.
 *
 * Creates snapshots/ subdirectory if absent. Returns the basename +
 * absolute path so callers can put basename into `sourceRefs.snapshotName`
 * and log the absolute path for debugging.
 *
 * Throws on I/O errors. Cron callers should wrap in try/catch and fall back to
 * NOT sending sourceRefs (eval cat will see standard invocation without
 * pre-written evidence — backward-compat with current behavior).
 */
export function writeF167SnapshotYaml(opts: WriteF167SnapshotOpts): WriteF167SnapshotResult {
  const snapshotName = `${opts.dateStr}-f167-${opts.domainSlug}-snapshot.yaml`;
  const snapshotPath = join(opts.harnessFeedbackRoot, 'snapshots', snapshotName);
  const doSnakeCase = opts.snakeCase ?? true;

  // Split the flat RuntimeEvalSnapshot into frontmatter + body groups matching
  // the parser contract. featureId → both feature_id (frontmatter) and the
  // derived eval_snapshot_id; generatedAt → generated_at (frontmatter).
  const {
    featureId,
    generatedAt,
    window,
    counterWindow,
    dataSource,
    generatedBy,
    traceStoreStats,
    components,
    overallConfidence,
    summary,
    groundingSampleEvidence,
  } = opts.snapshot;

  const dateMatch = generatedAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? opts.dateStr;

  const frontmatterObj: Record<string, unknown> = {
    doc_kind: 'harness-feedback',
    feedback_type: 'eval-snapshot',
    feature_id: featureId,
    eval_snapshot_id: `eval-${featureId}-${dateMatch}`,
    generated_at: generatedAt,
  };

  // Transform ComponentHealth[] from generateF167Snapshot's internal shape
  // (componentId / componentName / extended telemetry fields) to the shape
  // parseSnapshot expects (id / name / activationCounts / frictionCounts /
  // confidence). Extra fields (frictionSamples, telemetryGaps, etc.) survive
  // through the passthrough spread so downstream code can still inspect them.
  const transformedComponents = (components as unknown as Array<Record<string, unknown>>).map((c) => {
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c)) {
      if (k !== 'componentId' && k !== 'componentName') rest[k] = v;
    }
    return {
      id: c.componentId ?? c.id ?? '',
      name: c.componentName ?? c.name ?? '',
      ...rest,
    };
  });

  const bodyObj: Record<string, unknown> = {
    window,
    ...(counterWindow !== undefined ? { counterWindow } : {}),
    dataSource,
    generatedBy,
    traceStoreStats,
    components: transformedComponents,
    overallConfidence,
    summary,
    ...(groundingSampleEvidence !== undefined ? { groundingSampleEvidence } : {}),
  };

  const finalFrontmatter = doSnakeCase ? snakeCaseKeys(frontmatterObj) : frontmatterObj;
  const finalBody = doSnakeCase ? snakeCaseKeys(bodyObj) : bodyObj;

  const yamlContent = ['---', stringifyYaml(finalFrontmatter).trimEnd(), '---', '', stringifyYaml(finalBody)].join(
    '\n',
  );

  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, yamlContent, 'utf8');
  return { snapshotName, snapshotPath };
}
