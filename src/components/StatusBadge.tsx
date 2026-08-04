import {
  computeWorkStatus,
  WORK_STATUS,
  type Schedule,
  type WorkBounds,
  type CheckState,
} from "@/lib/constants";
import { getT } from "@/lib/i18n-server";

/**
 * Status pill. Precedence: 인턴 종료 (ended) → 부재중 (full-day away) →
 * button-driven 근무중 / 퇴근 (with 출·퇴근 조정 overlays), see computeWorkStatus.
 */
export async function StatusBadge({
  ended = false,
  away = false,
  schedules,
  bounds,
  check,
}: {
  ended?: boolean;
  away?: boolean;
  schedules?: Schedule[];
  bounds?: WorkBounds;
  check?: CheckState;
}) {
  const t = await getT();
  if (ended) {
    return (
      <span className="badge" style={{ background: "#e5e7eb", color: "#4b5563" }}>
        ⚫ {t("인턴 종료")}
      </span>
    );
  }
  if (away) {
    return (
      <span className="badge" style={{ background: "#e0e7ff", color: "#4338ca" }}>
        🟣 {t("부재중")}
      </span>
    );
  }
  const meta = WORK_STATUS[computeWorkStatus(schedules, bounds, check)];
  return (
    <span className="badge" style={{ background: meta.bg, color: meta.color }}>
      {meta.dot} {t(meta.label)}
    </span>
  );
}
