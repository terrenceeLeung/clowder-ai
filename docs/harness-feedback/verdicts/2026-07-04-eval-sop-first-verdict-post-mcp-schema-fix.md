---
feature_ids: [F192, F192]
topics: [harness-eval, sop-compliance, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:sop
packet_id: 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix
window_days: 14
source_snapshot: "snapshot:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/snapshot"
---

# Live Verdict — 2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix

- Verdict: `keep_observe`
- Phenomenon: First eval:sop verdict since MCP schema fix (PR #54 / e9c57dfc, 2026-06-14) unblocked the publish pipeline. Traced PR #54's own merge stage as the evaluated dev cycle — clean squash-merge with cross-family review, all merge-stage predicates verifiable from git/gh state.
- Harness: F192/development (sop-compliance)
- Owner ask: No action required; keep observing. Follow-up: consider adding SOP-trace telemetry ingestion for kickoff/impl/quality_gate/review stages so future evals cover the full lifecycle rather than merge-only PR-derived slices.
- Re-eval: next eval at 2026-07-18T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/snapshot
- attribution:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/SOP-2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix-0
- attribution:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/SOP-2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix-1
- attribution:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/SOP-2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix-2
- attribution:bundle/2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix/SOP-2026-07-04-eval-sop-first-verdict-post-mcp-schema-fix-3
- metric:sop_violations_blocker
- metric:sop_violations_warn
- metric:sop_rules_passed
- metric:sop_rules_skipped

## SOP Evaluation Detail

| Status | Count |
|--------|-------|
| Passed | 7 |
| Violations | 4 |
| Skipped (manual) | 8 |

## Violations

### impl-redis-6398-only (blocker)

- Stage: impl
- Predicate: env_check
- Message: env REDIS_URL="<unset>" must include ":6398"
- Trace Anchor: env:REDIS_URL=<unset>

### quality-gate-full-test-evidence (blocker)

- Stage: quality_gate
- Predicate: command_pattern
- Message: required command pattern "pnpm gate|pnpm test|pnpm --filter .* test|node --test" not found in session commands
- Trace Anchor: commands:[git checkout -b fix/f192-sop-sourceRefs-schema,git commit -m "fix(mcp-server): add sop-trace-eval to publish-verdict sourceRefs union",gh pr create --title "fix(mcp-server): add sop-trace-eval to publish-verdict sourceRefs union" --base main,gh pr merge 54 --squash --delete-branch]

### completion-pr-merged-feature-check (blocker)

- Stage: completion
- Predicate: command_sequence
- Message: required command "gh pr view" missing from sequence
- Trace Anchor: commands:[git checkout -b fix/f192-sop-sourceRefs-schema,git commit -m "fix(mcp-server): add sop-trace-eval to publish-verdict sourceRefs union",gh pr create --title "fix(mcp-server): add sop-trace-eval to publish-verdict sourceRefs union" --base main,gh pr merge 54 --squash --delete-branch]

### completion-missing-guardian-handoff (blocker)

- Stage: completion
- Predicate: handle_check
- Message: guardian handoff not present
- Trace Anchor: handles:guardian=<unset>
