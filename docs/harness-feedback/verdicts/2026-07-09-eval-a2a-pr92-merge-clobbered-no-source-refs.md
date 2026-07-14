---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-07-09-eval-a2a-pr92-merge-clobbered-no-source-refs
source_snapshot: "snapshot:bundle/2026-07-09-eval-a2a-pr92-merge-clobbered-no-source-refs/snapshot"
---

# Live Verdict — 2026-07-09-eval-a2a-pr92-merge-clobbered-no-source-refs

- Verdict: `fix`
- Phenomenon: The eval:a2a daily scheduler fired exactly once on 2026-07-09 and legacy harness-fit-digest remains absent, but the F167 Phase O path B implementation did not reach the active main/runtime. PR #92 is marked merged at a4abd0f14cd7, yet current origin/main is ab006afb and diverges from that merge commit; the cron invocation produced no sourceRefs, no 2026-07-09 prewritten snapshot, and no trusted counter_window or grounding Phase O data.
- Harness: F167/eval-domain-daily-f167-phase-o-prewrite (A2A daily eval scheduler and F167 Phase O cron-side telemetry prewrite)
- Owner ask: Restore the PR #92 F167 Phase O path B implementation onto the current origin/main lineage (or otherwise restore a main tip containing a4abd0f14cd7), then restart/pull the runtime. Before the next eval:a2a cron, verify origin/main contains cron-predefine.ts, cron-telemetry-source.ts, snapshot-writer.ts, and bootstrap InProcessCronTelemetrySource wiring; also coordinate a guard/follow-up for the main sync clobber path so implementation commits are not silently removed by later verdict PR merges.
- Re-eval: The active main/runtime includes the F167 Phase O path B implementation, the scheduled eval:a2a invocation carries sourceRefs or writes a 2026-07-10 precomputed raw snapshot, and the bundle snapshot contains counterWindow/counter_window with a real duration plus a grounding-phase-o component populated from the grounding sample store. If counterWindow.durationHours is below 2 after a recent restart, report rate confidence downgraded but treat wiring as present. at 2026-07-10T03:00:00Z

Evidence:
- snapshot:bundle/2026-07-09-eval-a2a-pr92-merge-clobbered-no-source-refs/snapshot
- attribution:bundle/2026-07-09-eval-a2a-pr92-merge-clobbered-no-source-refs/f167-pr92-merge-clobbered-from-current-main
- metric:sqlite://evidence.sqlite/task_run_ledger?id=298383
- metric:sqlite://evidence.sqlite/dynamic_task_defs?harness-fit-digest=count:0
- metric:git-grep://origin/main/InProcessCronTelemetrySource=count:0
- metric:snapshot-preexist/2026-07-09-f167-a2a-snapshot=false
- metadata://eval-a2a/2026-07-09/no-runtime-sourceRefs
- metadata://node-fetch/127.0.0.1:3004/telemetry-endpoints/fetch-failed

Counterarguments:
- Scheduler and legacy cleanup are still healthy: task_run_ledger row 298383 is a single RUN_DELIVERED and harness-fit-digest remains zero, so this is not a recurrence of the original duplicate cron-slot bug.
- PR #92 did merge successfully at 2026-07-08T03:38:09Z, so the code artifact existed; the failure is that current main/runtime did not retain or deploy it.
- A missing local 3004 listener alone would not justify a fix verdict, but today's scheduled invocation also lacks sourceRefs and current origin/main lacks the implementation files, which together make this an actionable lineage/deploy gap.
