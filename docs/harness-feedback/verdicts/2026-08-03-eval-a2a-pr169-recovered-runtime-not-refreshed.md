---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-08-03-eval-a2a-pr169-recovered-runtime-not-refreshed
source_snapshot: "snapshot:bundle/2026-08-03-eval-a2a-pr169-recovered-runtime-not-refreshed/snapshot"
---

# Live Verdict — 2026-08-03-eval-a2a-pr169-recovered-runtime-not-refreshed

- Verdict: `fix`
- Phenomenon: PR #169 restored F167 Path B and the grounding hasSamples confidence rule on origin/main, but the 2026-08-03 eval:a2a callback still had no sourceRefs or counter_window. The active API process PID 21571 has not restarted after PR #169 and the runtime checkout remains four commits behind origin/main, so the recovered code is not loaded.
- Harness: F167/grounding-phase-o (F167 Phase O A2A sourceRefs and grounding telemetry)
- Owner ask: Pull origin/main into the runtime checkout, rebuild packages/api/dist, and restart API PID 21571 while ensuring the checkout is anchored to origin/main rather than upstream/main. Separately assign the public-test redis exclusion expiry and Directory Size Guard exception expiry so PR signal is not polluted.
- Re-eval: The next scheduled eval:a2a callback includes sourceRefs for a prewritten F167 snapshot/attribution, exposes counter_window/counterWindow, and reports grounding-phase-o with sample-backed low-or-better confidence instead of no-data. at 2026-08-04T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-03-eval-a2a-pr169-recovered-runtime-not-refreshed/snapshot
- attribution:bundle/2026-08-03-eval-a2a-pr169-recovered-runtime-not-refreshed/f167-pr169-recovered-origin-but-runtime-not-refreshed
- metric:eval-domain-daily/eval_domain_daily.eval_a2a_runs_per_day
- metric:eval-domain-daily/legacy.task_run_ledger.harness_fit_digest_runs
- metric:origin-recovery-lineage/implementation.pr169_state_merged
- metric:origin-recovery-lineage/implementation.origin_main_contains_cron_predefine_file
- metric:runtime-refresh/runtime.checkout_behind_origin_main_commits
- metric:runtime-refresh/runtime.pid_21571_not_restarted_after_pr169_merge
- metric:counter-window/telemetry.prewritten_source_refs_missing
- metric:grounding-phase-o/telemetry.pr169_recovery_not_loaded_by_runtime
- ledger:task_run_ledger/424533
- process:pid/21571
- git:runtime-head/c055fc45
- git:origin-main/dc87ef80
- github:pr/169
- github-actions:run/30730141632

Counterarguments:
- The scheduler and legacy cleanup remain healthy: the daily eval fired exactly once and harness-fit-digest is still disabled, so this is not a cron scheduling regression.
- origin/main is now recovered after PR #169, so continuing to call this a sync-clobber-only finding would be stale; the active blocker has shifted to runtime checkout/build/restart discipline.
