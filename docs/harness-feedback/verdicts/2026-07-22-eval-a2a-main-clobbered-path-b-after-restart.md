---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-07-22-eval-a2a-main-clobbered-path-b-after-restart
source_snapshot: "snapshot:bundle/2026-07-22-eval-a2a-main-clobbered-path-b-after-restart/snapshot"
---

# Live Verdict — 2026-07-22-eval-a2a-main-clobbered-path-b-after-restart

- Verdict: `fix`
- Phenomenon: After a four-day eval:a2a scheduler gap, the 2026-07-22 callback fired once but again omitted sourceRefs and counter_window. Runtime preflight shows the old PID 43487 blocker is gone; the active runtime is a post-PR #116 process on current main, but current main no longer contains PR #102 path B, PR #116 grounding confidence, or the #119/#120 evidence-only CI unblock commits.
- Harness: F167/f167-phase-o-path-b (F167 Phase O A2A runtime eval sourceRefs prewrite and grounding confidence)
- Owner ask: Restore PR #102's F167 cron-side sourceRefs prewrite and PR #116's grounding samples-only confidence rule onto current origin/main, verify #119/#120 evidence URI amendments are not lost, then rebuild/restart runtime and add a sync-clobber guard so future upstream syncs cannot silently drop recently merged F167/eval verdict fixes.
- Re-eval: The next eval:a2a callback includes sourceRefs for 2026-07-23 raw YAML; the generated bundle has counterWindow.durationHours, current HEAD contains the restored PR #102 and PR #116 changes, grounding-phase-o reports low or better confidence when sample-store evidence exists, and task_run_ledger has no additional missed daily eval:a2a gap. at 2026-07-23T03:00:00Z

Evidence:
- snapshot:bundle/2026-07-22-eval-a2a-main-clobbered-path-b-after-restart/snapshot
- attribution:bundle/2026-07-22-eval-a2a-main-clobbered-path-b-after-restart/f167-main-clobbered-path-b-and-pr116-after-runtime-restart
- metric:eval-domain-daily/missed_daily_runs_since_prior
- metric:source-refs-prewrite/prewritten_source_refs_missing
- metric:implementation-lineage/pr102_not_ancestor_of_head
- metric:implementation-lineage/pr116_not_ancestor_of_head
- metric:runtime-preflight/process_started_after_pr116
- ledger:task_run_ledger/353666
- ledger:task_run_ledger/346220
- process:pid/2344
- git:head/d5961fe3

Counterarguments:
- A one-off manual restart or daemon outage could account for the 7/18-7/21 schedule gap, so that portion should not be over-attributed to sync clobber without separate scheduler diagnostics.
- If upstream intentionally rewrote main to match clowder-ai and discard local verdict branches, the right remedy may be a governance decision about sync policy rather than another restoration PR.
- Because today's raw snapshot is diagnostic rather than runtime-prewritten, it should not be mistaken for proof that the F167 prewrite path emitted data; it is only a stable sourceRefs anchor for the observed failure.
