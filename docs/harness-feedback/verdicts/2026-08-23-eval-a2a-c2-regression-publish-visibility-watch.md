---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-08-23-eval-a2a-c2-regression-publish-visibility-watch
source_snapshot: "snapshot:bundle/2026-08-23-eval-a2a-c2-regression-publish-visibility-watch/snapshot"
---

# Live Verdict — 2026-08-23-eval-a2a-c2-regression-publish-visibility-watch

- Verdict: `keep_observe`
- Phenomenon: The eval:a2a daily lane fired exactly once for a third recovered day and the Phase Q, event-backed routing, action-successor, grounding, and Phase T zero-tolerance metrics remain healthy. However C2 recorded one product-thread verdict_without_pass sample and the F267 measurement baseline is only partially visible in canonical history: measurement-bundles.yaml exists in local runtime/main-sync HEAD but not origin/main, while referenced artifact dirs remain untracked.
- Harness: F167/eval:a2a (F167 A2A harness eval with F267 measurement-publish gate)
- Owner ask: Restore or migrate the canonical F267 measurement baseline into publisher-visible committed history, including the census and referenced artifact graph, then rerun eval:a2a publish; after the gate can publish durable evidence, inspect the 2026-08-23 C2 product-thread reject sample before assigning a fix owner.
- Re-eval: Next eval:a2a run has exactly one daily RUN_DELIVERED row, sourceRefs are prewritten or publish-visible, F267 census/artifact graph is available to isolated publish worktrees, C2 verdict_without_pass_count returns to 0 or the sample is adjudicated benign, and all Phase Q/event-backed/action-successor/Phase T zero-tolerance metrics remain 0. at 2026-08-24T03:00:00Z

Evidence:
- snapshot:bundle/2026-08-23-eval-a2a-c2-regression-publish-visibility-watch/snapshot
- attribution:bundle/2026-08-23-eval-a2a-c2-regression-publish-visibility-watch/f167-eval-a2a-publication-baseline-still-insufficient
- metric:counter_window.duration_hours
- metric:c2.verdict_without_pass_count
- metric:grounding.mismatch_sample_count
- metric:hold_lifecycle.expired_after_satisfied_total
- metric:event_wait.false_bypass_total
- metric:successor.action_fence_unavailable
- metric:turn_custody.new_only_classification_gap_total
- C2/c2.verdict_without_pass_count/12a53876f2e2aa17883440d063c01832
- metadata:eval-domain-daily:589106

Counterarguments:
- A keep_observe verdict may understate the C2 regression because the threshold for c2.verdict_without_pass_count is 0; the decision is constrained by one hashed sample and the current F267 keep-observe-only measurement gate.
- A local runtime/main-sync commit now contains measurement-bundles.yaml, so the old 500 may no longer reproduce from this exact checkout; origin/main and the artifact graph are still not canonical complete truth.
- The 2026-08-15 through 2026-08-20 missing daily rows are historical traceability debt, not evidence that today's scheduler path failed.
