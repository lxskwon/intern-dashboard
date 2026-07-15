export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Short form like "6월 1일" (no year) for compact chips. */
export function fmtShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/** For <input type="date"> default values. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Date-only fields are stored at UTC midnight (from <input type="date">).
// Comparing them by an integer YYYYMMDD "day key" derived from UTC components
// avoids timezone off-by-one bugs entirely.

/** YYYYMMDD key from a stored date, using its UTC calendar day. */
export function dateKeyUTC(d: Date | string): number {
  const x = new Date(d);
  if (isNaN(x.getTime())) return 0;
  return x.getUTCFullYear() * 10000 + (x.getUTCMonth() + 1) * 100 + x.getUTCDate();
}

/** UTC calendar day parts of a stored date. */
export function ymdUTC(d: Date | string): { year: number; month0: number; day: number } {
  const x = new Date(d);
  return { year: x.getUTCFullYear(), month0: x.getUTCMonth(), day: x.getUTCDate() };
}

/** YYYYMMDD key for a given instant, in Korea time. */
export function seoulDateKey(d: Date | string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(d));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return v("year") * 10000 + v("month") * 100 + v("day");
}

/** Today's YYYYMMDD key in Korea time (independent of server timezone). */
export function todayKey(): number {
  return seoulDateKey(new Date());
}

/** Build a YYYYMMDD key from plain calendar parts (month0 is 0-based). */
export function dayKey(year: number, month0: number, day: number): number {
  return year * 10000 + (month0 + 1) * 100 + day;
}

/** True once an internship's end date has passed (인턴 기간 종료). */
export function isEnded(endDate: Date | null | undefined): boolean {
  if (!endDate) return false;
  const k = dateKeyUTC(endDate);
  return k !== 0 && k < todayKey();
}

/** True if the internship hasn't started yet. */
export function isNotStarted(startDate: Date | null | undefined): boolean {
  if (!startDate) return false;
  const k = dateKeyUTC(startDate);
  return k !== 0 && k > todayKey();
}

type Period = { startDate: Date; endDate: Date };

/** True if today falls within any of the given out-of-office periods. */
export function isCurrentlyAway(periods: Period[]): boolean {
  const t = todayKey();
  return periods.some((p) => dateKeyUTC(p.startDate) <= t && t <= dateKeyUTC(p.endDate));
}

/** A task with no journal entry for this many days is flagged as "stale". */
export const STALE_DAYS = 7;

/**
 * Countdown to a task's due date, in Korea calendar days.
 * D-3 (upcoming) / D-DAY (today) / D+2 (overdue). Null if no due date.
 */
export function ddayInfo(
  due: Date | string | null | undefined
): { label: string; days: number; overdue: boolean; soon: boolean } | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const dueMid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const tk = todayKey();
  const todMid = Date.UTC(Math.floor(tk / 10000), (Math.floor(tk / 100) % 100) - 1, tk % 100);
  const days = Math.round((dueMid - todMid) / 86_400_000);
  const label = days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : `D+${-days}`;
  return { label, days, overdue: days < 0, soon: days >= 0 && days <= 2 };
}
