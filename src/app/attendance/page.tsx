import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isAdminOrBoss } from "@/lib/permissions";
import { getT, getLocale } from "@/lib/i18n-server";
import { isEnded, fmtShort, dateKeyUTC, todayKey } from "@/lib/format";
import { WEEKDAYS, classifyCheckout, journalInfoByDay, AUTO_OFF_GRACE_MIN } from "@/lib/constants";
import { BackfillChip } from "@/components/BackfillChip";

/** Build a Date from a Seoul YYYYMMDD key (for formatting the 보강 date). */
function dateFromKey(k: number): Date {
  return new Date(Date.UTC(Math.floor(k / 10000), (Math.floor(k / 100) % 100) - 1, k % 100));
}

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

  const activeCohort = await prisma.cohort.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  const rows = await prisma.user.findMany({
    where: { kind: "INTERN", withdrawnAt: null },
    select: {
      id: true,
      name: true,
      teams: true,
      startDate: true,
      endDate: true,
      cohortId: true,
      cohort: { select: { label: true, isActive: true, year: true, term: true } },
      workSchedules: { select: { days: true, startTime: true, endTime: true } },
      checkIns: { orderBy: { date: "desc" }, select: { date: true, inAt: true, outAt: true } },
      // 기록 dates + when written — to tell 자동 퇴근 (on-time 기록) from
      // 무기록 자동 퇴근, and to note a late "보강" (backfilled) 기록.
      logEntries: { select: { entryDate: true, createdAt: true } },
      // Approved 늦은 출근 adjustments push that day's on-time threshold later.
      unavailabilities: {
        where: { kind: "ADJUST", adjustType: "LATE", status: "APPROVED" },
        select: { startDate: true, adjustTime: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const tk = todayKey();

  const computed = rows.map((i) => {
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

    const dayInfo = journalInfoByDay(i.logEntries);
    const dayRows = i.checkIns.map((c) => {
      const wd = new Date(c.date).getUTCDay();
      const inMin = c.inAt ? seoulMinutes(c.inAt) : null;
      const dk = dateKeyUTC(c.date);
      // On-time threshold: the approved 늦은 출근 time for that day, else the
      // normal scheduled start.
      const threshold = lateByDate.has(dk) ? lateByDate.get(dk)! : startByWd.get(wd);
      const late = inMin !== null && threshold !== undefined && inMin > threshold;
      const info = dayInfo.get(dk);
      const kind = classifyCheckout(c, i.workSchedules, info?.timely ?? false);
      // 무기록 stays 무기록 even after a late backfill — just annotate the 보강 date.
      const backfillKey = kind === "AUTO_NOJOURNAL" ? info?.backfillKey ?? null : null;
      return { date: c.date, wd, inAt: c.inAt, outAt: c.outAt, late, kind, backfillKey };
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

  // Current 기수 only — a past cohort's interns move to the 전 기수 section below.
  const current = computed.filter(
    (c) => c.intern.cohortId === activeCohort?.id && !isEnded(c.intern.endDate)
  );
  const totalExpected = current.reduce((n, c) => n + c.expected, 0);
  const totalAttended = current.reduce((n, c) => n + c.attended, 0);
  const overallRate = totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : null;

  // Group past (non-active) cohorts' interns for a read-only 출석률 report.
  const TERM_ORDER: Record<string, number> = { 봄: 1, 여름: 2, 가을: 3, 겨울: 4 };
  const pastMap = new Map<string, { label: string; year: number; term: string; list: typeof computed }>();
  for (const c of computed) {
    const co = c.intern.cohort;
    if (!co || co.isActive || !c.intern.cohortId) continue;
    const g = pastMap.get(c.intern.cohortId) ?? { label: co.label, year: co.year, term: co.term, list: [] };
    g.list.push(c);
    pastMap.set(c.intern.cohortId, g);
  }
  const pastGroups = [...pastMap.values()]
    .map((g) => {
      const exp = g.list.reduce((n, c) => n + c.expected, 0);
      const att = g.list.reduce((n, c) => n + c.attended, 0);
      return {
        label: g.label,
        year: g.year,
        term: g.term,
        rate: exp > 0 ? Math.round((att / exp) * 100) : null,
        list: [...g.list].sort((a, b) => a.intern.name.localeCompare(b.intern.name, "ko")),
      };
    })
    .sort((a, b) => b.year - a.year || (TERM_ORDER[b.term] ?? 0) - (TERM_ORDER[a.term] ?? 0));

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("출퇴근 관리")}
      </h1>
      <p className="page-sub">{t("인턴별 출근·퇴근 기록과 출석률을 확인할 수 있어요. 지각은 빨간색으로 표시됩니다.")}</p>

      <div className="card card-pad attend-legend">
        <span className="attend-chip manual">{t("퇴근")}</span>
        <span className="legend-desc">{t("정상 퇴근 — 퇴근 버튼을 눌렀어요 (기록 포함).")}</span>
        <span className="attend-chip auto">{t("자동 퇴근")}</span>
        <span className="legend-desc">
          {t("기록은 있지만 퇴근 버튼을 안 눌러 설정 퇴근 시간 {n}분 후 자동 처리됐어요.", {
            n: AUTO_OFF_GRACE_MIN,
          })}
        </span>
        <span className="attend-chip nojournal">{t("무기록 자동 퇴근")}</span>
        <span className="legend-desc">{t("기록도 없고 퇴근도 안 눌러 자동 처리됐어요. 확인이 필요해요.")}</span>
      </div>

      <div className="card card-pad section">
        <div className="stat-row">
          <div className="stat-box">
            <span className="stat-num">{overallRate !== null ? `${overallRate}%` : "—"}</span>
            <span className="stat-label">{t("전체 출석률")}</span>
          </div>
          <div className="stat-box">
            <span className="stat-num">{current.length}</span>
            <span className="stat-label">{t("인턴")}</span>
          </div>
        </div>
      </div>

      {current.length === 0 ? (
        <div className="card card-pad empty">{t("현재 진행 중인 인턴이 없습니다.")}</div>
      ) : (
        <div className="attend-list">
          {current.map(({ intern: i, dayRows, rate }) => (
            <details key={i.id} className="card attend-item">
              <summary className="attend-summary">
                <span className="attend-name">
                  <Link href={`/interns/${i.id}?back=${encodeURIComponent("/attendance")}`}>{i.name}</Link>
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
                        {r.kind === "MANUAL" && r.outAt && (
                          <span className="attend-chip manual">
                            {seoulClock(r.outAt)} {t("퇴근")}
                          </span>
                        )}
                        {r.kind === "AUTO" && (
                          <span className="attend-chip auto">{t("자동 퇴근")}</span>
                        )}
                        {r.kind === "AUTO_NOJOURNAL" &&
                          (r.backfillKey ? (
                            <BackfillChip
                              label={t("무기록 자동 퇴근")}
                              tip={t("{date} 기록 보강", { date: fmtShort(dateFromKey(r.backfillKey), locale) })}
                              closeLabel={t("닫기")}
                            />
                          ) : (
                            <span className="attend-chip nojournal">{t("무기록 자동 퇴근")}</span>
                          ))}
                        {r.kind === "OPEN" && r.inAt && (
                          <span className="attend-chip open">{t("근무중")}</span>
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

      {pastGroups.length > 0 && (
        <details className="card attend-item" style={{ marginTop: 20 }}>
          <summary className="attend-summary">
            <span className="attend-name">{t("전 기수 출석 기록")}</span>
            <span className="muted" style={{ fontSize: 13 }}>{t("{n}개 기수", { n: pastGroups.length })}</span>
          </summary>
          <div className="attend-body">
            {pastGroups.map((g) => (
              <details key={g.label} className="attend-subitem">
                <summary>
                  <span className="attend-name" style={{ flex: 1 }}>{g.label}</span>
                  <span className={`attend-rate${g.rate !== null && g.rate < 70 ? " low" : ""}`}>
                    {g.rate !== null ? t("출석률 {n}%", { n: g.rate }) : t("출석률 —")}
                  </span>
                </summary>
                <div className="attend-subitem-body">
                  {g.list.map((c) => (
                    <div key={c.intern.id} className="attend-row">
                      <span className="attend-date">{c.intern.name}</span>
                      <span className={`attend-rate${c.rate !== null && c.rate < 70 ? " low" : ""}`}>
                        {c.rate !== null ? t("출석률 {n}%", { n: c.rate }) : t("출석률 —")}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
