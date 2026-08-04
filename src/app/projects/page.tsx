import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { getT, getLocale } from "@/lib/i18n-server";
import { isEnded, ddayInfo, fmtShort } from "@/lib/format";
import { TaskFilters } from "@/components/TaskFilters";
import { autoCloseEndedInternTasks } from "@/lib/autoclose";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type TaskRow = Awaited<ReturnType<typeof loadTasks>>[number];

async function loadTasks() {
  return prisma.assignment.findMany({
    include: {
      intern: {
        select: {
          id: true,
          name: true,
          endDate: true,
          teams: true,
          cohortId: true,
          cohort: { select: { label: true } },
        },
      },
      _count: { select: { entries: true } },
    },
    orderBy: [{ intern: { name: "asc" } }, { createdAt: "desc" }],
  });
}

/** 모든 업무 — every task across all interns (진행 중 + 완료), with the assigned
 *  intern, its links, deadline and journal count, all in one place.
 *  Filterable by 기수, 담당 인턴 or 본부 (team of the assigned intern). */
export default async function AllTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getViewer();
  if (!user) redirect("/login");
  if (isFrozenIntern(user)) redirect(`/interns/${user.id}`);
  const t = await getT();
  const locale = await getLocale();

  const sp = await searchParams;
  const cohortParam = one(sp.cohort);
  const internFilter = one(sp.intern);
  const teamFilter = one(sp.team);

  // Self-heal: close any ended intern's still-ongoing tasks (마감일 → 종료일 when
  // unset) before listing, so 모든 업무 never shows a departed intern as 진행중.
  await autoCloseEndedInternTasks();

  const [tasks, cohorts] = await Promise.all([loadTasks(), prisma.cohort.findMany()]);
  const activeCohort = cohorts.find((c) => c.isActive) ?? null;

  // 기수 defaults to the currently active cohort so 모든 업무 doesn't surface
  // long-finished cohorts by default; "all" (전체 기수) explicitly shows every one.
  const defaultCohort = activeCohort?.id ?? "all";
  const selectedCohort = cohortParam || defaultCohort;

  // 기수 dropdown: cohorts that have any task, plus the active one.
  const cohortsWithTasks = new Set(tasks.map((a) => a.intern.cohortId).filter(Boolean));
  const cohortOptions = cohorts
    .filter((c) => cohortsWithTasks.has(c.id) || c.isActive)
    .map((c) => ({ id: c.id, label: c.label }))
    .sort((a, b) => b.label.localeCompare(a.label, "ko"));

  // 인턴 / 본부 options reflect the selected 기수 so the dropdowns stay coherent.
  const scopeTasks =
    selectedCohort === "all" ? tasks : tasks.filter((a) => a.intern.cohortId === selectedCohort);
  const internOptions = [...new Map(scopeTasks.map((a) => [a.intern.id, a.intern.name]))]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const teamOptions = [...new Set(scopeTasks.flatMap((a) => a.intern.teams))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const filtered = tasks.filter((a) => {
    if (selectedCohort !== "all" && a.intern.cohortId !== selectedCohort) return false;
    if (internFilter && a.intern.id !== internFilter) return false;
    if (teamFilter && !a.intern.teams.includes(teamFilter)) return false;
    return true;
  });
  const activeTasks = filtered.filter((a) => a.status !== "COMPLETED");
  const doneTasks = filtered
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  // 필터 초기화 appears whenever the view differs from the default (active 기수,
  // no other filters); resetting clears the params back to that default.
  const atDefault =
    (cohortParam === "" || cohortParam === defaultCohort) && !internFilter && !teamFilter;

  // Links carry ?back=<this filtered view> so a detail page's back link returns
  // here — to the same filtered list, not to some default.
  const backQs = new URLSearchParams();
  if (cohortParam) backQs.set("cohort", cohortParam);
  if (internFilter) backQs.set("intern", internFilter);
  if (teamFilter) backQs.set("team", teamFilter);
  const qs = backQs.toString();
  const backHere = `/projects${qs ? `?${qs}` : ""}`;
  const withBack = (path: string) => `${path}?back=${encodeURIComponent(backHere)}`;

  function taskRow(a: TaskRow, done: boolean) {
    const ended = isEnded(a.intern.endDate);
    const dday = done || ended ? null : ddayInfo(a.expectedDoneDate);
    return (
      <div key={a.id} className={`alltask-row${done ? " done" : ""}`}>
        <div className="alltask-main">
          <Link href={withBack(`/tasks/${a.id}`)} className="alltask-title">
            {done && <span className="done-pill">{t("완료")}</span>}
            {dday && (
              <span className={`dday${dday.overdue ? " overdue" : dday.soon ? " soon" : ""}`}>
                {dday.label}
              </span>
            )}
            {a.title}
          </Link>
          <div className="alltask-sub">
            <Link href={withBack(`/interns/${a.intern.id}`)} className="alltask-intern">
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
          {done
            ? a.completedAt
              ? ` · ${t("완료")} ${fmtShort(a.completedAt, locale)}`
              : ""
            : a.expectedDoneDate
              ? ` · ${fmtShort(a.expectedDoneDate, locale)}`
              : ""}
        </div>
      </div>
    );
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("모든 업무")}
      </h1>
      <p className="page-sub">{t("진행 중인 업무와 완료된 업무를 담당 인턴과 함께 한눈에 볼 수 있어요.")}</p>

      {tasks.length === 0 ? (
        <div className="card card-pad empty">{t("아직 등록된 업무가 없습니다.")}</div>
      ) : (
        <>
          <TaskFilters
            cohorts={cohortOptions}
            interns={internOptions}
            teams={teamOptions}
            selectedCohort={selectedCohort}
            selectedIntern={internFilter}
            selectedTeam={teamFilter}
            showReset={!atDefault}
          />

          <h2 className="section-title">
            {t("진행 중인 업무")} <span className="muted">{activeTasks.length}</span>
          </h2>
          {activeTasks.length === 0 ? (
            <div className="card card-pad empty">{t("조건에 맞는 진행 중인 업무가 없습니다.")}</div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {activeTasks.map((a) => taskRow(a, false))}
            </div>
          )}

          <h2 className="section-title" style={{ marginTop: 28 }}>
            {t("완료된 업무")} <span className="muted">{doneTasks.length}</span>
          </h2>
          {doneTasks.length === 0 ? (
            <div className="card card-pad empty">{t("완료된 업무가 없습니다.")}</div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
              {doneTasks.map((a) => taskRow(a, true))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
