---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-07-11-eval-a2a-runtime-still-stale-after-pr102-dist-ready
source_snapshot: "snapshot:bundle/2026-07-11-eval-a2a-runtime-still-stale-after-pr102-dist-ready/snapshot"
---

# Live Verdict — 2026-07-11-eval-a2a-runtime-still-stale-after-pr102-dist-ready

- Verdict: `fix`
- Phenomenon: The 2026-07-11 eval:a2a cron delivery again had no sourceRefs, counter_window, or grounding-phase-o data. Source and dist now contain PR #102 wiring, but the running node dist/index.js process PID 52824 still predates the PR #102 merge and has not been restarted.
- Harness: F167/f167-runtime-eval-telemetry (A2A runtime eval telemetry prewrite coverage)
- Owner ask: Approve and perform a restart of PID 52824 / packages/api node dist/index.js so the rebuilt dist containing PR #102 is loaded, then have F167 owner verify the next eval:a2a callback includes sourceRefs plus parseable raw YAML and non-no-data counterWindow/grounding-phase-o evidence.
- Re-eval: After restart, the next eval:a2a callback includes sourceRefs.snapshotName and sourceRefs.attributionName, the referenced raw YAML parses, bundle snapshot includes counterWindow.durationHours, and grounding-phase-o reports check/verdict/sample counters or a justified zero-observation state rather than no-data. at 2026-07-12T03:00:00Z

Evidence:
- snapshot:bundle/2026-07-11-eval-a2a-runtime-still-stale-after-pr102-dist-ready/snapshot
- attribution:bundle/2026-07-11-eval-a2a-runtime-still-stale-after-pr102-dist-ready/f167-runtime-still-stale-after-pr102-dist-ready
- metric:task_run_ledger:309837
- metric:eval_a2a_runs_per_day=1
- metric:single_fire_streak_days=43
- metric:legacy_harness_fit_digest_defs=0
- metric:legacy_harness_fit_digest_runs=0
- metric:git:origin/main@a6028c115260
- metric:build:dist_contains_prewrite_path=1
- metric:process:pid_52824_node_dist_index_started_before_pr102=1
- metric:telemetry:prewritten_source_refs_missing=1
- metric:telemetry:api_3004_connect_failed=1
- metadata:task_run_ledger/309837/eval:a2a/RUN_DELIVERED

Counterarguments:
- The scheduler slot guard remains healthy with a 43-day single-fire streak, so this verdict is not about duplicate scheduling.
- Source and dist are already ready, so no code PR is indicated unless restart still fails to produce sourceRefs.
- Restarting a runtime process can cause brief local downtime, so operator control is appropriate even though the technical fix is straightforward.
