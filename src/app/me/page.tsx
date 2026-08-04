import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasActiveMentees } from "@/lib/session";
import { roleLabel } from "@/lib/permissions";
import { isEnded, isCurrentlyAway, fmtDate, seoulTodayUTCDate } from "@/lib/format";
import { formatDays, todayAdjustBounds } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MenteeClaimForm } from "@/components/MenteeClaimForm";
import { TeamsPicker } from "@/components/TeamsPicker";
import { HelpTip } from "@/components/HelpTip";
import {
  deleteAccountAction,
  deleteMenteeAction,
  updateStaffTeamsAction,
  approveUnavailabilityAction,
  approveWorkPeriodAction,
  approveWorkScheduleAction,
} from "@/lib/actions";
import { pendingApprovalsFor } from "@/lib/notifications";
import { getT, getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Interns manage everything on their card.
  if (user.kind === "INTERN") redirect(`/interns/${user.id}`);
  const t = await getT();
  const locale = await getLocale();
  const isMentor = await hasActiveMentees(user.id, user.name);
  const pending = await pendingApprovalsFor(user);
  const pendingTotal = pending.absences.length + pending.periods.length + pending.schedules.length;

  // Names this mentor has registered (works even before those interns sign up).
  const claims = await prisma.mentorMentee.findMany({
    where: { mentorId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const claimedNames = claims.map((c) => c.internName);

  // Linked interns = those who typed this mentor's name OR whom this mentor claimed.
  const mentees = await prisma.user.findMany({
    where: {
      kind: "INTERN",
      OR: [
        { mentorNames: { has: user.name } },
        ...(claimedNames.length ? [{ name: { in: claimedNames } }] : []),
      ],
    },
    include: {
      workSchedules: { select: { days: true, startTime: true, endTime: true } },
      unavailabilities: {
        select: { startDate: true, endDate: true, status: true, kind: true, adjustType: true, adjustTime: true },
      },
      checkIns: { where: { date: seoulTodayUTCDate() }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const linkedNames = new Set(mentees.map((m) => m.name));

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("내 계정")}
      </h1>
      <p className="page-sub">{t("관리자 계정 정보")}</p>

      {pendingTotal > 0 && (
        <div className="card card-pad section">
          <h2 className="section-title">{t("확인 대기 ({n})", { n: pendingTotal })}</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 14 }}>
            {t("담당 인턴이 등록한 항목이에요. 확인해 주세요.")}
          </p>
          <div className="approval-list">
            {pending.periods.map((m) => (
              <div key={`p-${m.id}`} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${m.id}?back=${encodeURIComponent("/me")}`} className="mentee-name">
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
            {pending.schedules.map((s) => (
              <div key={`s-${s.id}`} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${s.user.id}?back=${encodeURIComponent("/me")}`} className="mentee-name">
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
            {pending.absences.map((u) => (
              <div key={`a-${u.id}`} className="approval-row">
                <div className="mentee-info">
                  <Link href={`/interns/${u.user.id}?back=${encodeURIComponent("/me")}`} className="mentee-name">
                    {u.user.name}
                  </Link>
                  <span className="meta-line">
                    {u.kind === "ADJUST"
                      ? `🟡 ${t("출·퇴근 조정")}: ${fmtDate(u.startDate, locale)} · ${u.adjustTime ?? ""} ${
                          u.adjustType === "EARLY" ? t("퇴근") : t("출근")
                        }`
                      : `🟡 ${t("부재 일정")}: ${fmtDate(u.startDate, locale)} – ${fmtDate(u.endDate, locale)}`}
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
        </div>
      )}

      <div className="card card-pad section">
        <h2 className="section-title">{t("내 담당 인턴 ({n})", { n: mentees.length })}</h2>
        {mentees.length === 0 ? (
          <div className="empty">
            {t("아직 담당 인턴이 없습니다. 인턴이 멘토 이름에 “{name}”을(를) 입력하면 여기에 자동으로 표시됩니다.", { name: user.name })}
          </div>
        ) : (
          <div className="mentee-list">
            {mentees.map((m) => {
              const ended = isEnded(m.endDate);
              return (
                <Link key={m.id} href={`/interns/${m.id}?back=${encodeURIComponent("/me")}`} className="mentee-row">
                  <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
                  <div className="mentee-info">
                    <span className="mentee-name">{m.name}</span>
                    <span className="meta-line">{m.teams.length ? m.teams.join(" · ") : t("팀 없음")}</span>
                  </div>
                  <StatusBadge
                    ended={ended}
                    away={!ended && isCurrentlyAway(m.unavailabilities.filter((u) => u.kind !== "ADJUST"))}
                    schedules={m.workSchedules}
                    bounds={todayAdjustBounds(m.unavailabilities)}
                    check={m.checkIns[0] ?? null}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Register intern names (works before they sign up) */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("담당 인턴 직접 등록")}</h2>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
          {t("인턴이 아직 가입하지 않았어도 이름을 등록해두면, 가입 시 자동으로 연결됩니다.")}
        </p>
        {claims.length > 0 && (
          <div className="pill-row" style={{ marginBottom: 14 }}>
            {claims.map((c) => (
              <span key={c.id} className="task-pill">
                {c.internName}
                {linkedNames.has(c.internName) ? (
                  <span style={{ color: "#15803d", fontSize: 11, marginLeft: 4 }}>· {t("연결됨")}</span>
                ) : (
                  <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>· {t("대기중")}</span>
                )}
                <form action={deleteMenteeAction} style={{ display: "inline" }}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <button type="submit" className="pill-x" aria-label={t("삭제")}>
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        )}
        <MenteeClaimForm />
      </div>

      <div className="card card-pad section" style={{ maxWidth: 520 }}>
        <h2 className="section-title">
          {t("내 본부")}{" "}
          <HelpTip text={t("소속된 본부예요. 여러 개 선택할 수 있어요.")} />
        </h2>
        <form action={updateStaffTeamsAction}>
          <TeamsPicker initial={user.teams} />
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            {t("저장")}
          </button>
        </form>
      </div>

      <div className="card card-pad section" style={{ maxWidth: 520 }}>
        <h2 className="section-title">{t("계정 정보")}</h2>
        <dl className="card-meta" style={{ border: "none", padding: 0 }}>
          <div>
            <dt>{t("이름")}</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>{t("이메일")}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>
              {t("구분")}{" "}
              <HelpTip text={t("등급이에요: 인턴 < 직원 < 관리자. 담당 인턴이 있으면 ‘멘토’로 표시돼요.")} />
            </dt>
            <dd>{t(roleLabel(user, isMentor))}</dd>
          </div>
        </dl>

        <details style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <summary className="btn btn-sm btn-danger" style={{ display: "inline-block" }}>
            {t("계정 삭제")}
          </summary>
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              {t("계정이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.")}
            </p>
            <form action={deleteAccountAction}>
              <input type="hidden" name="userId" value={user.id} />
              <ConfirmButton message={t("정말 계정을 삭제할까요? 되돌릴 수 없습니다.")}>
                {t("계정 영구 삭제")}
              </ConfirmButton>
            </form>
          </div>
        </details>
      </div>
    </main>
  );
}
