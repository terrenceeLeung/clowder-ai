---
feature_ids: [F192, F167]
topics: [harness-eval, eval-a2a, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:a2a
packet_id: 2026-08-25-eval-a2a-source-staleness-keep-observe
source_snapshot: "snapshot:bundle/2026-08-25-eval-a2a-source-staleness-keep-observe/snapshot"
---

# Live Verdict — 2026-08-25-eval-a2a-source-staleness-keep-observe

- Verdict: `keep_observe`
- Phenomenon: The 2026-08-25 eval:a2a scheduler delivered exactly once and legacy harness-fit-digest remains disabled, but no raw f167-a2a sourceRefs were prewritten for either 2026-08-24 or 2026-08-25. Because counter_window and fresh guard subdomain counters are unavailable, the F267 keep_observe_only gate prevents a fix/build verdict.
- Harness: F167/f167-eval-source-ref-prewrite (A2A eval sourceRefs prewrite and fresh guard telemetry availability)
- Owner ask: Keep observing eval:a2a; do not open a F167 fix/build from this packet. Verify the sourceRefs prewrite or authenticated telemetry source path before treating future zero-tolerance guard metrics as fresh evidence.
- Re-eval: Within the next 72h eval window, eval:a2a either prewrites fresh raw sourceRefs with counter_window.duration_hours and guard subdomain counters, or records an explicit skipped/no-source status while legacy harness-fit-digest remains disabled. at 2026-08-28T03:03:17Z

Evidence:
- snapshot:bundle/2026-08-25-eval-a2a-source-staleness-keep-observe/snapshot
- attribution:bundle/2026-08-25-eval-a2a-source-staleness-keep-observe/f167-eval-a2a-raw-source-stale-after-recovered-cron
- metric:telemetry_gaps=6
- metric:components.covered=3
- metric:legacyscheduledtaskids=0
- metric:counter_window.duration_hours
- ledger:task_run_ledger/668794
- ledger:task_run_ledger/629915
- github:pr/207
- git:origin-main/904f0824c09390e13ea9b92726c9d73534162874
- http:127.0.0.1:3006/api/telemetry/metrics=401
- snapshot:2026-08-25-f167-a2a-snapshot.yaml
- attribution:2026-08-25-f167-a2a-attribution.yaml

Counterarguments:
- This evidence does not prove F167 guard regressions; it proves current-source telemetry is unavailable to the eval loop.
- Daily keep_observe PRs add noise, but without a rollup sink the current F192 publish contract still uses evidence PRs for durable observations.
- The recovered cron streak is healthy, so the finding should stay on publication/source freshness rather than scheduler duplicate or missed-run handling.
