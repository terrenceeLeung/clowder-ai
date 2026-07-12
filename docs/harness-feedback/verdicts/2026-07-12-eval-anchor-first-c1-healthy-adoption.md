---
feature_ids: [F192, F236]
topics: [harness-eval, eval-anchor-first, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:anchor-first
packet_id: 2026-07-12-eval-anchor-first-c1-healthy-adoption
source_snapshot: "snapshot:bundle/2026-07-12-eval-anchor-first-c1-healthy-adoption/snapshot"
---

# Live Verdict — 2026-07-12-eval-anchor-first-c1-healthy-adoption

- Verdict: `keep_observe`
- Phenomenon: The latest 24h anchor-first window shows active thread-context/list-tasks preview usage with zero observed drills and no orphan-drill pressure. Cross-reading the latest completed eval:task-outcome verdicts shows ongoing cadence/governance defects, not a corrected_success or needs_investigation deterioration correlated with anchor usage.
- Harness: F236/anchor-telemetry-rollup (anchor-first preview/drill open-rate rollup)
- Owner ask: Keep anchor-first live on thread-context and list-tasks; continue observing pending-mentions/get-message until they accumulate real 24h traffic and drill-bearing samples.
- Re-eval: Another weekly 24h window shows either sustained zero-tax behavior with no task-outcome quality regression, or enough pending-mentions/get-message traffic to broaden coverage without introducing anchor-tax signals. at 2026-07-19T03:00:00.119Z

Sunset Signal Assessment:
- thread-context: HEALTHY (openRate=0.0%, netBenefit=323120)
- list-tasks: HEALTHY (openRate=0.0%, netBenefit=0)

Open-Rate Detail:
- thread-context: 0.0% open rate (0/242 items), charsSaved=323120, drillChars=0, netBenefit=323120
- list-tasks: 0.0% open rate (0/17 items), charsSaved=0, drillChars=0, netBenefit=0
- Orphan drills: 0

Adoption Detail:
- explicitAnchorCalls=11; explicitFullCalls=10; uniqueCatsExplicitAnchor=1
- defaultAnchorCalls=1; defaultFullCalls=0
- legacyEquivalentAnchorCalls=3; legacyEquivalentFullCalls=0
- unknownModeCalls=0

Evidence:
- snapshot:bundle/2026-07-12-eval-anchor-first-c1-healthy-adoption/snapshot
- attribution:bundle/2026-07-12-eval-anchor-first-c1-healthy-adoption/AF-2026-07-12-thread-context
- attribution:bundle/2026-07-12-eval-anchor-first-c1-healthy-adoption/AF-2026-07-12-list-tasks
- metric:anchor.thread-context.preview_responses
- metric:anchor.list-tasks.preview_responses
- metric:anchor.adoption_explicit_anchor_calls
- metric:anchor.orphan_drills
- trace:anchor-window-1783738800119-1783825200119
- thread:thread_eval_task_outcome/0001783738800303-000860-cf41c0a8
- thread:thread_eval_task_outcome/0001783652400252-000548-276a0b9f

Counterarguments:
- The previous 24h baseline had zero traffic, so the adoption improvement is a sample-volume change more than a product-quality trend.
- A future window with real get-message or taskId drills could surface anchor tax that this quiet window could not reveal.
- Recent eval:task-outcome fix verdicts are real regressions in governance/cadence, so absence of blindness evidence is not the same as proof of no blindness.
