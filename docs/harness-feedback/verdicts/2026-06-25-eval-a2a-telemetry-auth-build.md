---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-06-25-eval-a2a-telemetry-auth-build
source_snapshot: "snapshot:bundle/2026-06-25-eval-a2a-telemetry-auth-build/snapshot"
---

# Live Verdict — 2026-06-25-eval-a2a-telemetry-auth-build

- Verdict: `build`
- Phenomenon: eval:a2a scheduler behavior remains healthy with 27 consecutive single-fire days through 2026-06-25 and legacy harness-fit-digest still disabled. The counter-window denominator and grounding Phase O telemetry have now been unavailable for three consecutive eval cycles, crossing from known blind spot into a build-worthy eval control-plane telemetry gap.
- Harness: F167/counter-window (counter-window denominator and grounding Phase O telemetry availability)
- Owner ask: Build or wire an authenticated/server-trusted telemetry source for eval:a2a invocations so raw evidence includes counter_window and grounding-phase-o data, or explicitly persists an unavailable/no-stateful-calls reason before the eval cat publishes verdicts.
- Re-eval: A subsequent eval:a2a verdict includes counter_window/counterWindow evidence and grounding-phase-o check/verdict/mismatch data or an explicit trusted no-samples reason, while scheduler ledger remains exactly one eval:a2a RUN_DELIVERED per UTC day and legacy harness-fit-digest remains disabled. at 2026-06-28T02:59:59.831Z

Evidence:
- snapshot:bundle/2026-06-25-eval-a2a-telemetry-auth-build/snapshot
- attribution:bundle/2026-06-25-eval-a2a-telemetry-auth-build/AR-2026-06-25-001
- metric:eval_domain_daily.eval_a2a_runs_per_day
- metric:eval_domain_daily.eval_a2a_duplicate_runs_per_day
- metric:legacy.registry_legacy_ids_empty
- metric:legacy.dynamic_task_defs.harness_fit_digest_count
- metric:legacy.task_run_ledger.harness_fit_digest_count
- metric:telemetry.counter_window.present
- metric:grounding-phase-o.confidence_no_data
- metric:telemetry_gap.counter_window_grounding_consecutive_days
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:214852
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:208705
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:202559
- sqlite:/Users/tianyiliang/projects/cat-cafe-runtime/evidence.sqlite#task_run_ledger:104835,104837
- docs:harness-feedback/eval-domains/eval-a2a.yaml
- http://127.0.0.1:3004/api/telemetry/process-info#connect-failed-2026-06-25
- http://127.0.0.1:3004/api/telemetry/grounding-samples#connect-failed-2026-06-25
- prior-verdict:2026-06-23-eval-a2a-single-fire-stable#telemetry-401
- prior-verdict:2026-06-24-eval-a2a-single-fire-stable#telemetry-401

Counterarguments:
- The scheduler core remains healthy; this build verdict is for F192 observability coverage, not F167 cron-slot dedupe behavior.
- A local API outage on 2026-06-25 could exaggerate the telemetry gap, but the prior two cycles already lacked authenticated telemetry access.
- Grounding no-data may be legitimate if there were no stateful tool calls, but current evidence cannot distinguish that from missing hook wiring.
- Adding telemetry credentials to eval cats must preserve session/data boundaries and should use a server-trusted scoped read path, not user cookie leakage.
