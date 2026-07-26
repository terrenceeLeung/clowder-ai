---
feature_ids: [F192, F192]
topics: [harness-eval, sop-compliance, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:sop
packet_id: 2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale
window_days: 14
source_snapshot: "snapshot:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/snapshot"
---

# Live Verdict — 2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale

- Verdict: `keep_observe`
- Phenomenon: Re-eval of 2026-07-11 fix verdict (runtime-stale verdict PR pollution). PR #113 published clean (6-file diff, base at current origin/main tip) and merged 2026-07-12T03:10:19Z; closure condition 'diff ≤ 10 files + CI passes' MET. Recent 2 weeks: no eval:sop publish regressions observed. However, cross-domain observation — eval:a2a #141 (2026-07-25) reports 'pr134-runtime-refresh-blocker-day-3' (recurrent operational blocker), and main worktree HEAD remains at d5961fe3 (12 commits behind origin/main tip c5f1d404) since @opus's 2026-07-11 owner-ask to co-creator went unactioned.
- Harness: F192/publish-verdict-tool (sop-compliance)
- Owner ask: Prior fix closure confirmed for eval:sop scope. No action required from F192 owner for this domain. Coordinate with eval:a2a owner if the operational asks (API restart + main worktree pull) escalate — those are cross-domain infrastructure hygiene, not eval:sop-specific.
- Re-eval: next eval at 2026-08-08T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/snapshot
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-0
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-1
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-2
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-3
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-4
- attribution:bundle/2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale/SOP-2026-07-25-eval-sop-reeval-closure-prior-fix-runtime-stale-5
- metric:sop_violations_blocker
- metric:sop_violations_warn
- metric:sop_rules_passed
- metric:sop_rules_skipped

## SOP Evaluation Detail

| Status | Count |
|--------|-------|
| Passed | 6 |
| Violations | 6 |
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
- Trace Anchor: commands:[gh pr merge 113 --squash --delete-branch(exit:0)]

### quality-gate-full-test-evidence (blocker)

- Stage: quality_gate
- Predicate: command_pattern
- Message: required command pattern "pnpm gate|pnpm test|pnpm --filter .* test|node --test" not found (or failed) in session commands
- Trace Anchor: commands:[gh pr merge 113 --squash --delete-branch(exit:0)]

### review-no-self-review (blocker)

- Stage: review
- Predicate: handle_check
- Message: no reviewer assigned
- Trace Anchor: handles:reviewer=<unset>

### completion-pr-merged-feature-check (blocker)

- Stage: completion
- Predicate: command_sequence
- Message: required command "gh pr view" missing from sequence
- Trace Anchor: commands:[gh pr merge 113 --squash --delete-branch]

### completion-missing-guardian-handoff (blocker)

- Stage: completion
- Predicate: handle_check
- Message: guardian handoff not present
- Trace Anchor: handles:guardian=<unset>
