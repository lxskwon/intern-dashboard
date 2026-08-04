import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { fmtDate } from "@/lib/format";
import { formatDays } from "@/lib/constants";
import {
  approveUnavailabilityAction,
  approveWorkPeriodAction,
  approveWorkScheduleAction,
} from "@/lib/actions";
import { allPendingApprovals } from "@/lib/notifications";
import { isAdminOrBoss } from "@/lib/permissions";
import { getT, getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/**
 * Company-wide requests inbox for admins. Unlike the per-mentor list on /me
 * (which is scoped to one admin's mentees), this shows EVERY intern's pending
 * requests — so requests from interns with no assigned mentor, and admins like
 * 대표님 with no mentees, are covered.
 */
export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminOrBoss(user)) redirect("/");
  const t = await getT();
  const locale = await getLocale();

  const { absences, periods, schedules } = await allPendingApprovals();
  const workCount = periods.length + schedules.length;

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("전체 요청")}
      </h1>
      <p className="page-sub">
        {t(
          "모든 인턴의 부재 일정과 근무 확인 요청을 한곳에서 처리합니다. 담당 멘토가 없는 인턴의 요청도 여기에 표시됩니다."
        )}
      </p>

      {/* Time-off approvals (승인 = permission) */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("부재 일정 승인 ({n})", { n: absences.length })}</h2>
        {absences.length === 0 ? (
          <div className="empty">{t("대기 중인 요청이 없습니다.")}</div>
        ) : (
          <div className="approval-list">
            {absences.map((u) => (
              <div key={u.id} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${u.user.id}`} className="mentee-name">
                    {u.user.name}
                  </Link>
                  <span className="meta-line">
                    {u.kind === "ADJUST"
                      ? `⏰ ${t("출·퇴근 조정")}: ${fmtDate(u.startDate, locale)} · ${u.adjustTime ?? ""} ${
                          u.adjustType === "EARLY" ? t("퇴근") : t("출근")
                        }`
                      : `🟣 ${fmtDate(u.startDate, locale)} – ${fmtDate(u.endDate, locale)}`}
                    {u.reason ? ` · ${u.reason}` : ""}
                  </span>
                </div>
                <form action={approveUnavailabilityAction}>
                  <input type="hidden" name="unavailabilityId" value={u.id} />
                  <button type="submit" className="btn btn-sm btn-primary">{t("승인")}</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Work period & hours confirmations (확정 = higher-ups informed) */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("근무 기간·시간 확인 ({n})", { n: workCount })}</h2>
        {workCount === 0 ? (
          <div className="empty">{t("대기 중인 요청이 없습니다.")}</div>
        ) : (
          <div className="approval-list">
            {periods.map((m) => (
              <div key={`p-${m.id}`} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${m.id}`} className="mentee-name">
                    {m.name}
                  </Link>
                  <span className="meta-line">
                    🟡 {t("근무 기간")}: {fmtDate(m.startDate, locale)} – {fmtDate(m.endDate, locale)}
                  </span>
                </div>
                <form action={approveWorkPeriodAction}>
                  <input type="hidden" name="userId" value={m.id} />
                  <button type="submit" className="btn btn-sm btn-primary">{t("확정")}</button>
                </form>
              </div>
            ))}
            {schedules.map((s) => (
              <div key={`s-${s.id}`} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${s.user.id}`} className="mentee-name">
                    {s.user.name}
                  </Link>
                  <span className="meta-line">
                    🟡 {t("근무 시간")}: {formatDays(s.days, t)} {s.startTime}–{s.endTime}
                  </span>
                </div>
                <form action={approveWorkScheduleAction}>
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <button type="submit" className="btn btn-sm btn-primary">{t("확정")}</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
