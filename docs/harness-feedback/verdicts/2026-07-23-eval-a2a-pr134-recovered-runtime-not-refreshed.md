---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-07-23-eval-a2a-pr134-recovered-runtime-not-refreshed
source_snapshot: "snapshot:bundle/2026-07-23-eval-a2a-pr134-recovered-runtime-not-refreshed/snapshot"
---

# Live Verdict — 2026-07-23-eval-a2a-pr134-recovered-runtime-not-refreshed

- Verdict: `fix`
- Phenomenon: The 2026-07-23 eval:a2a callback fired once, so the 7/18-7/21 scheduler gap did not repeat, and PR #134 has restored the F167 path B/confidence code on remote main. The callback still omitted sourceRefs and counter_window because active PID 2344 is running a 2026-07-21 checkout at d5961fe3, six commits behind origin/main and started before PR #134 merged.
- Harness: F167/f167-phase-o-path-b (F167 Phase O A2A runtime eval sourceRefs prewrite and grounding confidence)
- Owner ask: Pull origin/main into the runtime checkout, rebuild packages/api, restart PID 2344 onto post-PR #134 code, then verify the next eval:a2a callback includes sourceRefs and counter_window. Separately assign an owner for the sync-clobber guard so PR #134 does not become the second temporary recovery only.
- Re-eval: The runtime process starts after PR #134, local HEAD matches origin/main, the eval:a2a callback supplies 2026-07-24 sourceRefs, the bundle contains counterWindow.durationHours, and grounding-phase-o reports low or better confidence when sample-store evidence exists. at 2026-07-24T03:00:00Z

Evidence:
- snapshot:bundle/2026-07-23-eval-a2a-pr134-recovered-runtime-not-refreshed/snapshot
- attribution:bundle/2026-07-23-eval-a2a-pr134-recovered-runtime-not-refreshed/f167-pr134-recovered-remote-but-runtime-not-refreshed
- metric:eval-domain-daily/eval_a2a_runs_since_prior
- metric:source-refs-prewrite/prewritten_source_refs_missing
- metric:runtime-preflight/local_head_behind_origin_main_commits
- metric:runtime-preflight/process_started_before_pr134
- metric:implementation-lineage/pr134_merged_remote
- ledger:task_run_ledger/359673
- process:pid/2344
- git:head/d5961fe3
- git:origin-main/3ab53aaf
- github:pr/134

Counterarguments:
- A restart is an operator-controlled local process action; using a fix verdict here may look like a code ask even though the code recovery already landed remotely.
- Because today's raw snapshot is diagnostic rather than runtime-prewritten, it should not be treated as evidence that F167 path B is functioning in-process.
- The day-over-day direction is improved due to PR #134 and scheduler continuity, so the remaining blocker is narrower than the 2026-07-22 sync-clobber regression even though the verdict remains fix.
