---
feature_ids: [F192, F203]
topics: [harness-eval, capability-wakeup, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:capability-wakeup
packet_id: 2026-07-26-eval-capability-wakeup-workspace-navigator-r2-diverse-sample
source_snapshot: "snapshot:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-diverse-sample/snapshot"
---

# Live Verdict — 2026-07-26-eval-capability-wakeup-workspace-navigator-r2-diverse-sample

- Verdict: `keep_observe`
- Phenomenon: R2 workspace-navigator eval with 4x expanded diverse sample (20 sessions vs R1 5, added fable5/gpt52 cats vs R1 sol/opus only) across 14-day window. Testing if R1 finding (2/2 opportunities missed, both cognitive) generalizes across cats/threads or was thread-local artifact.
- Harness: F203/workspace-navigator (workspace-navigator)
- Owner ask: Compare R2 label distribution to R1 (2 cognitive/0 behavioral/0 attention_dilution); if cognitive still dominant and opportunity_count >= 5 accumulated across R1+R2, escalate R3 to fix verdict with skill discovery improvement ownerAsk
- Re-eval: next eval at 2026-08-02T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-diverse-sample/snapshot
- attribution:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-diverse-sample/CW-workspace_navigator-2026-07-26
- metric:capability-wakeup/workspace-navigator/opportunity_count
- metric:capability-wakeup/workspace-navigator/miss_count
- metric:capability-wakeup/workspace-navigator/cognitive_count
- metric:capability-wakeup/workspace-navigator/behavioral_count
- metric:capability-wakeup/workspace-navigator/attention_dilution_count
