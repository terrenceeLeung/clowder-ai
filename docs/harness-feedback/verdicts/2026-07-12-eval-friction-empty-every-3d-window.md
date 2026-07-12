---
feature_ids: [F245]
topics: [harness-eval, eval-friction, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:friction
packet_id: 2026-07-12-eval-friction-empty-every-3d-window
source_snapshot: "snapshot:bundle/2026-07-12-eval-friction-empty-every-3d-window/snapshot"
---

# Live Verdict — 2026-07-12-eval-friction-empty-every-3d-window

- Verdict: `keep_observe`
- Phenomenon: The current every-3d window 2026-07-09T03:00:00Z to 2026-07-12T03:00:00Z surfaced no friction signals, no ranked clusters, and no actionable or reference-only candidates. The immediately preceding baseline window 2026-07-06T03:00:00Z to 2026-07-09T03:00:00Z was also empty; the live provider remained degraded in rule-only mode with no dropped channels.
- Harness: F245/friction-rollup (friction rollup (Top-N + sensorForm))
- Root cause: Leading attribution is medium-confidence vision_gap: repeated empty every-3d windows are now better explained by F245's uncalibrated assumption that invocation volume would translate into dense friction signals than by a newly emergent runtime collection failure. The rollup remains degraded because embeddings are unavailable or not used, which lowers confidence but does not contradict the empty live counts. (confidence medium)
- Owner ask: Keep the every-3d eval running, carry forward the already-converged lessons/reflection follow-through separately from this evidence-only window, and only escalate if a future window surfaces non-zero clusters or contradictory live-count evidence.
- Re-eval: next eval at 2026-07-15T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-07-12-eval-friction-empty-every-3d-window/snapshot
- attribution:bundle/2026-07-12-eval-friction-empty-every-3d-window/FR-2026-07-12-328d554241c5
- metric:friction.cluster_count
- metric:friction.top_cluster_count
- metric:friction.tail_signal_count

Counterarguments:
- Two consecutive empty 72h windows are weak evidence on their own; the interpretation is strengthened mainly by the background audit, not by this window alone.
- Because the rollup is still degraded in rule-only mode, the harness cannot fully distinguish genuine low-friction steady state from under-capture in the present signal definition.
- A keep_observe verdict can under-react if a real friction source sits outside the current four adapters, so contradictory future evidence should override this stance.