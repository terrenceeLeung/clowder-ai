---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-06-23-task-outcome-week-3-sync-reverted-owner-weekly-decision
source_snapshot: "snapshot:bundle/2026-06-23-task-outcome-week-3-sync-reverted-owner-weekly-decision/snapshot"
---

# Live Verdict — 2026-06-23-task-outcome-week-3-sync-reverted-owner-weekly-decision

- Verdict: `fix`
- Phenomenon: Week 3 reeval triggered on Tuesday 2026-06-23 (NOT the expected Sunday weekly fire). Root cause: the upstream sync commit e199b42e (2026-06-22, 'sync: cat-cafe fa16e769 -> clowder-ai') REVERTED owner Day 5 commit 12d5916c (eval-task-outcome.yaml frequency: weekly). YAML now back to daily, same revert hit eval-memory.yaml (also back to daily). loadRegisteredDomains per-tick file read correctly observed the reverted state, daily task now includes task-outcome again. This is the FIRST week-N+ packet across 14 days to identify a genuine governance/process defect not caused by eval cat error. Secondary: Week 2 Sunday (2026-06-21) weekly fire did happen and the analysis began but the session ended without publish_verdict — Week 2 verdict is missing from the audit trail. Today's invocation effectively covers both Week 2's missed publish AND Week 3's new evidence.
- Harness: F192/eval-domain-registry-sync-governance (Task Outcome Eval Harness (F192 Phase G/H/I) - Week 3 with sync-revert defect)
- Owner ask: Pick one within 1 weekly cycle (by 2026-06-30): (a) Re-apply the weekly change to UPSTREAM cat-cafe repo's eval-task-outcome.yaml (and eval-memory.yaml) so next sync brings it down rather than reverting it - simplest fix, owner's choice if upstream team agrees weekly is correct for both repos. (b) Add a clowder-ai-only override mechanism (e.g. eval-domains-overrides/*.yaml that wins over synced eval-domains/*.yaml at loadRegisteredDomains-time) - more architecturally clean, prevents future sync-reverts of any local-only config decision. (c) Document the constraint that eval-domains/*.yaml is upstream-owned, accept daily as the effective cadence regardless of local intent - explicit no-op resolution if local autonomy isn't worth the architectural cost. ALSO related to (a-c): the broader sync-governance question (which clowder-ai-local files survive sync and which get reverted) likely affects other eval domain configs and is worth its own ADR if not already covered.
- Re-eval: next eval at 2026-06-30T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-23-task-outcome-week-3-sync-reverted-owner-weekly-decision/snapshot
- attribution:bundle/2026-06-23-task-outcome-week-3-sync-reverted-owner-weekly-decision/TO-2026-06-23-open-window
- metric://task_outcome_episodes.count=22 (delta +16 vs Week 1 baseline=6)
- metric://task_outcome_episodes.completed=20 (delta +15)
- metric://task_outcome_episodes.in_progress=2 (proposal_reject ep from Day 4 + magic_word_ref ep from Week 2)
- metric://task_outcome_signals.category=a1.subtype.merge=20 (delta +15)
- metric://task_outcome_signals.category=a2.subtype.proposal_reject=4 (delta +0)
- metric://task_outcome_signals.category=a2.subtype.magic_word_ref=1 (Week 2 capture)
- metric://task_outcome_signals.category=a2.subtype.permission_cancel=0 (still untested)
- metric://a2_subtypes_proven_organically=2 (out of 3 - permission_cancel still the lone holdout)
- metric://genuine_harness_or_governance_defects_cumulative=1 (first one in 14 days - sync-reverted owner intent)
- metric://eval_cat_self_corrections_cumulative=4 (Week 2 analysis + Week 3 analysis both clean - 0 new self-corrections, falsifier test favorable so far)
- metric://distinct_host_threads=10 (delta +6 - 22-06 sync triggered captures across eval_memory, mqa2ss8lgpgpy6rf, mqf8tb5jvk1mjgdp, mqhihafozvagzj8a, mqkbmzrkpafd8xem, mqm2uy6elng7g2lx, mqp4ykbxml3okbo8)

Counterarguments:
- C-1: This packet may be the FIRST place to discover the sync-revert and the conclusion is jumping to architectural change. A lighter response would be: owner just re-applies weekly locally (or via upstream commit), no architectural change. The fact that it happened ONCE is N=1; we don't know if it's a recurring pattern yet. Path (a) is the cheapest fix; (b) and (c) require thinking that the data hasn't justified.
- C-2: I claimed 'first genuine harness/governance defect in 14 days' but this may be cherry-picking. There could be many silent sync-reverts of other local changes I'm not tracking. The honest framing: 'first in 14 days OF THIS DOMAIN'. The broader governance question deserves a separate audit, not a single ownerAsk in this packet.
- C-3: The 11-capture burst on 2026-06-22T10:57:24-37 (13-second window) is itself worth flagging - either sync rolled up many real merges in a short period (operationally fine) or there's a backfill mechanism replaying old merge events as new (subtle harness bug). Need to look at the upstream PR numbers (#43, #52, #103, etc.) to see if they're chronologically clustered or scattered. Skipped this drill due to lower priority than sync-revert finding.
- C-4: Eval cat self-correction count stays at 4 (Week 1 baseline) because Week 2 didn't publish (so no published wrong premise) and Week 3 had no wrong premise. Falsifier test continues to favor 'onboarding-gap heals over weekly cadence' framing, BUT N=2 weekly cycles is still small. Need 3-4 more clean weeks for confidence.
- C-5: Calling this a 'fix' verdict on a non-harness-code defect stretches the verdict categories. The schema's fix/build/keep_observe/delete_sunset were designed for the HARNESS-UNDER-EVAL, not for sync-governance issues that surface THROUGH harness data. Strict reading: should be 'keep_observe' + ownerAsk='ack the finding'. Permissive reading: 'fix' because the defect is real and actionable. Picked permissive because Week 2 missed publish + Week 3 sync-revert are correlated enough to deserve owner attention now, not in 2 more weeks.