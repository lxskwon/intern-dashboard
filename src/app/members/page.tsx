import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isAdminOrBoss } from "@/lib/permissions";
import { getT } from "@/lib/i18n-server";
import { isEnded } from "@/lib/format";
import { setUserTierAction, setWithdrawnAction, setInternLeadAction } from "@/lib/actions";
import { HelpTip } from "@/components/HelpTip";
import { MembersFilter } from "@/components/MembersFilter";

export const dynamic = "force-dynamic";

/** Admin-only 구성원 관리 — change a 직원↔관리자 tier and mark/restore 탈퇴. */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminOrBoss(user)) redirect("/");
  const t = await getT();
  const team = ((await searchParams).team ?? "").trim();

  const members = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      kind: true,
      role: true,
      teams: true,
      withdrawnAt: true,
      internLead: true,
      endDate: true,
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  const staff = members.filter((m) => m.kind === "STAFF");
  const interns = members.filter((m) => m.kind === "INTERN");

  // 본부 filter — narrows the stats and both lists to one division.
  const allTeams = [...new Set(members.flatMap((m) => m.teams))].sort((a, b) => a.localeCompare(b, "ko"));
  const inTeam = (m: (typeof members)[number]) => !team || m.teams.includes(team);
  const shownStaff = staff.filter(inTeam);
  const shownInterns = interns.filter(inTeam);

  // Work out which staff currently count as 멘토 (≥1 active assigned intern) so
  // the tier tally and row labels distinguish 직원 vs 멘토 — done in-memory to
  // avoid a query per staff member.
  const allInterns = await prisma.user.findMany({
    where: { kind: "INTERN" },
    select: { name: true, mentorNames: true, endDate: true, withdrawnAt: true },
  });
  // "Active" = not withdrawn and internship not yet ended.
  const activeInterns = allInterns.filter((i) => !i.withdrawnAt && !isEnded(i.endDate));
  const claims = await prisma.mentorMentee.findMany({ select: { mentorId: true, internName: true } });
  const activeInternNames = new Set(activeInterns.map((i) => i.name.toLowerCase()));
  const mentorNamesReferenced = new Set(
    activeInterns.flatMap((i) => i.mentorNames.map((m) => m.toLowerCase()))
  );
  const activeClaimMentorIds = new Set(
    claims.filter((c) => activeInternNames.has(c.internName.toLowerCase())).map((c) => c.mentorId)
  );
  const isMentorStaff = (m: (typeof members)[number]) =>
    m.role === "STAFF" &&
    (mentorNamesReferenced.has(m.name.toLowerCase()) || activeClaimMentorIds.has(m.id));

  const tierLabel = (m: (typeof members)[number]) =>
    m.role === "BOSS"
      ? t("대표님")
      : m.role === "ADMIN"
        ? t("관리자")
        : isMentorStaff(m)
          ? t("멘토")
          : t("직원");

  // 등급별 직원 수 — 대표님 is the same tier as 관리자, and 멘토 is just a 직원
  // with an assigned intern, so the tally is simply 관리자 / 직원 / 탈퇴.
  const activeStaff = shownStaff.filter((m) => !m.withdrawnAt);
  const counts = {
    관리자: activeStaff.filter((m) => m.role === "ADMIN" || m.role === "BOSS").length,
    직원: activeStaff.filter((m) => m.role === "STAFF").length,
    탈퇴: shownStaff.filter((m) => !!m.withdrawnAt).length,
  };
  const statOrder: { key: keyof typeof counts; muted?: boolean }[] = [
    { key: "관리자" },
    { key: "직원" },
    { key: "탈퇴", muted: true },
  ];

  const StatusControls = ({ m }: { m: (typeof members)[number] }) => {
    const isSelf = m.id === user.id;
    const isBossRow = m.role === "BOSS";
    // Interns don't 탈퇴 — they simply end their internship (which then limits
    // them to their card + 기수). A finished intern shows 인턴 종료 (no toggle);
    // otherwise admins can toggle 인턴 대표.
    if (m.kind === "INTERN") {
      if (isEnded(m.endDate)) {
        return <span className="ended-tag">{t("인턴 종료")}</span>;
      }
      return (
        <span className="inline" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <form action={setInternLeadAction}>
            <input type="hidden" name="userId" value={m.id} />
            <input type="hidden" name="lead" value={m.internLead ? "0" : "1"} />
            <button type="submit" className={m.internLead ? "btn btn-sm btn-danger" : "btn btn-sm"}>
              {m.internLead ? t("인턴 대표 해제") : t("인턴 대표 지정")}
            </button>
          </form>
        </span>
      );
    }
    return (
      <span className="inline" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {m.withdrawnAt && <span className="withdrawn-tag">{t("탈퇴")}</span>}
        {!isBossRow && (
          <form action={setUserTierAction}>
            <input type="hidden" name="userId" value={m.id} />
            <input type="hidden" name="tier" value={m.role === "ADMIN" ? "STAFF" : "ADMIN"} />
            <button type="submit" className="btn btn-sm">
              {m.role === "ADMIN" ? t("직원으로 변경") : t("관리자로 승격")}
            </button>
          </form>
        )}
        {!isBossRow && !isSelf && (
          <form action={setWithdrawnAction}>
            <input type="hidden" name="userId" value={m.id} />
            <input type="hidden" name="withdraw" value={m.withdrawnAt ? "0" : "1"} />
            <button
              type="submit"
              className={m.withdrawnAt ? "btn btn-sm" : "btn btn-sm btn-danger"}
            >
              {m.withdrawnAt ? t("복구") : t("탈퇴 처리")}
            </button>
          </form>
        )}
      </span>
    );
  };

  const Row = ({ m }: { m: (typeof members)[number] }) => {
    const internEnded = m.kind === "INTERN" && isEnded(m.endDate);
    return (
    <div className={`member-row${m.withdrawnAt ? " is-withdrawn" : ""}${internEnded ? " is-ended" : ""}`}>
      <div className="mentee-info" style={{ minWidth: 0 }}>
        <span className="mentee-name">
          <Link
            href={`${m.kind === "INTERN" ? `/interns/${m.id}` : `/staff/${m.id}`}?back=${encodeURIComponent("/members")}`}
          >
            {m.name}
          </Link>
          <span className="role-pill" style={{ marginLeft: 8 }}>
            {m.kind === "INTERN"
              ? m.internLead && !internEnded
                ? t("인턴 대표")
                : t("인턴")
              : tierLabel(m)}
          </span>
        </span>
        <span className="meta-line">
          {m.email}
          {m.teams.length > 0 ? ` · ${m.teams.join(" · ")}` : ""}
        </span>
      </div>
      <StatusControls m={m} />
    </div>
    );
  };

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("구성원 관리")}
      </h1>
      <p className="page-sub">
        {t("직원의 권한(직원 ↔ 관리자)을 변경하거나, 퇴사한 구성원을 탈퇴 처리할 수 있어요.")}
      </p>

      {allTeams.length > 0 && <MembersFilter teams={allTeams} selected={team} />}

      <div className="card card-pad section">
        <h2 className="section-title">
          {t("직원 현황")}
          {team ? <span className="muted" style={{ fontWeight: 500 }}> · {team}</span> : null}
        </h2>
        <div className="stat-row">
          {statOrder.map(({ key, muted }) => (
            <div key={key} className={`stat-box${muted ? " muted" : ""}`}>
              <span className="stat-num">{counts[key]}</span>
              <span className="stat-label">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad section">
        <h2 className="section-title">
          {t("직원 ({n})", { n: shownStaff.length })}{" "}
          <HelpTip
            text={t(
              "‘관리자로 승격’하면 배정 관리·인턴 정보 편집·구성원 관리 권한이 추가로 생겨요. (전체 요청·기수 관리는 직원도 가능)"
            )}
          />
        </h2>
        <div className="member-list">
          {shownStaff.length === 0 ? (
            <div className="empty">{t("해당 본부에 직원이 없습니다.")}</div>
          ) : (
            shownStaff.map((m) => <Row key={m.id} m={m} />)
          )}
        </div>
      </div>

      <div className="card card-pad section">
        <h2 className="section-title">{t("인턴 ({n})", { n: shownInterns.length })}</h2>
        <div className="member-list">
          {shownInterns.length === 0 ? (
            <div className="empty">{t("해당 본부에 인턴이 없습니다.")}</div>
          ) : (
            shownInterns.map((m) => <Row key={m.id} m={m} />)
          )}
        </div>
      </div>
    </main>
  );
}
