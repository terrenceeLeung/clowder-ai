---
feature_ids: [F245]
topics: [harness-eval, eval-friction, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:friction
packet_id: 2026-08-03-eval-friction-eval-domain-root-drift
source_snapshot: "snapshot:bundle/2026-08-03-eval-friction-eval-domain-root-drift/snapshot"
---

# Live Verdict — 2026-08-03-eval-friction-eval-domain-root-drift

- Verdict: `fix`
- Phenomenon: The live friction provider replayed the current every-3d window from 2026-07-31T03:00:00Z to 2026-08-03T03:00:00Z as empty when it read from `/packages/api/docs/harness-feedback`, but a corrected replay of the same window against the monorepo docs root surfaced two eval-domain clusters (`violations_blocker=6`, `rules_skipped=10`) sourced from the 2026-08-01 eval:sop bundle. The immediately preceding baseline window from 2026-07-28T03:00:00Z to 2026-07-31T03:00:00Z remained empty in both replays, so the discrepancy is current-window under-capture, not a stable all-zero result.
- Harness: F245/friction-rollup (friction rollup (Top-N + sensorForm))
- Root cause: Medium-confidence environment_drift: the live friction provider is resolving `harnessFeedbackRoot` under `packages/api/docs/harness-feedback`, which is empty in this runtime checkout, while the monorepo docs root contains current non-zero eval-domain bundles. The current zero rollup is therefore under-capturing recent eval-domain friction rather than reflecting a trustworthy all-channel empty window. (confidence medium)
- Owner ask: Repair the friction provider's harness-feedback root / runtime checkout alignment so eval-domain adapter reads the current monorepo `docs/harness-feedback` bundles, then rerun the current 72h rollup before relying on zero-signal conclusions.
- Re-eval: next eval at 2026-08-06T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-08-03-eval-friction-eval-domain-root-drift/snapshot
- attribution:bundle/2026-08-03-eval-friction-eval-domain-root-drift/FR-2026-08-03-3aa52c4cc410
- metric:friction.cluster_count
- metric:friction.top_cluster_count
- metric:friction.tail_signal_count
- metric:eval-domain.sop-compliance.violations_blocker
- metric:eval-domain.sop-compliance.rules_skipped

Counterarguments:
- The other three live adapters (paw-feel, cancel, user-feedback) still replayed as zero, so the under-capture may affect only eval-domain context rather than the underlying friction trend.
- The corrected-root replay surfaced low-severity eval-domain clusters from another eval domain, not direct user-facing friction, so the urgency is about harness correctness rather than immediate operator pain.
- Because publish_verdict currently resolves the selector through the live provider, this PR's generated friction bundle will still reflect the empty provider-root view; the fix verdict is grounded in the cross-check evidence above, not in the generated raw rollup alone.