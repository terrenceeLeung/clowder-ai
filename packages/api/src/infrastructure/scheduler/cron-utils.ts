import { CronExpressionParser } from 'cron-parser';

/**
 * Calculate milliseconds until the next occurrence of a cron expression.
 * @param expression - Standard 5-field cron expression (e.g. "0 9 * * *")
 * @param timezone - Optional IANA timezone (default: system local)
 * @returns Positive integer ms until next fire
 * @throws If the expression is invalid
 */
export function getNextCronMs(expression: string, timezone?: string): number {
  const options: Record<string, unknown> = { currentDate: new Date() };
  if (timezone) options.tz = timezone;
  const parsed = CronExpressionParser.parse(expression, options);
  const next = parsed.next().toDate();
  return Math.max(1, next.getTime() - Date.now());
}

/**
 * Compute the absolute epoch-ms timestamp of the next cron occurrence that is
 * strictly later than `lastFiredSlotMs` (when provided).
 *
 * Why this exists — cron boundary race:
 *   TaskRunnerV2 schedules cron ticks via a setTimeout chain whose `.finally`
 *   block reschedules the next tick. When `setTimeout` fires slightly **before**
 *   its target cron time (timer drift / fast `executePipeline`), the
 *   `.finally` callback may run while `Date.now()` is still earlier than the
 *   intended cron slot. A plain `parsed.next()` call then returns the **same**
 *   slot a second time — causing a duplicate fire within the same cron window.
 *
 *   By passing the last-fired slot here, we advance past it deterministically
 *   so the next scheduled fire always lands on a future, never-fired slot.
 *
 * @param expression - Standard 5-field cron expression
 * @param timezone - Optional IANA timezone (passed to cron-parser as `tz`)
 * @param now - Current epoch ms (injected for testability)
 * @param lastFiredSlotMs - Epoch ms of the most recent already-fired slot; if
 *   provided, the returned value is guaranteed `> lastFiredSlotMs`.
 * @returns Epoch ms of the next valid cron slot strictly after `lastFiredSlotMs`
 * @throws If the expression is invalid
 */
export function computeNextCronSlot(
  expression: string,
  timezone: string | undefined,
  now: number,
  lastFiredSlotMs: number | undefined,
): number {
  const options: Record<string, unknown> = { currentDate: new Date(now) };
  if (timezone) options.tz = timezone;
  const parsed = CronExpressionParser.parse(expression, options);
  let nextMs = parsed.next().toDate().getTime();
  // Boundary-race guard: advance past any slot already fired.
  while (lastFiredSlotMs !== undefined && nextMs <= lastFiredSlotMs) {
    nextMs = parsed.next().toDate().getTime();
  }
  return nextMs;
}
