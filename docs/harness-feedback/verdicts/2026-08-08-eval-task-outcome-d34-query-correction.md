---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-08-08-eval-task-outcome-d34-query-correction
source_snapshot: "snapshot:bundle/2026-08-08-eval-task-outcome-d34-query-correction/snapshot"
---

# Live Verdict — 2026-08-08-eval-task-outcome-d34-query-correction

- Verdict: `keep_observe`
- Phenomenon: Day 34 — self-correction. Prior verdicts (Day 32/33) queried category='proposal_reject' but the schema stores it as category='a2' with inner JSON record.type='proposal_reject'. Real numbers: proposal_reject 24h=3 (2 session_handoff by sol, 1 thread by fable5), 7d=5, cumulative=13. The 'zero-delta 15 days' claim was measurement error, not signal absence. Direction regressed today. Still below 5-cluster threshold so no drill fires.
- Harness: F192/eval:task-outcome (Task Outcome Eval Loop)
- Owner ask: Apply corrected query to next 3 cycles for baseline recalibration. If 24h reaches 5 or sol session_handoff pattern repeats 3+ consecutive days, escalate to drill.
- Re-eval: next eval at 2026-08-10T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-08-eval-task-outcome-d34-query-correction/snapshot
- attribution:bundle/2026-08-08-eval-task-outcome-d34-query-correction/eval-F192-2026-08-08:no-finding
- metric:proposal_reject_24h=3
- metric:proposal_reject_7d=5
- metric:proposal_reject_cumulative=13
- metric:session_handoff_variant=7
- metric:thread_variant=6
- metric:a1_completions_24h=6
- metric:episodes_terminal_total=91
- metric:days_beyond_sla=38

Counterarguments:
- Perhaps the measurement bug is itself the verdict — rejected as separate: bug fixed inline, verdict addresses signal not tooling.
- Perhaps this warrants a fix verdict for the eval query itself — rejected: query is my own operational SQL, not shipped harness code; no PR needed, correction is in the bundle.
- Perhaps direction should be 'unknown' not 'regressed' given baseline was wrong — considered but rejected: 3 rejects same day is regressed vs any recent day's max of 2 (07-14).