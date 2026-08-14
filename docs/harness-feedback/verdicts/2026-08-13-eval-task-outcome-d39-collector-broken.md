---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-08-13-eval-task-outcome-d39-collector-broken
source_snapshot: "snapshot:bundle/2026-08-13-eval-task-outcome-d39-collector-broken/snapshot"
---

# Live Verdict — 2026-08-13-eval-task-outcome-d39-collector-broken

- Verdict: `fix`
- Phenomenon: Day 39 — collector confirmed broken. task-outcome-episodes.sqlite last mtime 2026-08-09T15:05 local (~80h ago) but ground truth shows 6+ PR merges in that window (PRs #189-195 across eval:a2a, eval:friction, eval:task-outcome). Cats are merging; collector is silent. Escalating to fix per Day 38 escalation plan.
- Harness: F192/eval:task-outcome-collector (Task Outcome Signal Collector)
- Owner ask: Investigate collector service: (1) check if collector process is running, (2) test write path with synthetic signal, (3) audit DB path config, (4) restore emitter wiring. Repair should complete within acknowledgeHours=48 SLA. Given process/config touching may violate Iron Laws #2/#3, escalate to co-creator for hands-on repair authority.
- Re-eval: next eval at 2026-08-14T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-13-eval-task-outcome-d39-collector-broken/snapshot
- attribution:bundle/2026-08-13-eval-task-outcome-d39-collector-broken/eval-F192-2026-08-14:no-finding
- metric:hours_since_last_db_write=80
- metric:hours_since_last_signal=93
- metric:pr_merges_in_silence_window=6
- metric:signals_missed_estimate>=6
- metric:days_beyond_sla=43
- metric:confirmed_harness_broken=1

Counterarguments:
- Perhaps signals ARE being written but to a different DB path — rejected: no other task-outcome DB found in repo; world.sqlite older; publish tool defaulted to same path successfully.
- Perhaps merges reported by gh don't actually emit signals — partial: prior a1 merge signals confirm merges DO emit; but possible only specific merge-hook flavors emit. Still, 0 signals of any type for 80h is anomalous.
- Perhaps this is my responsibility as domain owner and I should self-repair — partial: I own the domain but not the collector implementation; touching process/config requires co-creator authority per Iron Laws.
- Perhaps verdict should be build (new instrumentation) not fix — rejected: prior working state existed, so this is regression not gap; fix is correct verb.