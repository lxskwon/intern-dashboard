import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { getT, getLocale } from "@/lib/i18n-server";
import { isEnded, ddayInfo, fmtShort } from "@/lib/format";

export const dynamic = "force-dynamic";

/** 모든 업무 — every active task across all interns, with the assigned intern,
 *  its GitHub link, deadline and journal count, all linked in one place. */
export default async function AllTasksPage() {
  const user = await getViewer();
  if (!user) redirect("/login");
  if (isFrozenIntern(user)) redirect(`/interns/${user.id}`);
  const t = await getT();
  const locale = await getLocale();

  const tasks = await prisma.assignment.findMany({
    where: { status: "ACTIVE" },
    include: {
      intern: { select: { id: true, name: true, endDate: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ intern: { name: "asc" } }, { createdAt: "desc" }],
  });

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("모든 업무")}
      </h1>
      <p className="page-sub">{t("진행 중인 모든 업무와 담당 인턴을 한눈에 볼 수 있어요.")}</p>

      {tasks.length === 0 ? (
        <div className="card card-pad empty">{t("아직 진행 중인 업무가 없습니다.")}</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {tasks.map((a) => {
            const ended = isEnded(a.intern.endDate);
            const dday = ended ? null : ddayInfo(a.expectedDoneDate);
            return (
              <div key={a.id} className="alltask-row">
                <div className="alltask-main">
                  <Link href={`/tasks/${a.id}`} className="alltask-title">
                    {dday && (
                      <span className={`dday${dday.overdue ? " overdue" : dday.soon ? " soon" : ""}`}>
                        {dday.label}
                      </span>
                    )}
                    {a.title}
                  </Link>
                  <div className="alltask-sub">
                    <Link href={`/interns/${a.intern.id}`} className="alltask-intern">
                      {a.intern.name}
                    </Link>
                    {a.link && (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="alltask-gh"
                        title={a.link}
                      >
                        🔗 {t("링크")}
                      </a>
                    )}
                    {a.githubUrl && (
                      <a
                        href={a.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="alltask-gh"
                        title={a.githubUrl}
                      >
                        🔗 GitHub
                      </a>
                    )}
                  </div>
                </div>
                <div className="alltask-side muted">
                  {a._count.entries > 0 ? t("기록 {n}", { n: a._count.entries }) : t("기록 없음")}
                  {a.expectedDoneDate ? ` · ${fmtShort(a.expectedDoneDate, locale)}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
