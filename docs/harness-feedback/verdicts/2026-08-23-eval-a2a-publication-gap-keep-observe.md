---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-08-23-eval-a2a-publication-gap-keep-observe
source_snapshot: "snapshot:bundle/2026-08-23-eval-a2a-publication-gap-keep-observe/snapshot"
---

# Live Verdict — 2026-08-23-eval-a2a-publication-gap-keep-observe

- Verdict: `keep_observe`
- Phenomenon: The 2026-08-23 eval:a2a lane recovered to three consecutive single daily runs and the F167 zero-tolerance guard metrics remain healthy, but scheduled sourceRefs prewrite is still absent and the F267 measurement baseline is not fully canonical. One C2 verdict-without-pass sample appeared, so this is a keep-observe evidence verdict rather than a fix/build handoff.
- Harness: F167/f167-runtime-eval-publication-validity (A2A runtime eval publication validity and guard telemetry)
- Owner ask: Keep observing eval:a2a; do not open a F167 code fix from this packet. Re-check sourceRefs prewrite, F267 canonical baseline visibility, and the C2 sample after the measurement gate is usable.
- Re-eval: Within the next 72h eval window, keep zero-tolerance F167 metrics at 0, preserve daily single-fire with legacy scheduled tasks disabled, and either restore sourceRefs prewrite plus canonical F267 visibility or keep publication-gap verdicts evidence-only. at 2026-08-26T03:06:13Z

Evidence:
- snapshot:bundle/2026-08-23-eval-a2a-publication-gap-keep-observe/snapshot
- attribution:bundle/2026-08-23-eval-a2a-publication-gap-keep-observe/f167-eval-a2a-publication-baseline-still-insufficient
- metric:counter_window.duration_hours=49.881241854861116
- metric:telemetry_gaps=0
- metric:components.covered=10
- metric:c2.checked=78
- metric:c2.verdict_without_pass_count=1
- metric:grounding.check_total=0
- metric:grounding.verdict_total=0
- metric:grounding.mismatch_sample_count=0
- metric:hold_lifecycle.event_retired_total=0
- metric:hold_lifecycle.stale_wake_suppressed_total=0
- metric:hold_lifecycle.expired_after_satisfied_total=0
- metric:event_wait.false_bypass_total=0
- metric:event_wait.rejected_other_total=2
- metric:event_wait.redundant_hold_prevented_total=0
- metric:successor.single_target_multi_mention_rate=0
- metric:successor.unfenced_single_target_multi_mention=0
- metric:successor.action_fence_unavailable=0
- metric:successor.agent_key_action_rejected=0
- metric:turn_custody.unknown_legacy_rate=0.0125
- metric:turn_custody.new_only_block_total=0
- metric:turn_custody.new_only_unjustified_total=0
- metric:turn_custody.new_only_unexplained_total=0
- metric:turn_custody.new_only_classification_gap_total=0
- metric:turn_custody.protocol_action_without_custody_total=0
- metric:turn_custody.user_nudge_required_total=0
- metric:turn_custody.same_subject_post_terminal_enqueue_total=0
- metric:turn_custody.lease_succeeded_subject_nonterminal_total=0
- metric:legacyscheduledtaskids=0
- ledger:task_run_ledger/589106
- trace:12a53876f2e2aa17883440d063c01832
- trace:8cdac21637ae3d6cb783e819dd1c42ba
- process:pid/58400
- snapshot:2026-08-23-f167-a2a-snapshot.yaml
- attribution:2026-08-23-f167-a2a-attribution.yaml

Counterarguments:
- A high-severity publication validity finding remains open, so keep_observe should not be read as clean health.
- C2 regressed from 0 to 1 sample day over day; the verdict stays observe only because the sample is single-fire metadata and measurement publication is still insufficient.
- Using 2026-08-23 sourceRefs on 2026-08-24 carries a source freshness risk because today’s telemetry endpoints require session auth from shell and no 2026-08-24 raw evidence exists yet.
