import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { getT, getLocale } from "@/lib/i18n-server";
import { isEnded, ddayInfo, fmtShort } from "@/lib/format";
import { TaskFilters } from "@/components/TaskFilters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** 모든 업무 — every active task across all interns, with the assigned intern,
 *  its GitHub link, deadline and journal count, all linked in one place.
 *  Filterable by 담당 인턴 or by 본부 (team of the assigned intern). */
export default async function AllTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getViewer();
  if (!user) redirect("/login");
  if (isFrozenIntern(user)) redirect(`/interns/${user.id}`);
  const t = await getT();
  const locale = await getLocale();

  const sp = await searchParams;
  const internFilter = one(sp.intern);
  const teamFilter = one(sp.team);

  const tasks = await prisma.assignment.findMany({
    where: { status: "ACTIVE" },
    include: {
      intern: { select: { id: true, name: true, endDate: true, teams: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ intern: { name: "asc" } }, { createdAt: "desc" }],
  });

  // Build filter options from every task's intern, then apply the active filters.
  const internOptions = [...new Map(tasks.map((a) => [a.intern.id, a.intern.name]))]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const teamOptions = [...new Set(tasks.flatMap((a) => a.intern.teams))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const filtered = tasks.filter((a) => {
    if (internFilter && a.intern.id !== internFilter) return false;
    if (teamFilter && !a.intern.teams.includes(teamFilter)) return false;
    return true;
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
        <>
          <TaskFilters
            interns={internOptions}
            teams={teamOptions}
            selectedIntern={internFilter}
            selectedTeam={teamFilter}
          />
          {filtered.length === 0 ? (
            <div className="card card-pad empty">{t("조건에 맞는 업무가 없습니다.")}</div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {filtered.map((a) => {
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
        </>
      )}
    </main>
  );
}
