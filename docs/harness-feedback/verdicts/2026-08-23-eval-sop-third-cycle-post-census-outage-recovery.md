---
feature_ids: [F192, F192]
topics: [harness-eval, sop-compliance, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:sop
packet_id: 2026-08-23-eval-sop-third-cycle-post-census-outage-recovery
window_days: 14
source_snapshot: "snapshot:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/snapshot"
---

# Live Verdict — 2026-08-23-eval-sop-third-cycle-post-census-outage-recovery

- Verdict: `keep_observe`
- Phenomenon: Third clean-cycle anchor for eval:sop (referencing PR #165 merged 2026-08-02) plus recovery record for a same-day publish outage. First publish attempt at 03:04 UTC returned 500 ENOENT for missing docs/harness-feedback/registry/measurement-bundles.yaml — census file dependency never seeded. Root cause diagnosed via code inspection (measurement-bundle-census-file.ts:30 hard-reads path; git-worktree-publisher.ts:19 whitelists it). Cross-domain impact verified via gh: no verdict PRs merged 03:00-03:06 UTC across all domains. Handoff to @opus (F192 owner) at 03:04 UTC; co-creator seeded PR #198 (merged 03:06 UTC), pipeline unblocked. Verified: eval:qc #200 (03:08) and eval:capability-wakeup #201 (03:09) subsequently published successfully.
- Harness: F192/publish-verdict-tool (sop-compliance)
- Owner ask: Two follow-ups: (1) land opus-46's ENOENT-to-domain-error code patch (currently written + TDD-green but not yet PR'd) so future census gaps surface as actionable errors rather than generic 500s; (2) consider adding CI check that ALLOWED_EXACT_PATHS whitelist entries exist in repo tip — addresses the recurring 'code adds dependency, artifact not committed' pattern (same class as 2026-07-11 MCP schema gap). Neither blocks current publish operations.
- Re-eval: next eval at 2026-08-30T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/snapshot
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-0
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-1
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-2
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-3
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-4
- attribution:bundle/2026-08-23-eval-sop-third-cycle-post-census-outage-recovery/SOP-2026-08-23-eval-sop-third-cycle-post-census-outage-recovery-5
- metric:sop_violations_blocker
- metric:sop_violations_warn
- metric:sop_rules_passed
- metric:sop_rules_skipped

## SOP Evaluation Detail

| Status | Count |
|--------|-------|
| Passed | 7 |
| Violations | 6 |
| Skipped (manual) | 11 |

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
- Trace Anchor: commands:[gh pr merge 165 --squash --delete-branch(exit:0)]

### quality-gate-risk-matched-evidence (blocker)

- Stage: quality_gate
- Predicate: command_pattern
- Message: required command pattern "pnpm gate|pnpm (check|lint|test)|pnpm --filter .* test|node --test|git diff --check" not found (or failed) in session commands
- Trace Anchor: commands:[gh pr merge 165 --squash --delete-branch(exit:0)]

### review-no-self-review (blocker)

- Stage: review
- Predicate: handle_check
- Message: no reviewer assigned
- Trace Anchor: handles:reviewer=<unset>

### completion-pr-merged-feature-check (blocker)

- Stage: completion
- Predicate: command_sequence
- Message: required command "gh pr view" missing from sequence
- Trace Anchor: commands:[gh pr merge 165 --squash --delete-branch]

### completion-missing-guardian-handoff (blocker)

- Stage: completion
- Predicate: handle_check
- Message: guardian handoff not present
- Trace Anchor: handles:guardian=<unset>
