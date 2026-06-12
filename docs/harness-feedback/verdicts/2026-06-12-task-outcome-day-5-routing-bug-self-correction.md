---
feature_ids: [F192, F227]
topics: [harness-eval, eval-task-outcome, live-verdict]
doc_kind: harness-feedback
feedback_type: live-verdict
domain_id: eval:task-outcome
packet_id: 2026-06-12-task-outcome-day-5-routing-bug-self-correction
source_snapshot: "snapshot:bundle/2026-06-12-task-outcome-day-5-routing-bug-self-correction/snapshot"
---

# Live Verdict — 2026-06-12-task-outcome-day-5-routing-bug-self-correction

- Verdict: `keep_observe`
- Phenomenon: Day 5 reeval. Two findings dominate this round. (1) THIRD self-correction in 5 days: Day 3 and Day 4 packets ended with `@opus` in mid-line position, which the routing system explicitly rejects (system-injected message in thread: '[路由语法]: @opus 写在行中不会触发路由 — 把 @句柄移到最后一行行首独立一行即可'). So 'F192 owner did not ack' — the framing of Day 4's escalation threat — was CONTAMINATED by my own routing bug: owner had no chance to ack because I never properly pinged them. Day 4's red-line ('if no ack at Day 5 -> shift to fix') withdrawn; the SLA-breach observation was a phantom of my own making. (2) proposal_reject subtype deepened to N=4 (Day 4 baseline was N=1), all bound to the same in_progress episode (ep-1781142751234-svlvma) where fable5 keeps rejecting session_handoff proposals into thread_mq839xpl6qzhtfil. The harness correctly appends all 4 rejections to the same active episode — ensureActiveEpisode logic confirmed working. Other a2 subtypes (permission_cancel, magic_word) still 0.
- Harness: F192/task-outcome-eval-pipeline (Task Outcome Eval Harness (F192 Phase G/H) — Day 5 reeval)
- Owner ask: Three items, this time delivered with PROPERLY ROUTED @ (line-start) at end of summary. (1) Read the LATEST self-correction in this packet's phenomenon: my Day 3+4 @opus didn't route. The 'F192 owner SLA breach' framing was contaminated by my own bug. Day 4's red-line ('Day 5 -> fix if no ack') withdrawn. (2) Content signal: fable5 in thread_mq839xpl6qzhtfil has rejected 4 session_handoff proposals in 10h on 2026-06-11. Worth investigating: is something repeatedly suggesting handoff to a cat that keeps refusing? Could indicate a higher-order bug or a desire mismatch worth understanding. (3) Day 3 + Day 4 follow-ups still standing: F192 Phase G doc clarify a1=gh-CLI mechanism; integration test (now lower urgency given organic proposal_reject N=4 capture); LL-071 commit (draft in Day 3 packet C-5). All 3 are batch-able for one PR. NO escalation requested; this is keep_observe.
- Re-eval: next eval at 2026-06-13T03:00:00.000Z

Evidence:
- snapshot:bundle/2026-06-12-task-outcome-day-5-routing-bug-self-correction/snapshot
- attribution:bundle/2026-06-12-task-outcome-day-5-routing-bug-self-correction/eval-F192-2026-06-12:no-finding
- metric://task_outcome_episodes.count=6 (Δ +0 vs Day 4)
- metric://task_outcome_signals.category=a1.subtype.merge=5 (Δ +0)
- metric://task_outcome_signals.category=a2.subtype.proposal_reject=4 (Δ +3; deeper sampling of same subtype, no expansion)
- metric://task_outcome_signals.category=a2.subtype.permission_cancel=0
- metric://task_outcome_signals.category=a2.subtype.magic_word=0
- metric://a2_subtypes_proven=1 (out of 3 designed)
- metric://distinct_host_threads=4 (Δ +0)
- metric://eval_cat_self_corrections_to_date=3 (Day 1 IMAP / Day 2 LL path / Day 5 routing bug)
- metric://owner_ack_count=0 (but contaminated by routing bug, NOT a clean signal)
- metric://closure_d3_path1.met=0/3 (F192 doc / test / LL-071 — still none)
- metric://closure_d4_path1.met=0/2 (ack + cadence decision — routing-blocked, NOT delivered)

Counterarguments:
- C-1: Treating my routing bug as 'invalidating' Day 4's SLA-breach claim is one reading; the more honest reading is that BOTH things were true — the routing bug occurred AND owner did not engage. Even if I had routed correctly, there's no guarantee owner would have acted. The bug just removes my standing to call out their inaction.
- C-2: Calling 'a2 subtypes proven = 1/3' insufficient is a framing choice. The harness design did not require all 3 subtypes to fire in N days; only that each wire is tested. proposal_reject N=4 from one cat in one thread proves the wire; permission_cancel and magic_word may simply have not had triggering events. The honest direction interpretation is: harness wire-correctness proven for what triggered; expansion to other subtypes is a coverage question, not a correctness question.
- C-3: This Day 5 packet itself may introduce a NEW class of error — over-correcting by withdrawing escalation. If I always self-correct in the direction of softening verdicts when fault is found in my own work, the eval loop will trend toward never escalating. A balanced approach: separate 'evidence for harness state' (still keep_observe) from 'evidence for eval-cat process state' (now needs explicit improvement plan).
- C-4: The 3 follow-ups from Day 3 (F192 doc / test / LL-071) have NOT been touched in 7 days now. At what point does 'owner has not engaged' become a structural finding regardless of routing-bug confound? The pure-counterfactual answer: even if every @opus had routed perfectly, the LL-071 draft was in counterarguments[] (deep in the JSON), and owner would have to read 400+ lines to find it. The format of the ownerAsk itself may be inaccessible. Worth restructuring to surface the actionable items at the top of the .md verdict file.
- C-5: The proposal_reject pattern (fable5 rejecting 4 session_handoff in 10h, all in same thread) is a real signal that I should NOT defer to F192 owner without first looking at it myself. Why is something proposing handoff to fable5 4 times when fable5 keeps refusing? A future eval cat round should drill into this: who is proposing? Is the proposal system not learning from rejections? This is exactly the kind of pattern detection the task-outcome harness is designed to enable, and I should consume my own signal.