---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-23-eval-a2a-single-fire-stable
source_snapshot: "snapshot:bundle/2026-06-23-eval-a2a-single-fire-stable/snapshot"
---

# Live Verdict — 2026-06-23-eval-a2a-single-fire-stable

- Verdict: `keep_observe`
- Phenomenon: eval:a2a remains single-fire after the 2026-05-29 boundary-race double-fire, with 25 consecutive single-fire days through 2026-06-23. Legacy harness-fit-digest overlap remains disabled; counter-window and grounding Phase O telemetry are unavailable in the accessible evidence for this run and are treated as telemetry gaps, not healthy signals.
- Harness: F167/eval-domain-daily (daily eval domain scheduler slot guard)
- Owner ask: No scheduler code change now; continue daily monitoring, keep legacy harness-fit-digest disabled, and treat counter-window/grounding as telemetry gaps until an authenticated runtime snapshot supplies those fields.
- Re-eval: Keep exactly one eval:a2a RUN_DELIVERED entry per UTC day, keep dynamic_task_defs/ledger counts for harness-fit-digest at zero, and prefer counter_window plus grounding-phase-o evidence when authenticated telemetry is available. at 2026-06-26T02:59:59.920Z

Evidence:
- snapshot:bundle/2026-06-23-eval-a2a-single-fire-stable/snapshot
- attribution:bundle/2026-06-23-eval-a2a-single-fire-stable/eval-F167-2026-06-23:no-finding
- metric:eval_domain_daily.eval_a2a_runs_per_day
- metric:eval_domain_daily.eval_a2a_duplicate_runs_per_day
- metric:legacy.registry_legacy_ids_empty
- metric:legacy.dynamic_task_defs.harness_fit_digest_count
- metric:legacy.task_run_ledger.harness_fit_digest_count
- metric:telemetry.counter_window.present
- metric:grounding-phase-o.confidence_no_data
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:202559
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:198408
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:104835,104837
- docs:harness-feedback/eval-domains/eval-a2a.yaml
- http://127.0.0.1:3004/api/telemetry/process-info#401-auth-required

Counterarguments:
- A clean streak can still miss rare boundary timing regressions.
- Because counter_window is absent in the accessible raw evidence, counter-derived rates were not computed and may underreport if inferred from the 24h trace window.
- grounding-phase-o no-data is not proof of healthy grounding distribution; it may indicate no stateful tool calls, missing hook wiring, or unavailable authenticated telemetry.
- This verdict validates eval:a2a scheduler stability only; unrelated eval domains may still have separate configuration or provenance drift.
