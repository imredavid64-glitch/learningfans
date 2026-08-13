// Pure helpers for accountability groups — framework-free for unit testing.
// All date math is UTC, matching the app's existing check-in convention
// (`new Date().toISOString().slice(0,10)` and `(now() at time zone 'utc')::date`).

export const ACCOUNTABILITY_MAX_MEMBERS = 8;
export const ACCOUNTABILITY_MAX_NAME = 80;
export const ACCOUNTABILITY_MAX_GOAL = 200;
export const ACCOUNTABILITY_NUDGE_COOLDOWN_HOURS = 24;

export interface GroupCheckin {
  user_id: string;
  checkin_date: string; // YYYY-MM-DD (UTC)
}

/** UTC date key (YYYY-MM-DD) for a Date. */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the week containing the given date. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Members who have checked in on or after `start` (a week-start date). */
export function checkedInSince(
  memberIds: string[],
  checkins: GroupCheckin[],
  start: Date,
): Set<string> {
  const key = utcDateKey(start);
  const memberSet = new Set(memberIds);
  const out = new Set<string>();
  for (const c of checkins) {
    if (memberSet.has(c.user_id) && c.checkin_date >= key) out.add(c.user_id);
  }
  return out;
}

/**
 * Consecutive days (ending today) on which every member checked in. Today is
 * allowed to be incomplete — the streak then starts counting from yesterday.
 */
export function groupStreak(
  memberIds: string[],
  checkins: GroupCheckin[],
  now: Date,
): number {
  if (memberIds.length === 0) return 0;
  const memberSet = new Set(memberIds);
  const byDate = new Map<string, Set<string>>();
  for (const c of checkins) {
    if (!memberSet.has(c.user_id)) continue;
    const set = byDate.get(c.checkin_date) ?? new Set<string>();
    set.add(c.user_id);
    byDate.set(c.checkin_date, set);
  }

  const allCheckedOn = (d: Date): boolean => {
    const set = byDate.get(utcDateKey(d));
    return set ? set.size >= memberSet.size : false;
  };

  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  if (!allCheckedOn(cursor)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (allCheckedOn(cursor)) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Progress fraction (0–1) of members checked in this week. */
export function weeklyProgress(
  memberIds: string[],
  checkins: GroupCheckin[],
  now: Date,
): number {
  if (memberIds.length === 0) return 0;
  const checked = checkedInSince(memberIds, checkins, weekStart(now));
  return checked.size / memberIds.length;
}
