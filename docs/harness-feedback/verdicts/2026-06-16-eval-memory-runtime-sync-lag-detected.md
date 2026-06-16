---
feature_ids: [F192, F192]
topics: [harness-eval, memory-recall, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:memory
packet_id: 2026-06-16-eval-memory-runtime-sync-lag-detected
window_days: 7
source_snapshot: "snapshot:bundle/2026-06-16-eval-memory-runtime-sync-lag-detected/snapshot"
---

# Live Verdict — 2026-06-16-eval-memory-runtime-sync-lag-detected

- Verdict: `fix`
- Phenomenon: Daily eval:memory cron fired again at 2026-06-16T02:59 UTC despite PR #52 having merged yesterday (2026-06-15T03:00:40Z) with frequency changed to weekly. Root cause: runtime/main-sync branch (where the local daemon reads yaml from) is 2 commits behind origin/main — HEAD `e9c57dfc` lacks both `ba47696a` (PR #52 chore) and the verdict PRs that followed. yaml on main = weekly ✅ but yaml the daemon actually loads = daily. This is the hotfix-via-clowder-ai-mirror anti-pattern at Level 2 (Level 1 was upstream cat-cafe sync overrides; Level 2 is downstream runtime sync lag). 7d data still steady (35 events, 24h=17 due to my own publish activity).
- Harness: F192/f192-runtime-sync-pipeline (memory-recall)
- Owner ask: Investigate F192 runtime/main-sync sync mechanism. Either (a) confirm it's expected to auto-sync from main, then fix the lag (currently 2 commits behind); OR (b) confirm it's intentionally manual / boundary-isolated, then document the protocol so yaml chores like PR #52 know they need an additional deployment step. This blocks the eval:memory weekly cadence migration AND every future yaml chore. Discovery context: my PR #52 (yaml daily → weekly) merged 2026-06-15, but today (06-16) daily cron still fired — daemon yaml source is runtime/main-sync HEAD `e9c57dfc` (2 commits behind). LL on hotfix-via-clowder-ai-mirror anti-pattern was almost filed yesterday for the upstream direction; this discovery upgrades it to a two-level gap (upstream sync overrides + downstream runtime lag).
- Re-eval: next eval at 2026-06-23T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-16-eval-memory-runtime-sync-lag-detected/snapshot
- attribution:bundle/2026-06-16-eval-memory-runtime-sync-lag-detected/MEM-2026-06-16-eval-memory-runtime-sync-lag-detected
- metric:recall_events_7d_count=35
- metric:recall_events_24h_count=17
- metric:main_HEAD=6eba5b09
- metric:runtime_HEAD=e9c57dfc
- metric:commits_behind=2
- metric:yaml_on_main=weekly
- metric:yaml_on_runtime=daily
