import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAssign } from "@/lib/permissions";
import { isEnded } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { AssignForm } from "@/components/AssignForm";
import { deleteMenteeAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

type MentorTag = { name: string; claimId?: string };
type Row = { internId?: string; internName: string; mentors: MentorTag[] };

/** 대표님-only page to assign mentors ↔ interns. */
export default async function AssignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAssign(user)) redirect("/");
  const t = await getT();

  const [staff, interns, claims] = await Promise.all([
    prisma.user.findMany({
      where: { kind: "STAFF", role: { not: "BOSS" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { kind: "INTERN" },
      select: { id: true, name: true, mentorNames: true, endDate: true, withdrawnAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.mentorMentee.findMany({
      include: { mentor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build EVERY current mentor↔intern pairing, keyed by intern name — from both
  // 대표/관리자 claims AND names interns typed in themselves.
  const key = (n: string) => n.trim().toLowerCase();
  // Finished (인턴 종료) or withdrawn interns are no longer a *current* pairing —
  // their mentor name stays on the intern's card as history, but the pairing is
  // dropped from "현재 배정" and doesn't make the mentor a 멘토 anymore.
  const activeInterns = interns.filter((i) => !isEnded(i.endDate) && !i.withdrawnAt);
  const inactiveNames = new Set(
    interns.filter((i) => isEnded(i.endDate) || i.withdrawnAt).map((i) => key(i.name))
  );
  const map = new Map<string, Row>();
  for (const i of activeInterns) {
    const row: Row = map.get(key(i.name)) ?? { internName: i.name, mentors: [] };
    row.internId = i.id;
    row.internName = i.name;
    for (const m of i.mentorNames) {
      if (!row.mentors.some((x) => key(x.name) === key(m))) row.mentors.push({ name: m });
    }
    map.set(key(i.name), row);
  }
  for (const c of claims) {
    if (inactiveNames.has(key(c.internName))) continue; // skip finished/withdrawn
    const row: Row = map.get(key(c.internName)) ?? { internName: c.internName, mentors: [] };
    const existing = row.mentors.find((x) => key(x.name) === key(c.mentor.name));
    if (existing) existing.claimId = c.id; // claim → removable
    else row.mentors.push({ name: c.mentor.name, claimId: c.id });
    map.set(key(c.internName), row);
  }
  const rows = [...map.values()]
    .filter((r) => r.mentors.length > 0)
    .sort((a, b) => a.internName.localeCompare(b.internName, "ko"));

  // Current mentor names per intern id — lets the assign form warn about
  // duplicates / existing mentors before it submits.
  const assignments: Record<string, string[]> = {};
  for (const r of rows) if (r.internId) assignments[r.internId] = r.mentors.map((m) => m.name);

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("멘토·인턴 배정")}
      </h1>
      <p className="page-sub">
        {t("멘토와 인턴을 짝지어 배정합니다. 배정되면 두 사람에게 이메일로 알림이 갑니다.")}
      </p>

      <div className="card card-pad section">
        <AssignForm mentors={staff} interns={activeInterns} assignments={assignments} />
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
          {t("한 인턴에게 여러 멘토를 배정하려면, 같은 인턴을 선택해 멘토를 바꿔 다시 배정하세요.")}
        </p>
      </div>

      <div className="card card-pad section">
        <h2 className="section-title">{t("현재 배정")}</h2>
        {rows.length === 0 ? (
          <div className="empty">{t("아직 배정이 없습니다.")}</div>
        ) : (
          <div className="cohort-list">
            {rows.map((r) => (
              <div key={r.internName} className="cohort-row">
                <div className="mentee-info" style={{ width: "100%" }}>
                  {r.internId ? (
                    <Link href={`/interns/${r.internId}`} className="mentee-name">
                      {r.internName}
                    </Link>
                  ) : (
                    <span className="mentee-name">{r.internName}</span>
                  )}
                  <span className="pill-row" style={{ marginTop: 6 }}>
                    {r.mentors.map((m) => (
                      <span key={m.name} className="task-pill">
                        {m.name}
                        {m.claimId && (
                          <form action={deleteMenteeAction} style={{ display: "inline" }}>
                            <input type="hidden" name="claimId" value={m.claimId} />
                            <button type="submit" className="pill-x" aria-label={t("삭제")}>
                              ×
                            </button>
                          </form>
                        )}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 8 }}>
        <Link href="/">← {t("대시보드로 돌아가기")}</Link>
      </p>
    </main>
  );
}
