---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-06-14-task-outcome-weekly-1-proposal-reject-drill-plus-self-correction-4
source_snapshot: "snapshot:bundle/2026-06-14-task-outcome-weekly-1-proposal-reject-drill-plus-self-correction-4/snapshot"
---

# Live Verdict — 2026-06-14-task-outcome-weekly-1-proposal-reject-drill-plus-self-correction-4

- Verdict: `keep_observe`
- Phenomenon: First weekly eval after Day 5 cadence change. Two findings. (1) Pre-analysis self-correction: I initially assumed today's 03:00 UTC trigger was 'scheduler config drift' (YAML weekly but cron fired daily). Verifying via daemon log + date-of-week math revealed today (2026-06-14) IS Sunday — cron `0 3 * * 0` = weekly task fired correctly per schedule. eval-domain-daily log shows task-outcome dropped to 2 items starting 2026-06-13, eval-domain-weekly fired 3 items today. Harness behaving exactly as owner's commit `12d5916c` intended. This is the 4th self-correction in 7 days (Day 1 IMAP / Day 2 LL path / Day 5 routing bug / Day 7 day-of-week) — but the FIRST one caught pre-publish (Days 1-5 all caught only on subsequent eval). (2) proposal_reject drill per Day 5 weekly commitment: 4 signals from cat=fable5 thread=thread_mq839xpl6qzhtfil over ~10h on 2026-06-11. Backoff infrastructure exists at propose-time (sessionHandoffPropose.ts: ≤1 pending + 5min cooldown + 5/hour cap). The 4 rejections (gaps: 8.5h, 1h, 45min) all pass thresholds — they ARE legitimate separate proposals by current design. Pattern question: same-cat-same-thread N=4 rejections in 10h is below the 5/hour cap but reads as a UX failure (user repeatedly says no, cat keeps asking). Threshold is mechanically correct, semantically too lenient.
- Harness: F192/task-outcome-eval-pipeline (Task Outcome Eval Harness (F192 Phase G/H) - First weekly eval)
- Owner ask: Three items, prioritized: (1) PROPOSAL_REJECT pattern is a content signal worth surfacing to F225 (session_handoff feature) - consider adding a 'recently-rejected-recently' backoff layer: if N rejections in last M hours for (cat, thread), pause proposing for M*2 hours, separate from current cooldown/hourly cap. Current thresholds are mechanically correct but semantically lenient. (2) Day 5 commitments status: F192 Phase G doc update STILL pending (owner said 'next dev window'), LL-071 commit STILL pending (owner said 'will integrate C-5 draft'). Not urgent given weekly cadence, just tracking. (3) Eval cat self-correction tracking: 4/7 days, but 1/1 this round was pre-publish. Onboarding-gap framing (owner's Day 5 ACK) gets empirical test next weekly: if 2026-06-21 weekly eval has ZERO self-corrections, framing validated; if any, framing needs revisit. No action required from owner; metric being tracked in dailyTrend.eval_cat_self_corrections_cumulative.
- Re-eval: next eval at 2026-06-21T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-14-task-outcome-weekly-1-proposal-reject-drill-plus-self-correction-4/snapshot
- attribution:bundle/2026-06-14-task-outcome-weekly-1-proposal-reject-drill-plus-self-correction-4/TO-2026-06-14-open-window
- metric://eval_cat_self_corrections_total=4 (4/7 days, 57% rate - one this round caught pre-publish, qualitative improvement over Days 1-5 caught on next eval)
- metric://harness_genuine_defects_total=0 (7-day total)
- metric://task_outcome_episodes.count=6 (delta 0)
- metric://task_outcome_signals.category=a1.subtype.merge=5 (delta 0)
- metric://task_outcome_signals.category=a2.subtype.proposal_reject=4 (delta 0 vs Day 5)
- metric://task_outcome_signals.category=a2.subtype.permission_cancel=0
- metric://task_outcome_signals.category=a2.subtype.magic_word=0
- metric://a2_subtypes_proven_organically=1 (out of 3)
- metric://owner_engagement_status=engaged (Day 5 ACK + cadence change landed)
- metric://propose_session_handoff.fable5_reject_rate=4_per_10h (~0.4/h - below 5/h cap but above 'good UX' intuition)
- metric://propose_session_handoff.backoff_layers_existing=3 (pending/cooldown/hourly)

Counterarguments:
- C-1: Calling today's pre-publish self-correction a 'qualitative improvement' is N=1 - one round of pre-publish catch doesn't establish a trend. The honest read is 'we caught one this round but the rate is unchanged'. True trend evidence needs ≥3 consecutive weekly evals with 0 self-corrections.
- C-2: The proposal_reject drill conclusion ('threshold mechanically correct, semantically lenient') is a judgment call I'm making from outside the design intent. The 5/hour cap was set by F225 design - if it was deliberately permissive to let cats self-correct, my suggestion to tighten contradicts that design. F225 owner should weigh in before any code change.
- C-3: The weekly cadence has fewer data points per packet (this packet's window covers same 6 episodes as Day 5 packet, just with longer evidence-collection time). Risk: weekly packets become 'still nothing new, status quo' for 4+ rounds in a row, at which point should we shift to monthly? Worth flagging if Week 2/3/4 also show 0-delta vs Week 1.
- C-4: Treating 'no harness defects in 7 days' as harness validation is anti-Karl-Popper - the harness is ONLY observed on the signals that arrive. If permission_cancel and magic_word paths are broken AND no permission_cancel/magic_word events occurred, the harness would look healthy regardless. The integration test that owner deferred IS actually the proper falsifier - we're choosing convenience (organic-only) over rigor (synthetic injection).