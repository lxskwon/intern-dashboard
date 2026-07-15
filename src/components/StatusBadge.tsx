import { computeWorkStatus, WORK_STATUS, type Schedule } from "@/lib/constants";

/**
 * Status pill. Precedence: 인턴 종료 (ended) → 부재중 (away today) →
 * 근무중 / 퇴근 based on the intern's work schedules.
 */
export function StatusBadge({
  ended = false,
  away = false,
  schedules,
}: {
  ended?: boolean;
  away?: boolean;
  schedules?: Schedule[];
}) {
  if (ended) {
    return (
      <span className="badge" style={{ background: "#e5e7eb", color: "#4b5563" }}>
        ⚫ 인턴 종료
      </span>
    );
  }
  if (away) {
    return (
      <span className="badge" style={{ background: "#e0e7ff", color: "#4338ca" }}>
        🟣 부재중
      </span>
    );
  }
  const meta = WORK_STATUS[computeWorkStatus(schedules)];
  return (
    <span className="badge" style={{ background: meta.bg, color: meta.color }}>
      {meta.dot} {meta.label}
    </span>
  );
}
