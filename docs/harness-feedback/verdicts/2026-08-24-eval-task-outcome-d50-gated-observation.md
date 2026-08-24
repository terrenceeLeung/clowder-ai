---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-08-24-eval-task-outcome-d50-gated-observation
source_snapshot: "snapshot:bundle/2026-08-24-eval-task-outcome-d50-gated-observation/snapshot"
---

# Live Verdict — 2026-08-24-eval-task-outcome-d50-gated-observation

- Verdict: `keep_observe`
- Phenomenon: Day 50 — 4th consecutive day since Day 47 backfill with zero new signals. 56 in_progress episodes from that batch still all in_progress (72h+ with no terminal transitions). Latest signal remains 2026-08-21T01:13:32Z. Analysis converges on real-time collector regression — verdict WOULD be fix, but F275 measurement_validity_gate forces keep_observe_only for this domain (hardBlockReason: Canonical measurement bundle evidence is not checked in). Recording the observation and gate rejection.
- Harness: F192/eval:task-outcome-collector (Task Outcome Signal Collector)
- Owner ask: Two asks. (1) Investigate F275 measurement bundle evidence prerequisite for eval:task-outcome — what artifacts need to be committed to lift keep_observe_only gate? (2) Independently investigate real-time collector regression: check ingest process, audit stuck in_progress lifecycle, restore streaming capture. Both require co-creator authority (governance + process/config).
- Re-eval: next eval at 2026-08-25T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-24-eval-task-outcome-d50-gated-observation/snapshot
- attribution:bundle/2026-08-24-eval-task-outcome-d50-gated-observation/eval-F192-2026-08-24:no-finding
- metric:current.merge_signals
- metric:current.a1_signals
- metric:current.a2_signals
- metric:current.proposal_reject_signals
- metric:current.magic_word_signals
- metric:current.permission_cancel_signals
- metric:current.in_progress
- metric:current.episodes
- metric:current.signals
- metric:baseline7d.a1_signals
- metric:baseline7d.signals

Counterarguments:
- Perhaps keep_observe is the correct verdict anyway given 4-day silence could theoretically be genuine — rejected: 96h+ silence + stuck lifecycle is objectively fix-worthy; keep_observe here is compliance not analysis.
- Perhaps I should just skip publishing until gate lifts — rejected: gate is a governance safety, not a silence directive; recording the observation + gate rejection maintains audit trail.
- Perhaps F275 gate is a hint that eval:task-outcome should be sunset — partial: possible interpretation, but sunset also blocked by keep_observe_only; would need explicit co-creator direction.