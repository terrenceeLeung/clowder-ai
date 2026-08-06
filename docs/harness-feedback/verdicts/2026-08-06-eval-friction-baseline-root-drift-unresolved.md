---
feature_ids: [F245]
topics: [harness-eval, eval-friction, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:friction
packet_id: 2026-08-06-eval-friction-baseline-root-drift-unresolved
source_snapshot: "snapshot:bundle/2026-08-06-eval-friction-baseline-root-drift-unresolved/snapshot"
---

# Live Verdict — 2026-08-06-eval-friction-baseline-root-drift-unresolved

- Verdict: `fix`
- Phenomenon: The current 72h window from 2026-08-03T03:00:00Z to 2026-08-06T03:00:00Z is empty in both roots, but a dual-root replay still reproduces unresolved under-capture in the immediately preceding baseline window: the configured provider root yields 0 signals while the monorepo docs root yields 2 eval-domain signals (`violations_blocker=6`, `rules_skipped=10`) from the 2026-08-01 eval:sop bundle.
- Harness: F245/friction-rollup (friction rollup)
- Root cause: Environment drift remains the best explanation: the live friction provider still has a path-selection or checkout-resolution mismatch that can hide eval-domain bundles under the configured root even though the same code and adjacent monorepo docs root surface the expected signals. (confidence medium)
- Owner ask: Confirm the live process resolves harnessFeedbackRoot against the monorepo docs root (or an explicit equivalent), add fail-loud diagnostics when bundles/ is missing under the chosen root, and re-run eval:friction until configured-root replay matches monorepo-root replay on adjacent baseline/current windows without manual root substitution.
- Re-eval: next eval at 2026-08-09T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-08-06-eval-friction-baseline-root-drift-unresolved/snapshot
- attribution:bundle/2026-08-06-eval-friction-baseline-root-drift-unresolved/eval-F245-2026-08-06:no-finding
- metric://baseline.provider_root.signal_count=0
- metric://baseline.provider_root.cluster_count=0
- metric://baseline.monorepo_root.signal_count=2
- metric://baseline.monorepo_root.cluster_count=2
- metric://baseline.monorepo_root.eval_domain.violations_blocker=6
- metric://baseline.monorepo_root.eval_domain.rules_skipped=10
- metric://current.provider_root.signal_count=0
- metric://current.provider_root.cluster_count=0
- metric://current.monorepo_root.signal_count=0
- metric://current.monorepo_root.cluster_count=0
- metric://baseline.root_delta.signal_count=2
- metric://current.root_delta.signal_count=0

Counterarguments:
- A keep_observe verdict is plausible because the current 2026-08-03T03:00:00Z to 2026-08-06T03:00:00Z window is empty in both roots, so the user-visible rollup for this run has no active friction clusters.
- Static source and dist code in this checkout both resolve the monorepo root correctly, so the defect may live in one specific runtime launch context rather than in the committed code path itself.
- This packet relies on dual-root command replay plus the committed 2026-08-01 eval:sop bundle because the local friction artifact trail around 2026-08-03 is incomplete in this checkout.