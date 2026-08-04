import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isAdminOrBoss } from "@/lib/permissions";
import { getT } from "@/lib/i18n-server";
import { CohortForm } from "@/components/CohortForm";
import { EndCohortButton } from "@/components/EndCohortButton";
import { setActiveCohortAction, deleteCohortAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Cohort (기수) management — admins add/activate/delete cohorts here. */
export default async function CohortsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminOrBoss(user)) redirect("/");
  const t = await getT();

  const TERM_ORDER: Record<string, number> = { 봄: 1, 여름: 2, 가을: 3, 겨울: 4 };
  const cohorts = (
    await prisma.cohort.findMany({
      include: {
        _count: { select: { interns: true } },
        interns: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
    })
  ).sort((a, b) => b.year - a.year || (TERM_ORDER[b.term] ?? 0) - (TERM_ORDER[a.term] ?? 0));

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("기수 관리")}
      </h1>
      <p className="page-sub">
        {t("새 기수를 추가하면 그 기수가 활성화되고, 이후 가입하는 인턴은 자동으로 이 기수에 속합니다.")}
      </p>

      <div className="card card-pad section">
        {cohorts.length > 0 && (
          <div className="cohort-list">
            {cohorts.map((c) => (
              <details key={c.id} className="cohort-item">
                <summary className="cohort-summary">
                  <span className="mentee-info">
                    <span className="mentee-name">
                      {c.label}
                      {c.isActive && <span className="cohort-active"> · {t("활성")}</span>}
                    </span>
                    <span className="meta-line">{t("인턴 {n}명", { n: c._count.interns })}</span>
                  </span>
                  <span className="inline" style={{ gap: 8, alignItems: "center" }}>
                    {c.isActive && <EndCohortButton cohortId={c.id} />}
                    <span className="cohort-chevron" aria-hidden="true">▾</span>
                  </span>
                </summary>
                <div className="cohort-body">
                  {c.interns.length > 0 ? (
                    <div className="cohort-members">
                      {c.interns.map((i) => (
                        <Link key={i.id} href={`/interns/${i.id}`} className="cohort-member">
                          {i.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">{t("아직 인턴이 없습니다.")}</div>
                  )}
                  {!c.isActive && (
                    <div className="inline" style={{ gap: 6, marginTop: 12 }}>
                      <form action={setActiveCohortAction}>
                        <input type="hidden" name="cohortId" value={c.id} />
                        <button type="submit" className="btn btn-sm">{t("활성화")}</button>
                      </form>
                      {c._count.interns === 0 && (
                        <form action={deleteCohortAction}>
                          <input type="hidden" name="cohortId" value={c.id} />
                          <button type="submit" className="btn btn-sm btn-danger">{t("삭제")}</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <CohortForm />
        </div>
      </div>
    </main>
  );
}
