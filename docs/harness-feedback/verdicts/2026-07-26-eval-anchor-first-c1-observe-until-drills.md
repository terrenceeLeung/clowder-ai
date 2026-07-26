---
feature_ids: [F192, F236]
topics: [harness-eval, eval-anchor-first, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:anchor-first
packet_id: 2026-07-26-eval-anchor-first-c1-observe-until-drills
source_snapshot: "snapshot:bundle/2026-07-26-eval-anchor-first-c1-observe-until-drills/snapshot"
---

# Live Verdict — 2026-07-26-eval-anchor-first-c1-observe-until-drills

- Verdict: `keep_observe`
- Phenomenon: The current 24h anchor-first window remains in observation territory unless the live rollup surfaces a new anchor-tax tool; the latest completed eval:task-outcome evidence still points to cadence/governance fix packets rather than corrected_success or needs_investigation deterioration correlated with anchor usage.
- Harness: F236/anchor-telemetry-rollup (anchor-first preview/drill open-rate rollup)
- Owner ask: Keep anchor-first live on thread-context and list-tasks; continue observing pending-mentions/get-message until they accumulate real 24h traffic and drill-bearing samples.
- Re-eval: Another weekly 24h window shows either sustained zero-tax behavior with no task-outcome quality regression, or enough pending-mentions/get-message traffic to broaden coverage without introducing anchor-tax signals. at 2026-08-02T03:00:00Z

Sunset Signal Assessment:

Open-Rate Detail:
- Orphan drills: 0

Adoption Detail:
- explicitAnchorCalls=0; explicitFullCalls=0; uniqueCatsExplicitAnchor=0
- defaultAnchorCalls=0; defaultFullCalls=0
- legacyEquivalentAnchorCalls=0; legacyEquivalentFullCalls=0
- unknownModeCalls=0

Evidence:
- snapshot:bundle/2026-07-26-eval-anchor-first-c1-observe-until-drills/snapshot
- attribution:bundle/2026-07-26-eval-anchor-first-c1-observe-until-drills/eval-F236-2026-07-26:no-finding
- metric:anchor.thread-context.preview_responses
- metric:anchor.list-tasks.preview_responses
- metric:anchor.adoption_explicit_anchor_calls
- metric:anchor.orphan_drills
- trace:anchor-window-1784948399396-1785034799396
- thread:thread_eval_task_outcome/0001783738800303-000860-cf41c0a8
- thread:thread_eval_task_outcome/0001783652400252-000548-276a0b9f

Counterarguments:
- The previous healthy window may no longer represent current usage, so a newly drill-heavy week could warrant upgrading to fix before merge.
- Absence of blindness evidence is not proof of safety when task-outcome throughput is sparse or governance-dominated.
- If the live rollup resolves anchor-tax on any high-traffic tool, this keep_observe packet should not be merged as-is.
