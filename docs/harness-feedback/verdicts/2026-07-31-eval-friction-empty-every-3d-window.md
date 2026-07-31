---
feature_ids: [F245]
topics: [harness-eval, eval-friction, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:friction
packet_id: 2026-07-31-eval-friction-empty-every-3d-window
source_snapshot: "snapshot:bundle/2026-07-31-eval-friction-empty-every-3d-window/snapshot"
---

# Live Verdict — 2026-07-31-eval-friction-empty-every-3d-window

- Verdict: `keep_observe`
- Phenomenon: The current every-3d window from 2026-07-28T03:00:00Z to 2026-07-31T03:00:00Z surfaced no friction signals, no ranked clusters, and no actionable or reference-only candidates. A direct replay of the immediately preceding baseline window from 2026-07-25T03:00:00Z to 2026-07-28T03:00:00Z was also empty, while the live provider remained degraded in rule-only mode with no dropped channels; the published 2026-07-28 verdict artifact is still present on main, so verdict-chain continuity remains stable in background observation.
- Harness: F245/friction-rollup (friction rollup (Top-N + sensorForm))
- Root cause: Leading attribution remains medium-confidence vision_gap: another empty every-3d window, together with an empty replayed baseline and now-stable publication continuity, still points more strongly to F245's uncalibrated assumption that invocation volume would translate into dense friction signals than to a newly emergent runtime collection failure. (confidence medium)
- Owner ask: Keep the every-3d eval running and preserve the current keep_observe stance; treat verdict-chain continuity as background observation unless a future continuity break recurs alongside non-zero clusters or contradictory live-count evidence.
- Re-eval: next eval at 2026-08-03T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-31-eval-friction-empty-every-3d-window/snapshot
- attribution:bundle/2026-07-31-eval-friction-empty-every-3d-window/eval-F245-2026-07-31:no-finding
- metric:friction.cluster_count
- metric:friction.top_cluster_count
- metric:friction.tail_signal_count

Counterarguments:
- Two replayed empty 72h windows are still weak evidence on their own; the interpretation leans on the prior F245 audit more than on this window alone.
- Because the provider is still degraded in rule-only mode, the harness cannot fully distinguish genuine low-friction steady state from under-capture inside the current signal definition.
- Stable continuity over recent boundaries lowers concern about an active publication-chain problem, but it does not explain why the earlier 2026-07-15 to 2026-07-22 gap happened.