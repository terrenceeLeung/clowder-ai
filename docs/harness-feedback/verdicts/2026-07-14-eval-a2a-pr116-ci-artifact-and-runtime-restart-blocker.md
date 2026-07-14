---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-07-14-eval-a2a-pr116-ci-artifact-and-runtime-restart-blocker
source_snapshot: "snapshot:bundle/2026-07-14-eval-a2a-pr116-ci-artifact-and-runtime-restart-blocker/snapshot"
---

# Live Verdict — 2026-07-14-eval-a2a-pr116-ci-artifact-and-runtime-restart-blocker

- Verdict: `fix`
- Phenomenon: The F167 samples-only confidence fix exists as PR #116 and its focused f167-eval tests pass, but it cannot reach the 2026-07-15 acceptance run yet: Test Public is blocked by a pre-existing 2026-07-09 live verdict artifact, and the active eval runtime is still the 2026-07-11 node dist/index.js process. The raw 2026-07-14 snapshot stays healthy on sourceRefs/counter_window and has 119 grounding samples with 0 mismatches, but grounding-phase-o still reports no-data because the new confidence rule is not merged or loaded.
- Harness: F167/f167-grounding-phase-o-release-acceptance (A2A grounding Phase O confidence fix release path)
- Owner ask: Unblock the F167 PR #116 release path before the 2026-07-15 eval:a2a run: amend the pre-existing 2026-07-09 eval:a2a live verdict metric URI so Test Public can pass, rerun/merge PR #116 after CI is green, then coordinate a rebuild/restart of the active eval runtime PID 43487 so the samples-only confidence rule is loaded.
- Re-eval: PR #116 or an equivalent confidence fix is merged, Test Public no longer fails on the old live verdict artifact, the eval runtime has been rebuilt/restarted after that merge, and the next eval:a2a bundle keeps sourceRefs/counterWindow while grounding-phase-o reports confidence low or better with 0 mismatches. at 2026-07-15T03:00:00Z

Evidence:
- snapshot:bundle/2026-07-14-eval-a2a-pr116-ci-artifact-and-runtime-restart-blocker/snapshot
- attribution:bundle/2026-07-14-eval-a2a-pr116-ci-artifact-and-runtime-restart-blocker/f167-pr116-release-blocked-by-live-verdict-artifact-and-runtime-stale
- metric:task_run_ledger:327962
- metric:eval_a2a_runs_per_day=1
- metric:single_fire_streak_days=46
- metric:legacy_harness_fit_digest_defs=0
- metric:legacy_harness_fit_digest_runs=0
- metric:sourceRefs_snapshotName_present=1
- metric:counter_window_duration_hours=66.02166614981472
- metric:grounding_sample_count=119
- metric:grounding_mismatch_sample_count=0
- metric:grounding_no_data=1
- metric:pr116_open=1
- metric:pr116_test_public_failure=1
- metric:pr116_focused_f167_tests_pass=1
- metric:runtime_loaded_pr116=0
- metadata:task_run_ledger/327962/eval:a2a/RUN_DELIVERED
- github:pr/116/head/56fe0ad1e51062d8f20293dd2732d5524cf80930
- github:pr/116/comment/4964991109
- process:node-dist-index/pid-43487/start-2026-07-11T08:58:41Z

Counterarguments:
- The raw 2026-07-14 telemetry trend is not worse: sourceRefs, counter_window, single-fire scheduler behavior, and zero grounding mismatches are all healthy.
- PR #116 code review found no blocking implementation issue, so this verdict should not be interpreted as a request to redesign the confidence fix.
- Because 2026-07-15 was already the re-eval target, one could wait another day; however the CI artifact blocker and stale runtime are visible now and make the acceptance miss predictable unless fixed before the next cron.
