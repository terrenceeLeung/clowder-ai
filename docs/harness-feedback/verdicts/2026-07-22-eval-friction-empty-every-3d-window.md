---
feature_ids: [F245]
topics: [harness-eval, eval-friction, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:friction
packet_id: 2026-07-22-eval-friction-empty-every-3d-window
source_snapshot: "snapshot:bundle/2026-07-22-eval-friction-empty-every-3d-window/snapshot"
---

# Live Verdict — 2026-07-22-eval-friction-empty-every-3d-window

- Verdict: `keep_observe`
- Phenomenon: The current every-3d window 2026-07-19T03:00:00Z to 2026-07-22T03:00:00Z surfaced no friction signals, no ranked clusters, and no actionable or reference-only candidates. A direct replay of the immediately preceding baseline window 2026-07-16T03:00:00Z to 2026-07-19T03:00:00Z was also empty, while the live provider remained degraded in rule-only mode with no dropped channels.
- Harness: F245/friction-rollup (friction rollup (Top-N + sensorForm))
- Root cause: Leading attribution remains medium-confidence vision_gap: repeated empty every-3d windows are still better explained by F245's uncalibrated assumption that invocation volume would translate into dense friction signals than by a newly emergent runtime collection failure. (confidence medium)
- Owner ask: Keep the every-3d eval running and preserve the current keep_observe stance; only escalate if a future 72h window surfaces non-zero clusters or contradictory live-count evidence.
- Re-eval: next eval at 2026-07-25T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-22-eval-friction-empty-every-3d-window/snapshot
- attribution:bundle/2026-07-22-eval-friction-empty-every-3d-window/eval-F245-2026-07-22:no-finding
- metric:friction.cluster_count
- metric:friction.top_cluster_count
- metric:friction.tail_signal_count

Counterarguments:
- Two replayed empty 72h windows are still weak evidence on their own; the interpretation leans on the prior F245 audit more than on this window alone.
- Because the provider is still degraded in rule-only mode, the harness cannot fully distinguish genuine low-friction steady state from under-capture inside the current signal definition.
- The absence of published 2026-07-18 and 2026-07-21 verdict artifacts means this verdict re-establishes current state from direct replay rather than from a fully continuous published trail.