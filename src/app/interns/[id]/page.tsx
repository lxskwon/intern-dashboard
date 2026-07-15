import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { unreadMessageCount } from "@/lib/notifications";
import { fmtDate, toDateInput, isEnded, isCurrentlyAway, fmtShort, ddayInfo } from "@/lib/format";
import { computeWorkStatus, formatDays } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ProfileForm } from "@/components/ProfileForm";
import { UnavailabilityForm } from "@/components/UnavailabilityForm";
import { WorkScheduleForm } from "@/components/WorkScheduleForm";
import { WorkPeriodForm } from "@/components/WorkPeriodForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CommentForm } from "@/components/CommentForm";
import { MarkRead } from "@/components/MarkRead";
import { TaskTitleInput } from "@/components/TaskTitleInput";
import { ProjectInput } from "@/components/ProjectInput";
import {
  createAssignmentAction,
  completeAssignmentAction,
  reopenAssignmentAction,
  deleteAssignmentAction,
  deleteUnavailabilityAction,
  deleteWorkScheduleAction,
  deleteAccountAction,
  deleteCommentAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function InternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const { id } = await params;
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
      comments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!intern || intern.kind !== "INTERN") notFound();

  const mine = canEdit(user, intern.id);
  const unread = user.isGuest ? 0 : await unreadMessageCount(user.id);

  // If the intern didn't type a mentor, see if a mentor registered them by name.
  let mentorLabel = intern.mentorName;
  if (!mentorLabel) {
    const claim = await prisma.mentorMentee.findFirst({
      where: { internName: { equals: intern.name, mode: "insensitive" } },
      include: { mentor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    mentorLabel = claim?.mentor.name ?? null;
  }
  const active = intern.assignments.filter((a) => a.status === "ACTIVE");
  const history = intern.assignments.filter((a) => a.status === "COMPLETED");
  const ended = isEnded(intern.endDate);
  const away = !ended && isCurrentlyAway(intern.unavailabilities);
  const workKey = computeWorkStatus(intern.workSchedules);

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
        <Link href="/">← 대시보드로 돌아가기</Link>
      </p>

      <section className="hero" style={{ borderTop: `5px solid ${heroBorder}` }}>
        <Avatar name={intern.name} photoUrl={intern.photoUrl} size={84} />
        <div className="hero-body">
          <div className="hero-name-row">
            <h1>{intern.name}</h1>
            <span className="role-pill">인턴</span>
          </div>
          <p className="hero-sub">
            {intern.team ?? "팀 없음"} · {intern.email}
          </p>
          <div className="hero-facts">
            <span className="fact">
              <span className="fact-k">인턴 기간</span>
              <span className="fact-v">
                {fmtDate(intern.startDate)} – {fmtDate(intern.endDate)}
              </span>
            </span>
            <span className="fact">
              <span className="fact-k">멘토</span>
              <span className="fact-v">
                {mentorLabel ? mentorLabel : <span className="muted">미지정</span>}
              </span>
            </span>
          </div>
        </div>
        <div className="hero-status">
          <StatusBadge ended={ended} away={away} schedules={intern.workSchedules} />
          {!mine && user.kind === "STAFF" && (
            <Link
              href={`/messages/${intern.id}/${user.id}`}
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10 }}
            >
              ✉️ 메시지 보내기
            </Link>
          )}
          {mine && (
            <details className="hero-edit">
              <summary className="btn btn-sm" style={{ display: "inline-block", marginTop: 10 }}>
                ✏️ 정보 수정
              </summary>
              <div className="hero-edit-panel">
                <ProfileForm
                  initial={{
                    userId: intern.id,
                    name: intern.name,
                    email: intern.email,
                    team: intern.team ?? "",
                    mentorName: mentorLabel ?? "",
                  }}
                />
              </div>
            </details>
          )}
        </div>

        {/* Inbox shortcut, bottom-right of the card */}
        {!user.isGuest && (
          <Link href="/messages" className="notif-btn hero-inbox" title="개인 메시지" aria-label="개인 메시지">
            ✉️
            {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        )}
      </section>

      {/* Current assignments */}
      <div className="card card-pad section">
        <h2 className="section-title">현재 업무 ({active.length})</h2>
        {active.length === 0 ? (
          <div className="empty">현재 진행중인 업무가 없습니다.</div>
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
                        ✓ 완료
                      </button>
                    </form>
                    <form action={deleteAssignmentAction}>
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button className="btn btn-sm btn-danger" type="submit">
                        삭제
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
                    ? `기록 ${a._count.entries}개 · 최근 ${fmtShort(a.entries[0]?.entryDate)}`
                    : "기록 없음"}
                </span>
              </div>
            </div>
            );
          })
        )}

        {mine && (
          <details style={{ marginTop: 14 }}>
            <summary className="btn btn-sm" style={{ display: "inline-block" }}>
              + 업무 추가
            </summary>
            <form action={createAssignmentAction} style={{ marginTop: 14, maxWidth: 560 }}>
              <input type="hidden" name="internId" value={intern.id} />
              <div className="field">
                <label>제목 *</label>
                <TaskTitleInput />
              </div>
              <div className="field">
                <label>프로젝트</label>
                <ProjectInput />
              </div>
              <div className="field">
                <label>설명</label>
                <textarea name="description" placeholder="업무에 대한 간단한 설명" />
              </div>
              <div className="field">
                <label>링크 (티켓 / 문서)</label>
                <input name="link" type="url" placeholder="https://…" />
              </div>
              <div className="row">
                <div className="field">
                  <label>시작일</label>
                  <input name="startDate" type="date" />
                </div>
                <div className="field">
                  <label>완료 예정일</label>
                  <input name="expectedDoneDate" type="date" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                업무 추가
              </button>
            </form>
          </details>
        )}
      </div>

      {/* History */}
      <div className="card card-pad section">
        <h2 className="section-title">업무 이력 ({history.length})</h2>
        {history.length === 0 ? (
          <div className="empty">아직 완료된 업무가 없습니다.</div>
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
                      ↺ 다시 열기
                    </button>
                  </form>
                )}
              </div>
              <div className="timeframe">
                {fmtDate(a.startDate)} → {fmtDate(a.completedAt)} 완료
              </div>
            </div>
          ))
        )}
      </div>

      {/* Work period + hours (combined) */}
      <div className="card card-pad section">
        <h2 className="section-title">근무 기간 · 시간</h2>

        {/* Period */}
        <div className="work-block">
          <h3 className="subsection-title">근무 기간</h3>
          {mine ? (
            <WorkPeriodForm
              initial={{
                userId: intern.id,
                startDate: toDateInput(intern.startDate),
                endDate: toDateInput(intern.endDate),
              }}
            />
          ) : (
            <p style={{ margin: 0 }}>
              {intern.startDate || intern.endDate ? (
                <>
                  {fmtDate(intern.startDate)} – {fmtDate(intern.endDate)}
                </>
              ) : (
                <span className="muted">미설정</span>
              )}
            </p>
          )}
        </div>

        {/* Hours */}
        <div className="work-block" style={{ marginTop: 22 }}>
          <h3 className="subsection-title">근무 시간</h3>
          {intern.workSchedules.length === 0 ? (
            <div className="empty">등록된 근무 시간이 없습니다.</div>
          ) : (
            <div className="pill-row" style={{ marginBottom: mine ? 14 : 0 }}>
              {intern.workSchedules.map((s) => (
                <span key={s.id} className="task-pill">
                  {formatDays(s.days)} {s.startTime}–{s.endTime}
                  {mine && (
                    <form action={deleteWorkScheduleAction} style={{ display: "inline" }}>
                      <input type="hidden" name="scheduleId" value={s.id} />
                      <button type="submit" className="pill-x" aria-label="삭제">
                        ×
                      </button>
                    </form>
                  )}
                </span>
              ))}
            </div>
          )}
          {mine && (
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-block" }}>
                + 근무 시간 추가
              </summary>
              <div style={{ marginTop: 14 }}>
                <WorkScheduleForm userId={intern.id} />
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Out-of-office periods */}
      <div className="card card-pad section">
        <h2 className="section-title">부재 일정</h2>
        {intern.unavailabilities.length === 0 ? (
          <div className="empty">등록된 부재 일정이 없습니다.</div>
        ) : (
          <div className="pill-row" style={{ marginBottom: mine ? 14 : 0 }}>
            {intern.unavailabilities.map((u) => (
              <span key={u.id} className="task-pill away-pill">
                🟣 {fmtDate(u.startDate)} – {fmtDate(u.endDate)}
                {u.reason ? ` · ${u.reason}` : ""}
                {mine && (
                  <form action={deleteUnavailabilityAction} style={{ display: "inline" }}>
                    <input type="hidden" name="unavailabilityId" value={u.id} />
                    <button type="submit" className="pill-x" aria-label="삭제">
                      ×
                    </button>
                  </form>
                )}
              </span>
            ))}
          </div>
        )}
        {mine && (
          <details>
            <summary className="btn btn-sm" style={{ display: "inline-block" }}>
              + 부재 일정 등록
            </summary>
            <div style={{ marginTop: 14 }}>
              <UnavailabilityForm userId={intern.id} />
            </div>
          </details>
        )}
      </div>

      {/* Comments (public) */}
      <div className="card card-pad section">
        <h2 className="section-title">댓글 ({intern.comments.length})</h2>
        {intern.comments.length === 0 ? (
          <div className="empty">아직 댓글이 없습니다.</div>
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
                      <button type="submit" className="pill-x" aria-label="삭제">
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
              계정 삭제
            </summary>
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ fontSize: 13 }}>
                계정과 모든 업무·기록이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <form action={deleteAccountAction}>
                <input type="hidden" name="userId" value={intern.id} />
                <ConfirmButton message="정말 계정을 삭제할까요? 모든 데이터가 사라지며 되돌릴 수 없습니다.">
                  계정 영구 삭제
                </ConfirmButton>
              </form>
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
