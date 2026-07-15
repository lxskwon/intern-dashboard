// Shared values across the app. There are no user roles — everyone is an intern.

// ---------- working-hours status ----------
// 근무중 (green) while the current time falls within one of the intern's work
// schedules for today; 퇴근 (grey) otherwise. UNSET when no schedules exist.

export type WorkStatusKey = "WORKING" | "OFF" | "UNSET";

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
  UNSET: { key: "UNSET", label: "근무시간 미설정", dot: "◽", color: "#94a3b8", bg: "#f1f5f9" },
};

export type Schedule = { days: string; startTime: string; endTime: string };

function toMinutes(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

const SEOUL_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

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
export function computeWorkStatus(schedules: Schedule[] | null | undefined): WorkStatusKey {
  if (!schedules || schedules.length === 0) return "UNSET";
  const { day, minutes: cur } = nowInSeoul();

  const todays = schedules.filter((s) =>
    s.days
      .split(",")
      .map((d) => Number(d.trim()))
      .includes(day)
  );
  if (todays.length === 0) return "OFF";

  for (const s of todays) {
    const start = toMinutes(s.startTime);
    const end = toMinutes(s.endTime);
    if (start !== null && end !== null && cur >= start && cur <= end) return "WORKING";
  }
  return "OFF";
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// Selectable teams (본부).
export const TEAMS = ["벤처 1본부", "벤처 2본부", "바이오", "Batch"];

/** Human label for a schedule's weekday set, e.g. "월", "화·수·목·금". */
export function formatDays(days: string): string {
  return days
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .map((n) => WEEKDAYS[n])
    .join("·");
}
