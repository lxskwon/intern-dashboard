/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { fmtDate, toDateInput, ddayInfo } from "@/lib/format";
import { relatedScore } from "@/lib/text";
import { setTaskProjectAction } from "@/lib/actions";
import { TaskEntryForm } from "./TaskEntryForm";
import { TaskEditForm } from "./TaskEditForm";
import { JournalEntry } from "./JournalEntry";
import { ProjectInput } from "@/components/ProjectInput";

export const dynamic = "force-dynamic";

type EntryWithRel = {
  id: string;
  entryDate: Date;
  body: string | null;
  author: { name: string } | null;
  attachments: { id: string; kind: string; url: string; name: string | null }[];
};

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const { id } = await params;
  const task = await prisma.assignment.findUnique({
    where: { id },
    include: {
      intern: true,
      project: true,
      assignedBy: { select: { name: true } },
      entries: {
        include: { author: { select: { name: true } }, attachments: true },
        orderBy: { entryDate: "desc" },
      },
    },
  });

  if (!task) notFound();

  const mine = canEdit(user, task.internId);
  const done = task.status === "COMPLETED";
  const givenDate = task.startDate ?? task.createdAt;

  // Hard grouping: other tasks in the same project.
  const projectTasks = task.projectId
    ? await prisma.assignment.findMany({
        where: { projectId: task.projectId, id: { not: task.id } },
        select: {
          id: true,
          title: true,
          status: true,
          intern: { select: { name: true } },
        },
        orderBy: { intern: { name: "asc" } },
      })
    : [];

  // Soft discovery: similar-titled tasks not already in this project.
  const others = await prisma.assignment.findMany({
    where: {
      id: { not: task.id },
      internId: { not: task.internId },
      ...(task.projectId ? { projectId: { not: task.projectId } } : {}),
    },
    select: { id: true, title: true, intern: { select: { name: true } } },
  });
  const related = others
    .map((t) => ({ t, score: relatedScore(task.title, t.title) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // Group entries by day (already sorted newest-first).
  const groups: { key: string; date: Date; entries: EntryWithRel[] }[] = [];
  for (const e of task.entries) {
    const key = toDateInput(e.entryDate);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, date: e.entryDate, entries: [e] });
  }

  return (
    <main className="container">
      <p style={{ marginTop: 0 }}>
        <Link href={`/interns/${task.internId}`}>← {task.intern.name} 카드로</Link>
      </p>

      <section className="task-hero">
        <div className="inline" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {task.title}
          </h1>
          <span
            className="badge"
            style={
              done
                ? { background: "#e2e8f0", color: "#475569" }
                : { background: "#fef9c3", color: "#a16207" }
            }
          >
            {done ? "완료" : "진행중"}
          </span>
        </div>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="hero-facts" style={{ marginTop: 12 }}>
          <span className="fact">
            <span className="fact-k">담당 인턴</span>
            <span className="fact-v">
              <Link href={`/interns/${task.internId}`}>{task.intern.name}</Link>
            </span>
          </span>
          <span className="fact">
            <span className="fact-k">부여일</span>
            <span className="fact-v">{fmtDate(givenDate)}</span>
          </span>
          <span className="fact">
            <span className="fact-k">마감일</span>
            <span className="fact-v">
              {fmtDate(task.expectedDoneDate)}
              {!done &&
                (() => {
                  const d = ddayInfo(task.expectedDoneDate);
                  return d ? (
                    <span
                      className={`dday${d.overdue ? " overdue" : d.soon ? " soon" : ""}`}
                      style={{ marginLeft: 8 }}
                    >
                      {d.label}
                    </span>
                  ) : null;
                })()}
            </span>
          </span>
          {task.assignedBy && (
            <span className="fact">
              <span className="fact-k">배정</span>
              <span className="fact-v">{task.assignedBy.name}</span>
            </span>
          )}
          {task.link && (
            <span className="fact">
              <span className="fact-k">링크</span>
              <span className="fact-v">
                <a href={task.link} target="_blank" rel="noreferrer">
                  티켓/문서 ↗
                </a>
              </span>
            </span>
          )}
        </div>
      </section>

      {mine && (
        <div className="card card-pad section">
          <details>
            <summary className="btn btn-sm" style={{ display: "inline-block" }}>
              업무 정보 수정
            </summary>
            <div style={{ marginTop: 14 }}>
              <TaskEditForm
                initial={{
                  id: task.id,
                  title: task.title,
                  description: task.description ?? "",
                  link: task.link ?? "",
                  startDate: toDateInput(task.startDate),
                  expectedDoneDate: toDateInput(task.expectedDoneDate),
                }}
              />
            </div>
          </details>
        </div>
      )}

      {/* Project (hard grouping) */}
      <div className="card card-pad section">
        <h2 className="section-title">프로젝트</h2>
        {task.project ? (
          <>
            <p style={{ margin: "0 0 10px" }}>
              <Link href={`/projects/${task.projectId}`} className="proj-link">
                📁 {task.project.name}
              </Link>{" "}
              <span className="muted">· 총 {projectTasks.length + 1}개 업무</span>
            </p>
            {projectTasks.length > 0 && (
              <div className="pill-row">
                {projectTasks.map((pt) => (
                  <Link key={pt.id} href={`/tasks/${pt.id}`} className="task-pill">
                    {pt.title} <span className="muted">· {pt.intern.name}</span>
                    {pt.status === "COMPLETED" ? " ✓" : ""}
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty">아직 프로젝트에 연결되지 않았습니다.</div>
        )}

        {mine && (
          <details style={{ marginTop: 12 }}>
            <summary className="btn btn-sm" style={{ display: "inline-block" }}>
              프로젝트 {task.project ? "변경" : "연결"}
            </summary>
            <div style={{ marginTop: 12 }}>
              <form action={setTaskProjectAction} style={{ maxWidth: 420 }}>
                <input type="hidden" name="assignmentId" value={task.id} />
                <ProjectInput defaultName={task.project?.name ?? ""} defaultId={task.projectId ?? ""} />
                <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                  저장
                </button>
              </form>
              {task.project && (
                <form action={setTaskProjectAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="assignmentId" value={task.id} />
                  <button type="submit" className="btn btn-sm btn-danger">
                    프로젝트 연결 해제
                  </button>
                </form>
              )}
            </div>
          </details>
        )}
      </div>

      {related.length > 0 && (
        <div className="card card-pad section">
          <h2 className="section-title">비슷한 업무</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
            이름이 비슷한 다른 업무예요. 같은 프로젝트라면 위에서 연결해보세요.
          </p>
          <div className="pill-row">
            {related.map(({ t }) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="task-pill">
                {t.title} <span className="muted">· {t.intern.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {mine && (
        <div className="card card-pad section">
          <h2 className="section-title">오늘의 기록 추가</h2>
          <TaskEntryForm assignmentId={task.id} today={toDateInput(new Date())} />
        </div>
      )}

      <div className="card card-pad section">
        <h2 className="section-title">진행 일지 ({task.entries.length})</h2>
        {groups.length === 0 ? (
          <div className="empty">아직 기록이 없습니다.</div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="journal-day">
              <div className="journal-date">{fmtDate(g.date)}</div>
              {g.entries.map((e) => (
                <JournalEntry
                  key={e.id}
                  mine={mine}
                  entry={{
                    id: e.id,
                    entryDate: toDateInput(e.entryDate),
                    body: e.body,
                    authorName: e.author?.name ?? "알 수 없음",
                    attachments: e.attachments,
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
