// Shared values across the app. There are no user roles — everyone is an intern.

import { dateKeyUTC, todayKey } from "./format";

// ---------- working-hours status ----------
// 근무중 (green) while the current time falls within one of the intern's work
// schedules for today; 퇴근 (grey) otherwise. UNSET when no schedules exist.

export type WorkStatusKey = "WORKING" | "OFF" | "AWAY" | "UNSET";

export type WorkStatusMeta = {
  key: WorkStatusKey;
  label: string;
  dot: string;
  color: string;
  bg: string;
};

export const WORK_STATUS: Record<WorkStatusKey, WorkStatusMeta> = {
  WORKING: { key: "WORKING", label: "근무중", dot: "🟢", color: "#15803d", bg: "#dcfce7" },
  OFF: { key: "OFF", label: "퇴근", dot: "⚫", color: "#475569", bg: "#e2e8f0" },
  AWAY: { key: "AWAY", label: "부재중", dot: "🟣", color: "#4338ca", bg: "#e0e7ff" },
  UNSET: { key: "UNSET", label: "근무시간 미설정", dot: "◽", color: "#94a3b8", bg: "#f1f5f9" },
};

export type Schedule = { days: string; startTime: string; endTime: string };

// If someone forgets to press 퇴근, they stay 근무중 until this many minutes past
// their scheduled end time, then auto-퇴근 (so no one is left 근무중 all night).
export const AUTO_OFF_GRACE_MIN = 30;

function toMinutes(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

const SEOUL_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Latest scheduled end-of-day (minutes since midnight) for a given weekday,
 *  or null when there's no schedule that day. */
export function scheduleEndForWeekday(
  schedules: Schedule[] | null | undefined,
  weekday: number
): number | null {
  if (!schedules) return null;
  const ends = schedules
    .filter((s) => s.days.split(",").map((d) => Number(d.trim())).includes(weekday))
    .map((s) => toMinutes(s.endTime))
    .filter((m): m is number => m !== null);
  return ends.length ? Math.max(...ends) : null;
}

/** Current weekday + minutes-of-day in Korea time (independent of server TZ). */
function nowInSeoul(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const val = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = SEOUL_WEEKDAY[val("weekday")] ?? 0;
  let hour = parseInt(val("hour"), 10);
  if (hour === 24) hour = 0; // some environments emit "24" at midnight
  const minutes = hour * 60 + parseInt(val("minute"), 10);
  return { day, minutes };
}

/** Compute 근무중 / 퇴근 from a list of work schedules against the current time. */
// Effective work-time bounds for TODAY from any approved 출·퇴근 조정:
// lateFrom pushes the start later (늦은 출근), earlyUntil pulls the end earlier
// (이른 퇴근). Both are minutes-since-midnight, or null when not adjusted.
export type WorkBounds = { lateFrom: number | null; earlyUntil: number | null };

type AdjustRow = {
  kind?: string | null;
  adjustType?: string | null;
  adjustTime?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
};

/** Derive today's WorkBounds from a person's unavailabilities (only APPROVED
 *  ADJUST rows dated today count). */
export function todayAdjustBounds(rows: AdjustRow[] | null | undefined): WorkBounds {
  let lateFrom: number | null = null;
  let earlyUntil: number | null = null;
  if (rows) {
    const tk = todayKey();
    for (const r of rows) {
      if (r.kind !== "ADJUST" || r.status !== "APPROVED" || !r.startDate) continue;
      if (dateKeyUTC(r.startDate) !== tk) continue;
      const m = r.adjustTime ? toMinutes(r.adjustTime) : null;
      if (m === null) continue;
      if (r.adjustType === "LATE") lateFrom = lateFrom === null ? m : Math.max(lateFrom, m);
      else if (r.adjustType === "EARLY") earlyUntil = earlyUntil === null ? m : Math.min(earlyUntil, m);
    }
  }
  return { lateFrom, earlyUntil };
}

/** Today's manual check-in/out for a person (null when they haven't touched the
 *  button today). `inAt` set + `outAt` null = currently checked in. */
export type CheckState = { inAt: Date | string | null; outAt: Date | string | null } | null | undefined;

/**
 * Status is BUTTON-DRIVEN, not clock-driven:
 *  - 출근 pressed (inAt set) and not yet 퇴근 → 근무중 (WORKING), whatever the clock says.
 *  - 퇴근 pressed (outAt set), or never checked in → 퇴근 (OFF).
 * The work schedule + 출·퇴근 조정 (bounds) only add overlays:
 *  - 이른 퇴근: once past the registered leave time, 퇴근 regardless of the button.
 *  - 늦은 출근: during [normal start → registered arrival] the (not-checked-in)
 *    intern shows 부재중 (AWAY); before normal hours they're simply 퇴근.
 * UNSET (근무시간 미설정) only shows for someone with no schedule who hasn't
 * checked in — a gentle nudge to register hours.
 */
export function computeWorkStatus(
  schedules: Schedule[] | null | undefined,
  bounds?: WorkBounds,
  check?: CheckState
): WorkStatusKey {
  const { day, minutes: cur } = nowInSeoul();

  // 이른 퇴근: an approved early-leave means they're off once its time passes.
  if (bounds?.earlyUntil != null && cur >= bounds.earlyUntil) return "OFF";

  // Button decides 근무중 / 퇴근 — but a forgotten 퇴근 auto-closes AUTO_OFF_GRACE_MIN
  // after today's scheduled end, so no one is left 근무중 all night.
  if (check?.inAt && !check?.outAt) {
    const end = scheduleEndForWeekday(schedules, day);
    if (end !== null && cur >= end + AUTO_OFF_GRACE_MIN) return "OFF";
    return "WORKING";
  }
  if (check?.outAt) return "OFF";

  // Not checked in today.
  if (!schedules || schedules.length === 0) return "UNSET";
  const todays = schedules.filter((s) =>
    s.days
      .split(",")
      .map((d) => Number(d.trim()))
      .includes(day)
  );
  if (todays.length === 0) return "OFF";

  // 늦은 출근 부재중 window: between the normal start and the registered arrival.
  if (bounds?.lateFrom != null) {
    const starts = todays
      .map((s) => toMinutes(s.startTime))
      .filter((m): m is number => m !== null);
    const normalStart = starts.length ? Math.min(...starts) : null;
    if (normalStart !== null && cur >= normalStart && cur < bounds.lateFrom) return "AWAY";
  }

  return "OFF";
}

export type CheckoutKind = "OPEN" | "MANUAL" | "AUTO" | "AUTO_NOJOURNAL";

/** Is the given day past its auto-퇴근 moment (scheduled end + grace)? Past days
 *  are always closed; a day with no schedule never auto-closes on its own, so
 *  today-with-no-schedule counts as still open. */
function isDayAutoClosed(date: Date | string, schedules: Schedule[] | null | undefined): boolean {
  const dk = dateKeyUTC(date);
  const tk = todayKey();
  if (dk < tk) return true;
  if (dk > tk) return false;
  const { day, minutes: cur } = nowInSeoul();
  const end = scheduleEndForWeekday(schedules, day);
  if (end === null) return false;
  return cur >= end + AUTO_OFF_GRACE_MIN;
}

/**
 * Classify how a day's check-in ended — used by 출퇴근 관리 and the intern nudge:
 *  - MANUAL: pressed 퇴근 (which requires a 기록) → 정상 퇴근 (green).
 *  - OPEN: checked in, still within today's window (근무중), not yet auto-closed.
 *  - AUTO: forgot to press 퇴근, but a 기록 exists → auto-퇴근 (yellow), minor.
 *  - AUTO_NOJOURNAL: forgot 퇴근 AND wrote no 기록 that day → flagged (red).
 */
export function classifyCheckout(
  check: { inAt: Date | string | null; outAt: Date | string | null; date: Date | string },
  schedules: Schedule[] | null | undefined,
  hasJournal: boolean
): CheckoutKind {
  if (!check.inAt) return "OPEN";
  if (check.outAt) return "MANUAL";
  if (!isDayAutoClosed(check.date, schedules)) return "OPEN";
  return hasJournal ? "AUTO" : "AUTO_NOJOURNAL";
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// Selectable teams (본부).
export const TEAMS = [
  "벤처 1본부",
  "벤처 2본부",
  "바이오",
  "경영지원",
  "커뮤니케이션",
  "액셀러레이터 본부: 이노베이션",
  "액셀러레이터 본부: Batch",
];

/**
 * Human label for a schedule's weekday set, e.g. "월", "화·수·목·금".
 * Pass a translator to render weekday names in the current locale.
 */
export function formatDays(days: string, t?: (ko: string) => string): string {
  return days
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .map((n) => (t ? t(WEEKDAYS[n]) : WEEKDAYS[n]))
    .join("·");
}
