---
feature_ids: [F192, F203]
topics: [harness-eval, capability-wakeup, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:capability-wakeup
packet_id: 2026-07-26-eval-capability-wakeup-workspace-navigator-r2-fix-cognitive-dominant
source_snapshot: "snapshot:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-fix-cognitive-dominant/snapshot"
---

# Live Verdict — 2026-07-26-eval-capability-wakeup-workspace-navigator-r2-fix-cognitive-dominant

- Verdict: `fix`
- Phenomenon: R2 tool replay (20 sessions, 14d window, 3 cats sol/fable5/gpt52) surfaces 53 workspace-navigator opportunities with 100% miss rate, all 53 labeled cognitive (cats unaware of skill), zero used. R1 finding (2/2 cognitive) generalizes at scale — not thread-local artifact.
- Harness: F203/workspace-navigator (workspace-navigator)
- Owner ask: Broaden workspace-navigator wakeup index entry in CLAUDE.md to cover the actual pattern surface the rule regex matches (打开/看看代码/看看文件/查看文件/帮我打开/open-file-request), OR add JIT reminder when patterns fire; verify via R3 miss-rate drop
- Re-eval: next eval at 2026-08-02T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-fix-cognitive-dominant/snapshot
- attribution:bundle/2026-07-26-eval-capability-wakeup-workspace-navigator-r2-fix-cognitive-dominant/CW-workspace_navigator-2026-07-26
- metric:capability-wakeup/workspace-navigator/opportunity_count=53
- metric:capability-wakeup/workspace-navigator/miss_count=53
- metric:capability-wakeup/workspace-navigator/cognitive_count=53
- metric:capability-wakeup/workspace-navigator/used_count=0
