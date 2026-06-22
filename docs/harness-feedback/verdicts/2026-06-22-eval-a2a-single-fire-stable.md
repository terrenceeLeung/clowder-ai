---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-22-eval-a2a-single-fire-stable
source_snapshot: "snapshot:bundle/2026-06-22-eval-a2a-single-fire-stable/snapshot"
---

# Live Verdict — 2026-06-22-eval-a2a-single-fire-stable

- Verdict: `keep_observe`
- Phenomenon: eval:a2a remains single-fire after the 2026-05-29 boundary-race double-fire. The legacy digest overlap remains disabled and registry legacyScheduledTaskIds is still empty.
- Harness: F167/eval-domain-daily (daily eval domain scheduler slot guard)
- Owner ask: No scheduler code change now; continue daily monitoring and keep legacy harness-fit-digest disabled.
- Re-eval: Keep exactly one eval:a2a RUN_DELIVERED entry per UTC day and keep dynamic_task_defs/ledger counts for harness-fit-digest at zero through the next 72-hour window. at 2026-06-25T02:59:59.899Z

Evidence:
- snapshot:bundle/2026-06-22-eval-a2a-single-fire-stable/snapshot
- attribution:bundle/2026-06-22-eval-a2a-single-fire-stable/eval-F167-2026-06-22:no-finding
- metric:eval_domain_daily.eval_a2a_runs_per_day
- metric:eval_domain_daily.eval_a2a_duplicate_runs_per_day
- metric:legacy.registry_legacy_ids_empty
- metric:legacy.dynamic_task_defs.harness_fit_digest_count
- metric:legacy.task_run_ledger.harness_fit_digest_count
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:198408
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:198405
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:104835,104837
- docs:harness-feedback/eval-domains/eval-a2a.yaml

Counterarguments:
- A clean streak can still miss rare boundary timing regressions.
- This verdict validates eval:a2a scheduler stability only; unrelated eval domains may still have separate configuration or provenance drift.
