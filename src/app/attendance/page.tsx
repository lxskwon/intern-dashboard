import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isAdminOrBoss } from "@/lib/permissions";
import { getT, getLocale } from "@/lib/i18n-server";
import { isEnded, fmtShort, dateKeyUTC, todayKey } from "@/lib/format";
import { WEEKDAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function toMin(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

/** Korean AM/PM clock time of an instant, in Seoul (e.g. "오전 9:57"). */
function seoulClock(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Minutes-since-midnight of an instant, in Seoul. */
function seoulMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return v("hour") * 60 + v("minute");
}

/** Admin-only 출퇴근 관리 — per-intern check-in/out history + 출석률, 지각 in red. */
export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminOrBoss(user)) redirect("/");
  const t = await getT();
  const locale = await getLocale();

  const rows = await prisma.user.findMany({
    where: { kind: "INTERN", withdrawnAt: null },
    select: {
      id: true,
      name: true,
      teams: true,
      startDate: true,
      endDate: true,
      workSchedules: { select: { days: true, startTime: true } },
      checkIns: { orderBy: { date: "desc" }, select: { date: true, inAt: true, outAt: true } },
      // Approved 늦은 출근 adjustments push that day's on-time threshold later.
      unavailabilities: {
        where: { kind: "ADJUST", adjustType: "LATE", status: "APPROVED" },
        select: { startDate: true, adjustTime: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const interns = rows.filter((i) => !isEnded(i.endDate));

  const tk = todayKey();

  const computed = interns.map((i) => {
    // Scheduled weekdays + the earliest scheduled start per weekday (for 지각).
    const schedDays = new Set<number>();
    const startByWd = new Map<number, number>();
    for (const s of i.workSchedules) {
      const st = toMin(s.startTime);
      for (const d of s.days.split(",").map((x) => Number(x.trim()))) {
        schedDays.add(d);
        if (st !== null && (!startByWd.has(d) || st < startByWd.get(d)!)) startByWd.set(d, st);
      }
    }

    // Registered late-arrival time per day (approved 늦은 출근) — overrides the
    // normal scheduled start when judging 지각.
    const lateByDate = new Map<number, number>();
    for (const u of i.unavailabilities) {
      const m = u.adjustTime ? toMin(u.adjustTime) : null;
      if (m !== null) lateByDate.set(dateKeyUTC(u.startDate), m);
    }

    const dayRows = i.checkIns.map((c) => {
      const wd = new Date(c.date).getUTCDay();
      const inMin = c.inAt ? seoulMinutes(c.inAt) : null;
      const dk = dateKeyUTC(c.date);
      // On-time threshold: the approved 늦은 출근 time for that day, else the
      // normal scheduled start.
      const threshold = lateByDate.has(dk) ? lateByDate.get(dk)! : startByWd.get(wd);
      const late = inMin !== null && threshold !== undefined && inMin > threshold;
      return { date: c.date, wd, inAt: c.inAt, outAt: c.outAt, late };
    });

    // 출석률: scheduled days attended ÷ scheduled days expected. Measured only
    // from the intern's FIRST check-in onward (check-in is a new feature — days
    // before it existed can't count as absences), capped at their end date.
    let rate: number | null = null;
    let attended = 0;
    let expected = 0;
    const inDates = i.checkIns.filter((c) => c.inAt).map((c) => dateKeyUTC(c.date));
    if (schedDays.size > 0 && inDates.length > 0) {
      const startK = Math.max(i.startDate ? dateKeyUTC(i.startDate) : 0, Math.min(...inDates));
      const endK = i.endDate ? Math.min(dateKeyUTC(i.endDate), tk) : tk;
      const attendedDates = new Set(inDates);
      const d = new Date(
        Date.UTC(Math.floor(startK / 10000), (Math.floor(startK / 100) % 100) - 1, startK % 100)
      );
      let guard = 0;
      while (dateKeyUTC(d) <= endK && guard++ < 800) {
        if (schedDays.has(d.getUTCDay())) {
          expected++;
          if (attendedDates.has(dateKeyUTC(d))) attended++;
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }
      rate = expected > 0 ? Math.round((attended / expected) * 100) : null;
    }

    return { intern: i, dayRows, rate, attended, expected };
  });

  const totalExpected = computed.reduce((n, c) => n + c.expected, 0);
  const totalAttended = computed.reduce((n, c) => n + c.attended, 0);
  const overallRate = totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : null;

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("출퇴근 관리")}
      </h1>
      <p className="page-sub">{t("인턴별 출근·퇴근 기록과 출석률을 확인할 수 있어요. 지각은 빨간색으로 표시됩니다.")}</p>

      <div className="card card-pad section">
        <div className="stat-row">
          <div className="stat-box">
            <span className="stat-num">{overallRate !== null ? `${overallRate}%` : "—"}</span>
            <span className="stat-label">{t("전체 출석률")}</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{interns.length}</span>
            <span className="stat-label">{t("인턴")}</span>
          </div>
        </div>
      </div>

      {computed.length === 0 ? (
        <div className="card card-pad empty">{t("현재 진행 중인 인턴이 없습니다.")}</div>
      ) : (
        <div className="attend-list">
          {computed.map(({ intern: i, dayRows, rate }) => (
            <details key={i.id} className="card attend-item">
              <summary className="attend-summary">
                <span className="attend-name">
                  <Link href={`/interns/${i.id}`}>{i.name}</Link>
                  {i.teams.length > 0 && <span className="attend-teams">{i.teams.join(" · ")}</span>}
                </span>
                <span className={`attend-rate${rate !== null && rate < 70 ? " low" : ""}`}>
                  {rate !== null ? t("출석률 {n}%", { n: rate }) : t("출석률 —")}
                </span>
              </summary>
              <div className="attend-body">
                {dayRows.length === 0 ? (
                  <div className="empty">{t("출퇴근 기록이 없습니다.")}</div>
                ) : (
                  dayRows.slice(0, 30).map((r) => (
                    <div key={dateKeyUTC(r.date)} className="attend-row">
                      <span className="attend-date">
                        {fmtShort(r.date, locale)} ({WEEKDAYS[r.wd]})
                      </span>
                      <span className="attend-times">
                        {r.inAt ? (
                          <span className={r.late ? "attend-late" : "attend-in"}>
                            {seoulClock(r.inAt)} {t("출근")}
                            {r.late ? ` · ${t("지각")}` : ""}
                          </span>
                        ) : (
                          <span className="muted">{t("출근 기록 없음")}</span>
                        )}
                        {r.outAt && (
                          <span className="attend-out">
                            {seoulClock(r.outAt)} {t("퇴근")}
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
