import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasActiveMentees } from "@/lib/session";
import { isStaff, isAdminOrBoss, roleLabel } from "@/lib/permissions";
import { getT } from "@/lib/i18n-server";
import { resolveBack } from "@/lib/backlink";
import { isEnded, isCurrentlyAway, seoulTodayUTCDate } from "@/lib/format";
import { todayAdjustBounds } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { setUserTierAction, setWithdrawnAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** A staff member's profile: tier, 본부, and their assigned interns. Admins get
 *  tier/status controls here too. Visible to any logged-in staff member. */
export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  if (!isStaff(viewer)) redirect("/");
  const { id } = await params;
  const staff = await prisma.user.findUnique({ where: { id } });
  if (!staff || staff.kind !== "STAFF") notFound();
  const t = await getT();
  const sp = await searchParams;
  const backParam = Array.isArray(sp.back) ? sp.back[0] : sp.back;
  const back = resolveBack(t, backParam, { href: "/members", label: `← ${t("구성원 관리")}` });

  const isMentor = await hasActiveMentees(staff.id, staff.name);
  const isSelf = viewer.id === staff.id;
  const canManage = isAdminOrBoss(viewer) && !isSelf && staff.role !== "BOSS";

  // Assigned interns = those who list this person, or whom this person claimed.
  const claims = await prisma.mentorMentee.findMany({
    where: { mentorId: staff.id },
    select: { internName: true },
  });
  const claimedNames = claims.map((c) => c.internName);
  const mentees = await prisma.user.findMany({
    where: {
      kind: "INTERN",
      OR: [
        { mentorNames: { has: staff.name } },
        ...(claimedNames.length ? [{ name: { in: claimedNames } }] : []),
      ],
    },
    include: {
      workSchedules: { select: { days: true, startTime: true, endTime: true } },
      unavailabilities: {
        select: { startDate: true, endDate: true, status: true, kind: true, adjustType: true, adjustTime: true },
      },
      checkIns: { where: { date: seoulTodayUTCDate() }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const active = mentees.filter((m) => !isEnded(m.endDate) && !m.withdrawnAt);
  const past = mentees.filter((m) => isEnded(m.endDate) || m.withdrawnAt);

  const heroBorder = staff.withdrawnAt ? "#9ca3af" : "#a5b4fc";
  const teamLine = staff.teams.length ? staff.teams.join(" · ") : t("본부 미지정");

  const MenteeRow = ({ m, ended }: { m: (typeof mentees)[number]; ended: boolean }) => (
    <Link href={`/interns/${m.id}`} className="mentee-row">
      <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
      <div className="mentee-info">
        <span className="mentee-name">{m.name}</span>
        <span className="meta-line">{m.teams.length ? m.teams.join(" · ") : t("본부 미지정")}</span>
      </div>
      <StatusBadge
        ended={ended}
        away={!ended && isCurrentlyAway(m.unavailabilities.filter((u) => u.kind !== "ADJUST"))}
        schedules={m.workSchedules}
        bounds={todayAdjustBounds(m.unavailabilities)}
        check={m.checkIns[0] ?? null}
      />
    </Link>
  );

  return (
    <main className="container">
      <p style={{ marginTop: 0 }}>
        <Link href={back.href}>{back.label}</Link>
      </p>

      <section className="hero" style={{ borderTop: `5px solid ${heroBorder}` }}>
        <Avatar name={staff.name} photoUrl={staff.photoUrl} size={84} />
        <div className="hero-body">
          <div className="hero-name-row">
            <h1>{staff.name}</h1>
            <span className="role-pill">{t(roleLabel(staff, isMentor))}</span>
            {staff.withdrawnAt && <span className="withdrawn-tag">{t("탈퇴")}</span>}
          </div>
          <p className="hero-sub">
            {teamLine} · {staff.email}
          </p>
          {canManage && (
            <div className="inline" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <form action={setUserTierAction}>
                <input type="hidden" name="userId" value={staff.id} />
                <input type="hidden" name="tier" value={staff.role === "ADMIN" ? "STAFF" : "ADMIN"} />
                <button type="submit" className="btn btn-sm">
                  {staff.role === "ADMIN" ? t("직원으로 변경") : t("관리자로 승격")}
                </button>
              </form>
              <form action={setWithdrawnAction}>
                <input type="hidden" name="userId" value={staff.id} />
                <input type="hidden" name="withdraw" value={staff.withdrawnAt ? "0" : "1"} />
                <button
                  type="submit"
                  className={staff.withdrawnAt ? "btn btn-sm" : "btn btn-sm btn-danger"}
                >
                  {staff.withdrawnAt ? t("복구") : t("탈퇴 처리")}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      <div className="card card-pad section">
        <h2 className="section-title">{t("담당 인턴 ({n})", { n: active.length })}</h2>
        {active.length === 0 ? (
          <div className="empty">{t("담당 인턴이 없습니다.")}</div>
        ) : (
          <div className="mentee-list">
            {active.map((m) => (
              <MenteeRow key={m.id} m={m} ended={false} />
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="card card-pad section">
          <h2 className="section-title">{t("이전 담당 인턴 ({n})", { n: past.length })}</h2>
          <div className="mentee-list">
            {past.map((m) => (
              <MenteeRow key={m.id} m={m} ended={true} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
