---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-08-02-eval-a2a-third-sync-clobber-after-runtime-restart
source_snapshot: "snapshot:bundle/2026-08-02-eval-a2a-third-sync-clobber-after-runtime-restart/snapshot"
---

# Live Verdict — 2026-08-02-eval-a2a-third-sync-clobber-after-runtime-restart

- Verdict: `fix`
- Phenomenon: The eval:a2a daily scheduler fired exactly once and the old harness-fit-digest task remains absent, but the 2026-08-02 callback still had no sourceRefs or counter_window. The new API process did restart, yet it is running a checkout that lost the PR #134 Path B recovery and the PR #116 grounding confidence fix.
- Harness: F167/grounding-phase-o (F167 Phase O A2A sourceRefs and grounding telemetry)
- Owner ask: Recover PR #134's Path B and PR #116 confidence fix onto current origin/main again, then coordinate a rebuild/restart of API PID 21571. Treat the recurring upstream sync-clobber as P0 systemic work: add a pre-sync guard or equivalent fail-fast check before the next sync window.
- Re-eval: The next eval:a2a callback includes sourceRefs for a prewritten F167 snapshot/attribution, exposes counter_window/counterWindow, and reports grounding-phase-o with sample-backed low-or-better confidence instead of no-data. at 2026-08-03T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-02-eval-a2a-third-sync-clobber-after-runtime-restart/snapshot
- attribution:bundle/2026-08-02-eval-a2a-third-sync-clobber-after-runtime-restart/f167-third-sync-clobber-after-runtime-restart
- metric:eval-domain-daily/eval_domain_daily.eval_a2a_runs_per_day
- metric:eval-domain-daily/legacy.task_run_ledger.harness_fit_digest_runs
- metric:runtime-checkout/runtime.checkout_not_on_origin_main_head
- metric:runtime-checkout/runtime.origin_main_lacks_pr134_recovery_commit
- metric:counter-window/telemetry.prewritten_source_refs_missing
- metric:implementation-lineage/implementation.pr134_not_ancestor_of_origin_main
- metric:implementation-lineage/implementation.origin_main_missing_cron_predefine_file
- metric:implementation-lineage/implementation.origin_main_missing_grounding_has_samples_confidence_rule
- ledger:task_run_ledger/418935
- process:pid/21571
- git:runtime-head/e0c11043
- git:origin-main/c055fc45
- github:pr/134
- github:pr/160

Counterarguments:
- The daily scheduler itself is healthy: one eval:a2a RUN_DELIVERED occurred on 2026-08-02 and the legacy scheduled task is still disabled, so the verdict should not be interpreted as a cron duplicate or missed-trigger bug.
- The runtime process did restart, which resolves the previous process-staleness hypothesis; the remaining failure is that both the runtime checkout and origin/main no longer contain the recovered F167 code line.
