import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { fmtDate, toDateInput, ddayInfo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { ProjectEditForm } from "./ProjectEditForm";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        include: { intern: { select: { id: true, name: true, photoUrl: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!project) notFound();

  // Group the project's tasks by intern.
  const byIntern = new Map<
    string,
    { intern: (typeof project.tasks)[number]["intern"]; tasks: typeof project.tasks }
  >();
  for (const t of project.tasks) {
    const k = t.intern.id;
    if (!byIntern.has(k)) byIntern.set(k, { intern: t.intern, tasks: [] });
    byIntern.get(k)!.tasks.push(t);
  }
  const members = [...byIntern.values()];

  return (
    <main className="container">
      <p style={{ marginTop: 0 }}>
        <Link href="/projects">← 프로젝트 목록</Link>
      </p>
      <h1 className="page-title" style={{ marginBottom: 2 }}>
        📁 {project.name}
      </h1>
      <p className="page-sub">
        참여 인턴 {members.length}명 · 업무 {project.tasks.length}개
      </p>

      {/* Project details */}
      <div className="card card-pad section">
        <div className="hero-facts">
          <span className="fact">
            <span className="fact-k">담당자</span>
            <span className="fact-v">
              {project.lead ? project.lead : <span className="muted">미지정</span>}
            </span>
          </span>
          <span className="fact">
            <span className="fact-k">기간</span>
            <span className="fact-v">
              {project.startDate || project.dueDate ? (
                <>
                  {fmtDate(project.startDate)} – {fmtDate(project.dueDate)}
                </>
              ) : (
                <span className="muted">미설정</span>
              )}
            </span>
          </span>
          {(() => {
            const d = ddayInfo(project.dueDate);
            return d ? (
              <span className="fact">
                <span className="fact-k">마감</span>
                <span className="fact-v">
                  <span className={`dday${d.overdue ? " overdue" : d.soon ? " soon" : ""}`}>
                    {d.label}
                  </span>
                </span>
              </span>
            ) : null;
          })()}
        </div>
        {project.description && (
          <p style={{ margin: "12px 0 0", whiteSpace: "pre-wrap" }}>{project.description}</p>
        )}
        <details style={{ marginTop: 14 }}>
          <summary className="btn btn-sm" style={{ display: "inline-block" }}>
            프로젝트 정보 수정
          </summary>
          <div style={{ marginTop: 14 }}>
            <ProjectEditForm
              initial={{
                id: project.id,
                name: project.name,
                lead: project.lead ?? "",
                description: project.description ?? "",
                startDate: toDateInput(project.startDate),
                dueDate: toDateInput(project.dueDate),
              }}
            />
          </div>
        </details>
      </div>

      {members.length === 0 ? (
        <div className="card card-pad empty">이 프로젝트에 연결된 업무가 없습니다.</div>
      ) : (
        members.map((m) => (
          <div key={m.intern.id} className="card card-pad section">
            <div className="inline" style={{ marginBottom: 10 }}>
              <Avatar name={m.intern.name} photoUrl={m.intern.photoUrl} size={32} />
              <Link href={`/interns/${m.intern.id}`} className="intern-name" style={{ fontSize: 15 }}>
                {m.intern.name}
              </Link>
            </div>
            <div className="pill-row">
              {m.tasks.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="task-pill">
                  {t.title}
                  {t.status === "COMPLETED" ? " ✓" : ""}
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
