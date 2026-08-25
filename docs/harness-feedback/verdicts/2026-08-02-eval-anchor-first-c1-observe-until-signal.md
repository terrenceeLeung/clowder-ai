---
feature_ids: [F192, F236]
topics: [harness-eval, eval-anchor-first, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:anchor-first
packet_id: 2026-08-02-eval-anchor-first-c1-observe-until-signal
source_snapshot: "snapshot:bundle/2026-08-02-eval-anchor-first-c1-observe-until-signal/snapshot"
---

# Live Verdict — 2026-08-02-eval-anchor-first-c1-observe-until-signal

- Verdict: `keep_observe`
- Phenomenon: The latest completed cross-signal evidence still points to task-outcome cadence/governance fix loops rather than corrected_success or needs_investigation deterioration correlated with anchor usage. Unless the live 24h rollup surfaces a new anchor-tax tool, this window remains in observation territory.
- Harness: F236/anchor-telemetry-rollup (anchor-first preview/drill open-rate rollup)
- Owner ask: Keep anchor-first live on thread-context and list-tasks; continue observing pending-mentions/get-message until they accumulate real 24h traffic and drill-bearing samples.
- Re-eval: Another weekly 24h window shows either sustained zero-tax behavior with no task-outcome quality regression, or enough pending-mentions/get-message traffic to broaden coverage without introducing anchor-tax signals. at 2026-08-09T03:00:00Z

Sunset Signal Assessment:
- list-tasks: LOW_SAMPLE (openRate=0.0%, netBenefit=0)
- thread-context: LOW_SAMPLE (openRate=0.0%, netBenefit=2542)

Open-Rate Detail:
- list-tasks: 0.0% open rate (0/1 items), charsSaved=0, drillChars=0, netBenefit=0
- thread-context: 0.0% open rate (0/5 items), charsSaved=2542, drillChars=0, netBenefit=2542
- Orphan drills: 0

Adoption Detail:
- explicitAnchorCalls=1; explicitFullCalls=0; uniqueCatsExplicitAnchor=1
- defaultAnchorCalls=0; defaultFullCalls=0
- legacyEquivalentAnchorCalls=1; legacyEquivalentFullCalls=0
- unknownModeCalls=0

Evidence:
- snapshot:bundle/2026-08-02-eval-anchor-first-c1-observe-until-signal/snapshot
- attribution:bundle/2026-08-02-eval-anchor-first-c1-observe-until-signal/eval-F236-2026-08-02:no-finding
- metric:anchor.thread-context.preview_responses
- metric:anchor.list-tasks.preview_responses
- metric:anchor.adoption_explicit_anchor_calls
- metric:anchor.orphan_drills
- trace:anchor-window-1785553200083-1785639600083
- thread:thread_eval_task_outcome/0001785553200153-001993-b250cdfc
- thread:thread_eval_task_outcome/0001785466800113-001565-039515f5

Counterarguments:
- The live rollup may now contain non-empty preview/drill joins, making this pre-publish observation hypothesis stale and requiring a fix verdict.
- Absence of blindness evidence is not proof of safety when task-outcome throughput remains governance-dominated.
- A future high-open-rate negative-netBenefit tool should flip this domain from observe to fix even if task-outcome still lacks explicit blindness evidence.
