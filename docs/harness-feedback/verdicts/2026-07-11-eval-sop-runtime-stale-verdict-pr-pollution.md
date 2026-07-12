---
feature_ids: [F192, F192]
topics: [harness-eval, sop-compliance, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:sop
packet_id: 2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution
window_days: 14
source_snapshot: "snapshot:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/snapshot"
---

# Live Verdict — 2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution

- Verdict: `fix`
- Phenomenon: PR #89 (2026-07-04 first eval:sop verdict) opened but stuck: recorded base 7062de84 diverges from origin/main by 48 commits, causing 89-file diff instead of expected 6 verdict artifacts + CI failures (Test Public, Directory Size Guard). Same runtime-stale symptom family as eval:a2a PR #100 / #104 / #106 findings. Root cause hypothesis: publish_verdict tool created isolated worktree from stale runtime/main-sync pointer (e9c57dfc, 2026-06-14) instead of current origin/main.
- Harness: F192/publish-verdict-tool (sop-compliance)
- Owner ask: Investigate publish_verdict tool base-branch selection for eval:sop domain: (1) determine why PR #89 base was 7062de84 (48 commits behind main) instead of current origin/main tip; (2) compare with eval:a2a #106 (clean 4-file base at main tip) publish path; (3) either fix server-side base logic to always target origin/main, or document eval-cat cwd requirement in domain runbook. Cross-reference recent eval:a2a runtime-stale findings (#100 / #104 / #106) which point at the same symptom family.
- Re-eval: next eval at 2026-07-25T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/snapshot
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-0
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-1
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-2
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-3
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-4
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-5
- attribution:bundle/2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution/SOP-2026-07-11-eval-sop-runtime-stale-verdict-pr-pollution-6
- metric:sop_violations_blocker
- metric:sop_violations_warn
- metric:sop_rules_passed
- metric:sop_rules_skipped

## SOP Evaluation Detail

| Status | Count |
|--------|-------|
| Passed | 5 |
| Violations | 7 |
| Skipped (manual) | 10 |

## Violations

### impl-redis-6398-only (blocker)

- Stage: impl
- Predicate: env_check
- Message: env REDIS_URL="redis://localhost:6399" must include ":6398"
- Trace Anchor: env:REDIS_URL=redis://localhost:6399

### impl-user-journey-missing (blocker)

- Stage: impl
- Predicate: command_pattern
- Message: required command pattern "pnpm check:features|node scripts/check-feature-truth" not found (or failed) in session commands
- Trace Anchor: commands:[git checkout -b verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),git commit -m "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix"(exit:0),git push origin verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),gh pr create --title "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix" --base main(exit:0)]

### quality-gate-full-test-evidence (blocker)

- Stage: quality_gate
- Predicate: command_pattern
- Message: required command pattern "pnpm gate|pnpm test|pnpm --filter .* test|node --test" not found (or failed) in session commands
- Trace Anchor: commands:[git checkout -b verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),git commit -m "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix"(exit:0),git push origin verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),gh pr create --title "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix" --base main(exit:0)]

### review-no-self-review (blocker)

- Stage: review
- Predicate: handle_check
- Message: no reviewer assigned
- Trace Anchor: handles:reviewer=<unset>

### merge-github-squash-only (blocker)

- Stage: merge
- Predicate: command_pattern
- Message: required command pattern "gh pr merge .*--squash" not found (or failed) in session commands
- Trace Anchor: commands:[git checkout -b verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),git commit -m "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix"(exit:0),git push origin verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix(exit:0),gh pr create --title "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix" --base main(exit:0)]

### completion-pr-merged-feature-check (blocker)

- Stage: completion
- Predicate: command_sequence
- Message: required command "gh pr view" missing from sequence
- Trace Anchor: commands:[git checkout -b verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix,git commit -m "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix",git push origin verdict/auto/eval-sop/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix,gh pr create --title "verdict(eval:sop): 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix" --base main]

### completion-missing-guardian-handoff (blocker)

- Stage: completion
- Predicate: handle_check
- Message: guardian handoff not present
- Trace Anchor: handles:guardian=<unset>
