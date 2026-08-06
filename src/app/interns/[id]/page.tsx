import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { canEdit, isAdminOrBoss } from "@/lib/permissions";
import { signedResumeUrl } from "@/lib/uploads";
import { getT, getLocale } from "@/lib/i18n-server";
import { resolveBack } from "@/lib/backlink";
import { unreadMessageCount } from "@/lib/notifications";
import {
  fmtDate as fmtDateI,
  fmtShort as fmtShortI,
  toDateInput,
  isEnded,
  isCurrentlyAway,
  ddayInfo,
  seoulTodayUTCDate,
  dateKeyUTC,
  todayKey,
} from "@/lib/format";
import { computeWorkStatus, todayAdjustBounds, formatDays, classifyCheckout } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProfileForm } from "@/components/ProfileForm";
import { AdminNoteForm } from "@/components/AdminNoteForm";
import { UnavailabilityForm } from "@/components/UnavailabilityForm";
import { ScheduleAdjustForm } from "@/components/ScheduleAdjustForm";
import { WorkScheduleForm } from "@/components/WorkScheduleForm";
import { WorkPeriodForm } from "@/components/WorkPeriodForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CommentForm } from "@/components/CommentForm";
import { MarkRead } from "@/components/MarkRead";
import { TaskTitleInput } from "@/components/TaskTitleInput";
import { TaskEntryForm } from "@/app/tasks/[id]/TaskEntryForm";
import { JournalEntry } from "@/app/tasks/[id]/JournalEntry";
import { HelpTip } from "@/components/HelpTip";
import { CancelAddTask } from "@/components/CancelAddTask";
import { NoEnterSubmit } from "@/components/NoEnterSubmit";
import {
  createAssignmentAction,
  completeAssignmentAction,
  reopenAssignmentAction,
  deleteAssignmentAction,
  deleteUnavailabilityAction,
  approveUnavailabilityAction,
  approveWorkPeriodAction,
  approveWorkScheduleAction,
  deleteWorkScheduleAction,
  deleteAccountAction,
  deleteCommentAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function InternDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");
  const t = await getT();
  const locale = await getLocale();
  const fmtDate = (d: Date | string | null | undefined) => fmtDateI(d, locale);
  const fmtShort = (d: Date | string | null | undefined) => fmtShortI(d, locale);

  const { id } = await params;
  // Look back ~3 weeks of check-ins (for the 무기록 자동 퇴근 nudge).
  const recentSince = new Date(seoulTodayUTCDate());
  recentSince.setUTCDate(recentSince.getUTCDate() - 21);
  const sp = await searchParams;
  const backParam = Array.isArray(sp.back) ? sp.back[0] : sp.back;
  const back = resolveBack(t, backParam, {
    href: "/",
    label: `← ${t("대시보드로 돌아가기")}`,
  });
  const intern = await prisma.user.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          assignedBy: { select: { name: true } },
          _count: { select: { entries: true } },
          entries: { orderBy: { entryDate: "desc" }, take: 1, select: { entryDate: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
      unavailabilities: { orderBy: { startDate: "asc" } },
      workSchedules: { orderBy: { createdAt: "asc" } },
      checkIns: { where: { date: { gte: recentSince } }, orderBy: { date: "desc" } },
      comments: { orderBy: { createdAt: "asc" } },
      logEntries: {
        include: {
          attachments: { select: { id: true, kind: true, url: true, name: true } },
          assignment: { select: { id: true, title: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!intern || intern.kind !== "INTERN") notFound();

  // A frozen (ended) intern may only view their own card or cards in their own 기수.
  if (!user.isGuest && isFrozenIntern(user) && user.id !== intern.id && intern.cohortId !== user.cohortId) {
    redirect(`/interns/${user.id}`);
  }

  const mine = canEdit(user, intern.id);
  const unread = user.isGuest ? 0 : await unreadMessageCount(user.id);

  // Phone/GitHub are for logged-in users (not guests). The full resume is
  // private — only the intern themselves and admins (STAFF) may download it.
  const isAdmin = !user.isGuest && user.kind === "STAFF";
  const isAdminViewer = isAdminOrBoss(user);
  // Interns edit their own 근무 기간/시간; admins (관리자/대표님) may edit them too
  // (their edits apply immediately as confirmed).
  const canEditWork = mine || isAdminViewer;
  const canSeeContact = !user.isGuest;
  const canSeeResume = mine || isAdmin;
  // Work period/hours apply immediately but await admin confirmation.
  const periodPending = !intern.periodConfirmed && !!(intern.startDate || intern.endDate);
  const resumeUrl =
    canSeeResume && intern.resumePath ? await signedResumeUrl(intern.resumePath) : null;

  // Combine mentors the intern listed with any mentor who registered them by name.
  const mentorClaims = await prisma.mentorMentee.findMany({
    where: { internName: { equals: intern.name, mode: "insensitive" } },
    include: { mentor: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mentorList = [...intern.mentorNames];
  for (const c of mentorClaims) {
    if (!mentorList.some((m) => m.toLowerCase() === c.mentor.name.toLowerCase())) {
      mentorList.push(c.mentor.name);
    }
  }
  const mentorLabel = mentorList.length ? mentorList.join(", ") : null;
  const active = intern.assignments.filter((a) => a.status === "ACTIVE");
  const history = intern.assignments.filter((a) => a.status === "COMPLETED");
  const ended = isEnded(intern.endDate);
  // 부재 (full-day away) drives the 부재중 status; 출·퇴근 조정 is informational.
  const absences = intern.unavailabilities.filter((u) => u.kind !== "ADJUST");
  const adjusts = intern.unavailabilities.filter((u) => u.kind === "ADJUST");
  const away = !ended && isCurrentlyAway(absences);
  const workBounds = todayAdjustBounds(intern.unavailabilities);
  const todayCheck = intern.checkIns.find((c) => dateKeyUTC(c.date) === todayKey()) ?? null;
  const workKey = computeWorkStatus(intern.workSchedules, workBounds, todayCheck);

  // 무기록 자동 퇴근 nudge: days the intern checked in, never pressed 퇴근, and
  // wrote no 기록. Shown to the intern (and admins); clears once a 기록 is added.
  const journalDays = new Set(intern.logEntries.map((e) => dateKeyUTC(e.entryDate)));
  const noJournalDays = intern.checkIns.filter(
    (c) => classifyCheckout(c, intern.workSchedules, journalDays.has(dateKeyUTC(c.date))) === "AUTO_NOJOURNAL"
  );
  const showNoJournalNotice = (mine || isAdminViewer) && noJournalDays.length > 0;

  // Options for linking a log entry to one of this intern's tasks.
  const taskOptions = intern.assignments.map((a) => ({ id: a.id, title: a.title }));
  // The card shows only the most recent few entries to stay compact; the rest
  // live on the full log page (/interns/[id]/log). Photos make entries tall, so
  // show fewer (2) when the recent entries include images, and 3 when it's just
  // short text and/or links.
  const hasImage = (e: (typeof intern.logEntries)[number]) =>
    e.attachments.some((a) => a.kind === "IMAGE");
  const LOG_PREVIEW = intern.logEntries.slice(0, 3).some(hasImage) ? 2 : 3;
  const hasMoreLogs = intern.logEntries.length > LOG_PREVIEW;
  const previewEntries = intern.logEntries.slice(0, LOG_PREVIEW);
  // Group the intern's log entries by entry date (newest first).
  const logGroups: { key: string; date: Date; entries: typeof intern.logEntries }[] = [];
  for (const e of previewEntries) {
    const key = toDateInput(e.entryDate);
    const last = logGroups[logGroups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else logGroups.push({ key, date: e.entryDate, entries: [e] });
  }

  // Pastel top-border accent by status.
  let heroBorder = "#cbd5e1"; // 퇴근 / 종료 / 미설정
  if (!ended) {
    if (away) heroBorder = "#c4b5fd";
    else if (workKey === "WORKING") heroBorder = "#86efac";
  }

  return (
    <main className={`container${ended ? " is-ended" : ""}`}>
      {!user.isGuest && <MarkRead internId={intern.id} />}
      <p style={{ marginTop: 0 }}>
        <Link href={back.href}>{back.label}</Link>
      </p>

      {showNoJournalNotice && (
        <div className="nojournal-memo">
          ⚠️{" "}
          {noJournalDays.length > 1
            ? t("최근 근무일 중 {n}일을 기록 없이 자동 퇴근했어요. 기록을 남기고 퇴근을 눌러주세요.", {
                n: noJournalDays.length,
              })
            : t("{date} 기록 없이 자동 퇴근되었어요. 기록을 남기고 퇴근을 눌러주세요.", {
                date: fmtShort(noJournalDays[0].date),
              })}
        </div>
      )}

      <section className="hero" style={{ borderTop: `5px solid ${heroBorder}` }}>
        <Avatar name={intern.name} photoUrl={intern.photoUrl} size={84} />
        <div className="hero-body">
          <div className="hero-name-row">
            <h1>{intern.name}</h1>
            <span className="role-pill">{intern.internLead ? t("인턴 대표") : t("인턴")}</span>
            {intern.withdrawnAt && <span className="withdrawn-tag">{t("탈퇴")}</span>}
          </div>
          <p className="hero-sub">
            {intern.teams.length ? intern.teams.join(" · ") : t("팀 없음")} · {intern.email}
          </p>
          <div className="hero-facts">
            <span className="fact">
              <span className="fact-k">{t("인턴 기간")}</span>
              <span className="fact-v">
                {fmtDate(intern.startDate)} – {fmtDate(intern.endDate)}
              </span>
            </span>
            <span className="fact">
              <span className="fact-k">{t("멘토")}</span>
              <span className="fact-v">
                {mentorLabel ? mentorLabel : <span className="muted">{t("미지정")}</span>}
              </span>
            </span>
            {canSeeContact && intern.phone && (
              <span className="fact">
                <span className="fact-k">{t("전화번호")}</span>
                <span className="fact-v">
                  <a href={`tel:${intern.phone}`}>{intern.phone}</a>
                </span>
              </span>
            )}
            {canSeeContact && intern.githubUrl && (
              <span className="fact">
                <span className="fact-k">GitHub</span>
                <span className="fact-v">
                  <a href={intern.githubUrl} target="_blank" rel="noreferrer">
                    {intern.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "@").replace(/\/$/, "")} ↗
                  </a>
                </span>
              </span>
            )}
            {canSeeResume && intern.resumeName && (
              <span className="fact">
                <span className="fact-k">{t("이력서")}</span>
                <span className="fact-v">
                  {resumeUrl ? (
                    <a href={resumeUrl} target="_blank" rel="noreferrer">
                      📄 {intern.resumeName} ↓
                    </a>
                  ) : (
                    <span className="muted">{t("불러올 수 없음")}</span>
                  )}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="hero-status">
          <StatusBadge
            ended={ended}
            away={away}
            schedules={intern.workSchedules}
            bounds={workBounds}
            check={todayCheck}
          />
          {!mine && user.kind === "STAFF" && (
            <Link
              href={`/messages/${intern.id}/${user.id}`}
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10 }}
            >
              ✉️ {t("메시지 보내기")}
            </Link>
          )}
          {(mine || isAdminViewer) && (
            <details className="hero-edit">
              <summary className="btn btn-sm" style={{ display: "inline-block", marginTop: 10 }}>
                ✏️ {t("정보 수정")}
              </summary>
              <div className="hero-edit-panel">
                <ProfileForm
                  adminEdit={!mine}
                  initial={{
                    userId: intern.id,
                    name: intern.name,
                    email: intern.email,
                    teams: intern.teams,
                    mentorNames: intern.mentorNames.join(", "),
                    phone: intern.phone ?? "",
                    githubUrl: intern.githubUrl ?? "",
                    resumeName: intern.resumeName ?? "",
                  }}
                />
              </div>
            </details>
          )}
          {/* Personal-messages shortcut — stacked in the action column so it
              never overlaps the buttons above it. */}
          {!user.isGuest && (
            <Link href="/messages" className="notif-btn hero-inbox" title={t("개인 메시지")} aria-label={t("개인 메시지")}>
              ✉️
              {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          )}
        </div>
      </section>

      {/* Admin-only memo (referrer, private notes) — never shown to interns */}
      {isAdmin && (
        <div className="card card-pad section admin-note">
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            📝 {t("관리자 메모")}
          </h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 12 }}>
            {t("관리자만 볼 수 있어요. 인턴에게는 표시되지 않습니다.")}
          </p>
          <AdminNoteForm userId={intern.id} initial={intern.adminNote ?? ""} />
        </div>
      )}

      {/* AI resume summary — visible to all logged-in users (not guests) */}
      {canSeeContact && intern.resumeSummary && (
        <div className="card card-pad section">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            {t("이력서 요약")} <span className="ai-tag">AI</span>
          </h2>
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.6 }}>{intern.resumeSummary}</p>
        </div>
      )}

      {/* Current assignments */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("현재 업무 ({n})", { n: active.length })}</h2>
        {active.length === 0 ? (
          <div className="empty">{t("현재 진행중인 업무가 없습니다.")}</div>
        ) : (
          active.map((a) => {
            const dday = ddayInfo(a.expectedDoneDate);
            return (
            <div key={a.id} className="assignment-item accent-active">
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="inline" style={{ gap: 8 }}>
                  <Link href={`/tasks/${a.id}`} className="title task-link">
                    {a.title} →
                  </Link>
                  {dday && (
                    <span className={`dday${dday.overdue ? " overdue" : dday.soon ? " soon" : ""}`}>
                      {dday.label}
                    </span>
                  )}
                </span>
                {mine && (
                  <span className="inline">
                    <form action={completeAssignmentAction}>
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button className="btn btn-sm" type="submit">
                        {t("✓ 완료")}
                      </button>
                    </form>
                    <form action={deleteAssignmentAction}>
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button className="btn btn-sm btn-danger" type="submit">
                        {t("삭제")}
                      </button>
                    </form>
                  </span>
                )}
              </div>
              {a.description && <p style={{ margin: "4px 0" }}>{a.description}</p>}
              <div className="timeframe">
                {fmtDate(a.startDate)} → {fmtDate(a.expectedDoneDate)}
                {" · "}
                <span className="progress-note">
                  {a._count.entries > 0
                    ? t("기록 {n}개 · 최근 {date}", {
                        n: a._count.entries,
                        date: fmtShort(a.entries[0]?.entryDate),
                      })
                    : t("기록 없음")}
                </span>
              </div>
            </div>
            );
          })
        )}

        {mine && (
          <details style={{ marginTop: 14 }}>
            <summary className="btn btn-sm" style={{ display: "inline-block" }}>
              {t("+ 업무 추가")}
            </summary>
            <form action={createAssignmentAction} style={{ marginTop: 14, maxWidth: 560 }}>
              <NoEnterSubmit />
              <input type="hidden" name="internId" value={intern.id} />
              <div className="field">
                <label>{t("제목 *")}</label>
                <TaskTitleInput />
              </div>
              <div className="field">
                <label>{t("설명")}</label>
                <textarea name="description" placeholder={t("업무에 대한 간단한 설명")} />
              </div>
              <div className="row">
                <div className="field">
                  <label>{t("링크 (티켓 / 문서)")}</label>
                  <input name="link" type="url" placeholder="https://…" />
                </div>
                <div className="field">
                  <label className="label-tip">
                    {t("깃허브")}
                    <HelpTip text={t("이 업무의 코드가 있는 GitHub 저장소/PR 주소예요.")} />
                  </label>
                  <input name="githubUrl" type="url" placeholder="https://github.com/…" />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>{t("시작일")}</label>
                  <input name="startDate" type="date" />
                </div>
                <div className="field">
                  <label>{t("완료 예정일")}</label>
                  <input name="expectedDoneDate" type="date" />
                </div>
              </div>
              <div className="inline">
                <button type="submit" className="btn btn-primary">
                  {t("업무 추가")}
                </button>
                <CancelAddTask />
              </div>
            </form>
          </details>
        )}
      </div>

      {/* Work log (기록) */}
      <div className="card card-pad section">
        <div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="section-title section-title-tip" style={{ margin: 0 }}>
            {t("기록 ({n})", { n: intern.logEntries.length })}
            <HelpTip
              text={t(
                "매일 한 일을 남기는 곳이에요. 관련 업무를 선택하면 그 업무 페이지에도 연결돼요. ‘보고서 출력’으로 전체 기록을 PDF로 저장할 수 있어요."
              )}
            />
          </h2>
          {mine && (
            <Link href={`/interns/${intern.id}/report`} className="btn btn-sm">
              🖨️ {t("보고서 출력")}
            </Link>
          )}
        </div>

        {mine && (
          <details style={{ margin: "14px 0" }}>
            <summary className="btn btn-sm btn-primary" style={{ display: "inline-block" }}>
              + {t("기록 추가")}
            </summary>
            <div style={{ marginTop: 14 }}>
              <TaskEntryForm
                internId={intern.id}
                tasks={taskOptions}
                today={toDateInput(new Date())}
              />
            </div>
          </details>
        )}

        <div style={{ marginTop: mine ? 0 : 16 }}>
        {logGroups.length === 0 ? (
          <div className="empty">{t("아직 기록이 없습니다.")}</div>
        ) : (
          logGroups.map((g) => (
            <div key={g.key} className="journal-day">
              <div className="journal-date">{fmtDate(g.date)}</div>
              {g.entries.map((e) => (
                <JournalEntry
                  key={e.id}
                  mine={mine}
                  tasks={taskOptions}
                  entry={{
                    id: e.id,
                    entryDate: toDateInput(e.entryDate),
                    body: e.body,
                    attachments: e.attachments,
                    assignmentId: e.assignmentId,
                    taskTitle: e.assignment?.title ?? null,
                  }}
                />
              ))}
            </div>
          ))
        )}
        </div>

        {hasMoreLogs && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <Link href={`/interns/${intern.id}/log`} className="btn btn-sm">
              {t("전체 기록 보기 ({n})", { n: intern.logEntries.length })} →
            </Link>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("업무 이력 ({n})", { n: history.length })}</h2>
        {history.length === 0 ? (
          <div className="empty">{t("아직 완료된 업무가 없습니다.")}</div>
        ) : (
          history.map((a) => (
            <div key={a.id} className="assignment-item done">
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <Link href={`/tasks/${a.id}`} className="title task-link">
                  {a.title} →
                </Link>
                {mine && (
                  <form action={reopenAssignmentAction}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <button className="btn btn-sm" type="submit">
                      {t("↺ 다시 열기")}
                    </button>
                  </form>
                )}
              </div>
              <div className="timeframe">
                {fmtDate(a.startDate)} → {fmtDate(a.completedAt)} {t("완료")}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Work period + hours (combined) */}
      <div className="card card-pad section">
        <h2 className="section-title section-title-tip">
          {t("근무 기간 · 시간")}
          <HelpTip
            text={t(
              "인턴 기간과 요일별 근무 시간을 설정해요. 근무 시간에 따라 근무중·퇴근 상태가 자동으로 정해져요."
            )}
          />
        </h2>

        {/* Period */}
        <div className="work-block">
          <h3 className="subsection-title">{t("근무 기간")}</h3>
          {intern.startDate || intern.endDate ? (
            <div className="pill-row" style={{ marginBottom: canEditWork ? 14 : 0 }}>
              <span className={`task-pill ${periodPending ? "pending-pill" : ""}`}>
                {fmtDate(intern.startDate)} – {fmtDate(intern.endDate)}
                {periodPending && <span className="pending-tag"> · {t("확정 대기")}</span>}
                {periodPending && isAdmin && (
                  <form action={approveWorkPeriodAction} style={{ display: "inline" }}>
                    <input type="hidden" name="userId" value={intern.id} />
                    <button type="submit" className="pill-approve">{t("확정")}</button>
                  </form>
                )}
              </span>
            </div>
          ) : (
            <div className="empty" style={{ marginBottom: canEditWork ? 14 : 0 }}>{t("미설정")}</div>
          )}
          {canEditWork && (
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-block" }}>
                {intern.startDate || intern.endDate
                  ? t("근무 기간 변경")
                  : t("근무 기간 설정")}
              </summary>
              <div style={{ marginTop: 14 }}>
                <WorkPeriodForm
                  adminEdit={!mine}
                  initial={{
                    userId: intern.id,
                    startDate: toDateInput(intern.startDate),
                    endDate: toDateInput(intern.endDate),
                  }}
                />
              </div>
            </details>
          )}
        </div>

        {/* Hours */}
        <div className="work-block" style={{ marginTop: 22 }}>
          <h3 className="subsection-title">{t("근무 시간")}</h3>
          {intern.workSchedules.length === 0 ? (
            <div className="empty">{t("등록된 근무 시간이 없습니다.")}</div>
          ) : (
            <div className="pill-row" style={{ marginBottom: canEditWork ? 14 : 0 }}>
              {intern.workSchedules.map((s) => {
                const sPending = s.status === "PENDING";
                return (
                  <span key={s.id} className={`task-pill ${sPending ? "pending-pill" : ""}`}>
                    {formatDays(s.days, t)} {s.startTime}–{s.endTime}
                    {sPending && <span className="pending-tag"> · {t("확정 대기")}</span>}
                    {sPending && isAdmin && (
                      <form action={approveWorkScheduleAction} style={{ display: "inline" }}>
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <button type="submit" className="pill-approve">
                          {t("확정")}
                        </button>
                      </form>
                    )}
                    {canEditWork && (
                      <form action={deleteWorkScheduleAction} style={{ display: "inline" }}>
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <button type="submit" className="pill-x" aria-label={t("삭제")}>
                          ×
                        </button>
                      </form>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {canEditWork && (
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-block" }}>
                + {t("근무 시간 추가")}
              </summary>
              <div style={{ marginTop: 14 }}>
                <WorkScheduleForm userId={intern.id} adminEdit={!mine} />
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Schedule adjustments: full-day 부재 + single-day 출·퇴근 조정 */}
      <div className="card card-pad section">
        <h2 className="section-title section-title-tip">
          {t("일정 조정")}
          <HelpTip
            text={t(
              "부재(하루 종일)나 출·퇴근 조정(늦은 출근·이른 퇴근)을 등록하면 관리자 승인 후 반영돼요."
            )}
          />
        </h2>

        {/* 부재 */}
        <div className="work-block">
          <h3 className="subsection-title">{t("부재")}</h3>
          {absences.length === 0 ? (
            <div className="empty" style={{ marginBottom: mine ? 14 : 0 }}>
              {t("등록된 부재 일정이 없습니다.")}
            </div>
          ) : (
            <div className="pill-row" style={{ marginBottom: mine ? 14 : 0 }}>
              {absences.map((u) => {
                const approved = u.status === "APPROVED";
                return (
                  <span key={u.id} className={`task-pill ${approved ? "away-pill" : "pending-pill"}`}>
                    {approved ? "🟣" : "🟡"} {fmtDate(u.startDate)} – {fmtDate(u.endDate)}
                    {u.reason ? ` · ${u.reason}` : ""}
                    {!approved && <span className="pending-tag"> · {t("승인 대기")}</span>}
                    {!approved && isAdmin && (
                      <form action={approveUnavailabilityAction} style={{ display: "inline" }}>
                        <input type="hidden" name="unavailabilityId" value={u.id} />
                        <button type="submit" className="pill-approve">{t("승인")}</button>
                      </form>
                    )}
                    {mine && (
                      <form action={deleteUnavailabilityAction} style={{ display: "inline" }}>
                        <input type="hidden" name="unavailabilityId" value={u.id} />
                        <button type="submit" className="pill-x" aria-label={t("삭제")}>×</button>
                      </form>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {mine && (
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-block" }}>
                + {t("부재 일정 등록")}
              </summary>
              <div style={{ marginTop: 14 }}>
                <UnavailabilityForm userId={intern.id} />
              </div>
            </details>
          )}
        </div>

        {/* 출·퇴근 조정 */}
        <div className="work-block" style={{ marginTop: 22 }}>
          <h3 className="subsection-title">{t("출·퇴근 조정")}</h3>
          {adjusts.length === 0 ? (
            <div className="empty" style={{ marginBottom: mine ? 14 : 0 }}>
              {t("등록된 출·퇴근 조정이 없습니다.")}
            </div>
          ) : (
            <div className="pill-row" style={{ marginBottom: mine ? 14 : 0 }}>
              {adjusts.map((u) => {
                const approved = u.status === "APPROVED";
                return (
                  <span key={u.id} className={`task-pill ${approved ? "" : "pending-pill"}`}>
                    ⏰ {fmtDate(u.startDate)} · {u.adjustTime}{" "}
                    {u.adjustType === "EARLY" ? t("퇴근") : t("출근")}
                    {u.reason ? ` · ${u.reason}` : ""}
                    {!approved && <span className="pending-tag"> · {t("승인 대기")}</span>}
                    {!approved && isAdmin && (
                      <form action={approveUnavailabilityAction} style={{ display: "inline" }}>
                        <input type="hidden" name="unavailabilityId" value={u.id} />
                        <button type="submit" className="pill-approve">{t("승인")}</button>
                      </form>
                    )}
                    {mine && (
                      <form action={deleteUnavailabilityAction} style={{ display: "inline" }}>
                        <input type="hidden" name="unavailabilityId" value={u.id} />
                        <button type="submit" className="pill-x" aria-label={t("삭제")}>×</button>
                      </form>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {mine && (
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-block" }}>
                + {t("출·퇴근 조정 등록")}
              </summary>
              <div style={{ marginTop: 14 }}>
                <ScheduleAdjustForm userId={intern.id} />
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Comments (public) */}
      <div className="card card-pad section">
        <h2 className="section-title">{t("댓글 ({n})", { n: intern.comments.length })}</h2>
        {intern.comments.length === 0 ? (
          <div className="empty">{t("아직 댓글이 없습니다.")}</div>
        ) : (
          <div className="comment-list">
            {intern.comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-head">
                  <span className="comment-author">{c.authorName}</span>
                  <span className="comment-date">{fmtDate(c.createdAt)}</span>
                  {(c.authorId === user.id || mine) && (
                    <form action={deleteCommentAction} style={{ display: "inline", marginLeft: "auto" }}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <button type="submit" className="pill-x" aria-label={t("삭제")}>
                        ×
                      </button>
                    </form>
                  )}
                </div>
                <p className="comment-body">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        {!user.isGuest && <CommentForm internId={intern.id} />}
      </div>

      {/* Account */}
      {mine && (
        <div className="card card-pad section">
          <details>
            <summary className="btn btn-sm btn-danger" style={{ display: "inline-block" }}>
              {t("계정 삭제")}
            </summary>
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ fontSize: 13 }}>
                {t("계정과 모든 업무·기록이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.")}
              </p>
              <form action={deleteAccountAction}>
                <input type="hidden" name="userId" value={intern.id} />
                <ConfirmButton message={t("정말 계정을 삭제할까요? 모든 데이터가 사라지며 되돌릴 수 없습니다.")}>
                  {t("계정 영구 삭제")}
                </ConfirmButton>
              </form>
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
