/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { fmtDate as fmtDateI, toDateInput, ddayInfo } from "@/lib/format";
import { relatedScore } from "@/lib/text";
import { TaskEditForm } from "./TaskEditForm";
import { JournalEntry } from "./JournalEntry";
import { getT, getLocale } from "@/lib/i18n-server";

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
  const t = await getT();
  const locale = await getLocale();
  const fmtDate = (d: Date | string | null | undefined) => fmtDateI(d, locale);

  const { id } = await params;
  const task = await prisma.assignment.findUnique({
    where: { id },
    include: {
      intern: true,
      assignedBy: { select: { name: true } },
      entries: {
        include: { author: { select: { name: true } }, attachments: true },
        orderBy: { entryDate: "desc" },
      },
    },
  });

  if (!task) notFound();

  // A frozen (ended) intern may only view tasks of interns in their own 기수.
  if (!user.isGuest && isFrozenIntern(user) && task.intern.cohortId !== user.cohortId) {
    redirect(`/interns/${user.id}`);
  }

  const mine = canEdit(user, task.internId);
  const done = task.status === "COMPLETED";
  const givenDate = task.startDate ?? task.createdAt;

  // Soft discovery: similar-titled tasks by other interns.
  const others = await prisma.assignment.findMany({
    where: {
      id: { not: task.id },
      internId: { not: task.internId },
    },
    select: { id: true, title: true, intern: { select: { name: true } } },
  });
  const related = others
    .map((item) => ({ item, score: relatedScore(task.title, item.title) }))
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
        <Link href={`/interns/${task.internId}`}>{t("← {name} 카드로", { name: task.intern.name })}</Link>
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
            {done ? t("완료") : t("진행중")}
          </span>
        </div>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="hero-facts" style={{ marginTop: 12 }}>
          <span className="fact">
            <span className="fact-k">{t("담당 인턴")}</span>
            <span className="fact-v">
              <Link href={`/interns/${task.internId}`}>{task.intern.name}</Link>
            </span>
          </span>
          <span className="fact">
            <span className="fact-k">{t("부여일")}</span>
            <span className="fact-v">{fmtDate(givenDate)}</span>
          </span>
          <span className="fact">
            <span className="fact-k">{t("마감일")}</span>
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
              <span className="fact-k">{t("배정")}</span>
              <span className="fact-v">{task.assignedBy.name}</span>
            </span>
          )}
          {task.link && (
            <span className="fact">
              <span className="fact-k">{t("링크 (티켓 / 문서)")}</span>
              <span className="fact-v">
                <a href={task.link} target="_blank" rel="noreferrer">
                  {t("티켓/문서 ↗")}
                </a>
              </span>
            </span>
          )}
          {task.githubUrl && (
            <span className="fact">
              <span className="fact-k">{t("깃허브")}</span>
              <span className="fact-v">
                <a href={task.githubUrl} target="_blank" rel="noreferrer">
                  🔗 GitHub ↗
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
              {t("업무 정보 수정")}
            </summary>
            <div style={{ marginTop: 14 }}>
              <TaskEditForm
                initial={{
                  id: task.id,
                  title: task.title,
                  description: task.description ?? "",
                  link: task.link ?? "",
                  githubUrl: task.githubUrl ?? "",
                  startDate: toDateInput(task.startDate),
                  expectedDoneDate: toDateInput(task.expectedDoneDate),
                }}
              />
            </div>
          </details>
        </div>
      )}

      {related.length > 0 && (
        <div className="card card-pad section">
          <h2 className="section-title">{t("비슷한 업무")}</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
            {t("이름이 비슷한 다른 인턴의 업무예요.")}
          </p>
          <div className="pill-row">
            {related.map(({ item }) => (
              <Link key={item.id} href={`/tasks/${item.id}`} className="task-pill">
                {item.title} <span className="muted">{t("· {name}", { name: item.intern.name })}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card card-pad section">
        <h2 className="section-title">{t("진행 일지 ({n})", { n: task.entries.length })}</h2>
        {mine && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
            {t("기록은 내 카드의 기록 섹션에서 추가합니다. 여기에는 이 업무에 연결된 기록만 표시됩니다.")}
          </p>
        )}
        {groups.length === 0 ? (
          <div className="empty">{t("이 업무에 연결된 기록이 없습니다.")}</div>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="journal-day">
              <div className="journal-date">{fmtDate(g.date)}</div>
              {g.entries.map((e) => (
                <JournalEntry
                  key={e.id}
                  mine={mine}
                  showTaskLink={false}
                  tasks={[{ id: task.id, title: task.title }]}
                  entry={{
                    id: e.id,
                    entryDate: toDateInput(e.entryDate),
                    body: e.body,
                    attachments: e.attachments,
                    assignmentId: task.id,
                    taskTitle: task.title,
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
