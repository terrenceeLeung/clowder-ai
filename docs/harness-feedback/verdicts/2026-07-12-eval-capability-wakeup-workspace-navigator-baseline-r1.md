---
feature_ids: [F192, F203]
topics: [harness-eval, capability-wakeup, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:capability-wakeup
packet_id: 2026-07-12-eval-capability-wakeup-workspace-navigator-baseline-r1
source_snapshot: "snapshot:bundle/2026-07-12-eval-capability-wakeup-workspace-navigator-baseline-r1/snapshot"
---

# Live Verdict — 2026-07-12-eval-capability-wakeup-workspace-navigator-baseline-r1

- Verdict: `keep_observe`
- Phenomenon: First-round eval of workspace-navigator capability wakeups after 6 scheduled fires accumulated without prior verdict. Replay 5 recent dev sessions across the past week to establish baseline miss classification.
- Harness: F203/workspace-navigator (workspace-navigator)
- Owner ask: Continue weekly eval loop; publish next round with trend comparison; escalate to fix/build if miss_count baseline stabilizes above threshold=3
- Re-eval: next eval at 2026-07-19T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-12-eval-capability-wakeup-workspace-navigator-baseline-r1/snapshot
- attribution:bundle/2026-07-12-eval-capability-wakeup-workspace-navigator-baseline-r1/CW-workspace_navigator-2026-07-12
- metric:capability-wakeup/workspace-navigator/miss_count
- metric:capability-wakeup/workspace-navigator/cognitive_count
- metric:capability-wakeup/workspace-navigator/behavioral_count
- metric:capability-wakeup/workspace-navigator/attention_dilution_count
