import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getViewer();
  if (!user) redirect("/login");

  const projects = await prisma.project.findMany({
    include: { tasks: { select: { internId: true, intern: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        프로젝트
      </h1>
      <p className="page-sub">여러 인턴이 함께 진행하는 프로젝트 모음입니다.</p>

      {projects.length === 0 ? (
        <div className="card card-pad empty">
          아직 프로젝트가 없습니다. 업무를 만들 때 프로젝트 이름을 입력하면 자동으로 생성됩니다.
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {projects.map((pr) => {
            const interns = [...new Map(pr.tasks.map((t) => [t.internId, t.intern.name])).values()];
            return (
              <Link key={pr.id} href={`/projects/${pr.id}`} className="inbox-row">
                <div className="inbox-main">
                  <div className="inbox-name">📁 {pr.name}</div>
                  <div className="inbox-last">
                    {interns.length ? interns.join(", ") : "연결된 업무 없음"}
                  </div>
                </div>
                <div className="inbox-side">
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    업무 {pr.tasks.length}개 · {interns.length}명
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
