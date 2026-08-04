import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { getT, getLocale } from "@/lib/i18n-server";
import { computeWorkStatus, todayAdjustBounds, TEAMS } from "@/lib/constants";
import { isEnded, isCurrentlyAway, STALE_DAYS, ddayInfo, fmtShort, seoulTodayUTCDate } from "@/lib/format";
import { isAdminOrBoss, isInternLead } from "@/lib/permissions";
import { Filters } from "@/components/Filters";
import { ViewToggle } from "@/components/ViewToggle";
import { InternCard, type CardIntern } from "@/components/InternCard";
import { AdminAttention } from "@/components/AdminAttention";
import { AnnouncementButton } from "@/components/AnnouncementButton";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function statusKey(i: CardIntern): string {
  if (i.ended) return "ENDED";
  if (i.away) return "AWAY";
  return computeWorkStatus(i.schedules, i.bounds, i.check);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");
  const isAdmin = !user.isGuest && user.kind === "STAFF";
  const t = await getT();

  const sp = await searchParams;
  const q = one(sp.q).trim();
  const status = one(sp.status);
  const team = one(sp.team);
  const mentor = one(sp.mentor);
  const view = one(sp.view) === "list" ? "list" : "grid";

  // Cohorts (기수): the dashboard defaults to the active cohort; the filter can
  // switch to another cohort or "전체 기수" (all cohorts).
  const TERM_ORDER: Record<string, number> = { 봄: 1, 여름: 2, 가을: 3, 겨울: 4 };
  const cohorts = (await prisma.cohort.findMany()).sort(
    (a, b) => b.year - a.year || (TERM_ORDER[b.term] ?? 0) - (TERM_ORDER[a.term] ?? 0)
  );
  const activeCohort = cohorts.find((c) => c.isActive) ?? null;
  const cohortParam = one(sp.cohort);
  // Frozen (ended) interns are locked to their own 기수 — they can't switch
  // cohorts or see "전체 기수".
  const frozen = isFrozenIntern(user);
  const selectedCohort =
    frozen && !user.isGuest
      ? user.cohortId ?? "none"
      : cohortParam || activeCohort?.id || "all";

  const where: Prisma.UserWhereInput = { kind: "INTERN" };
  if (selectedCohort !== "all") where.cohortId = selectedCohort;
  if (q) where.name = { contains: q };
  if (team) where.teams = { has: team };
  if (mentor) where.mentorNames = { has: mentor };

  const [rows, mentorRows, teamRows, claims] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        cohort: { select: { label: true } },
        unavailabilities: {
          select: {
            startDate: true,
            endDate: true,
            status: true,
            kind: true,
            adjustType: true,
            adjustTime: true,
          },
        },
        workSchedules: { select: { days: true, startTime: true, endTime: true } },
        assignments: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { entries: true } },
            entries: { orderBy: { entryDate: "desc" }, take: 1, select: { entryDate: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { kind: "INTERN" },
      select: { mentorNames: true },
    }),
    prisma.user.findMany({
      where: { kind: "INTERN" },
      select: { teams: true },
    }),
    prisma.mentorMentee.findMany({ include: { mentor: { select: { name: true } } } }),
  ]);

  // Today's manual check-ins (drive 근무중 / 퇴근), keyed by intern id.
  const checkRows = await prisma.checkIn.findMany({
    where: { date: seoulTodayUTCDate() },
    select: { userId: true, inAt: true, outAt: true },
  });
  const checkMap = new Map(checkRows.map((c) => [c.userId, { inAt: c.inAt, outAt: c.outAt }]));

  // Announcements the current viewer should see (admins see all, to manage).
  // Frozen interns get no new updates, so no announcements.
  const announcementRows =
    user.isGuest || frozen
      ? []
      : await prisma.announcement.findMany({
          orderBy: { createdAt: "desc" },
          include: { attachments: { select: { id: true, kind: true, url: true, name: true } } },
        });

  // Map intern name → mentor names, for interns a mentor registered by name.
  const claimMap = new Map<string, string[]>();
  for (const c of claims) {
    const key = c.internName.toLowerCase();
    const arr = claimMap.get(key) ?? [];
    if (!arr.some((m) => m.toLowerCase() === c.mentor.name.toLowerCase())) arr.push(c.mentor.name);
    claimMap.set(key, arr);
  }

  const now = Date.now();
  const cards: CardIntern[] = rows.map((i) => {
    const ended = isEnded(i.endDate);
    // Combine mentors the intern listed with any mentor who claimed them by name.
    const claimed = claimMap.get(i.name.toLowerCase()) ?? [];
    const mentors = [...i.mentorNames];
    for (const m of claimed) if (!mentors.some((x) => x.toLowerCase() === m.toLowerCase())) mentors.push(m);
    return {
      id: i.id,
      name: i.name,
      teams: i.teams,
      photoUrl: i.photoUrl,
      startDate: i.startDate,
      endDate: i.endDate,
      schedules: i.workSchedules,
      bounds: todayAdjustBounds(i.unavailabilities),
      check: checkMap.get(i.id) ?? null,
      mentorName: mentors.length ? mentors.join(", ") : null,
      adminNote: isAdmin ? i.adminNote ?? null : null,
      // Only surface the cohort on the card when viewing all cohorts — otherwise
      // it's redundant with the active filter.
      cohortLabel: selectedCohort === "all" ? i.cohort?.label ?? null : null,
      ended,
      withdrawn: !!i.withdrawnAt,
      internLead: i.internLead,
      away: !ended && isCurrentlyAway(i.unavailabilities.filter((u) => u.kind !== "ADJUST")),
      tasks: i.assignments.map((a) => {
        // A task is "stale" if there's been no journal entry for STALE_DAYS,
        // measured from its last entry (or its creation if never journaled).
        const lastEntry = a.entries[0]?.entryDate ?? null;
        const ref = lastEntry ?? a.createdAt;
        const days = Math.floor((now - new Date(ref).getTime()) / 86_400_000);
        return {
          id: a.id,
          title: a.title,
          entryCount: a._count.entries,
          lastEntry,
          stale: !ended && days >= STALE_DAYS,
          dday: ended ? null : ddayInfo(a.expectedDoneDate),
        };
      }),
    };
  });

  const filtered = status ? cards.filter((c) => statusKey(c) === status) : cards;

  filtered.sort((a, b) => {
    if (a.ended !== b.ended) return a.ended ? 1 : -1;
    return a.name.localeCompare(b.name, "ko");
  });

  // Admin "needs attention" lists (over the interns currently in view): those
  // with no mentor, and those ending within a week.
  const isAdminTier = isAdminOrBoss(user);
  const isLead = isInternLead(user) && !frozen; // 인턴 대표 (interns-only 공지)
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const activeCards = cards.filter((c) => !c.ended && !c.withdrawn);
  const unassigned = isAdminTier ? activeCards.filter((c) => !c.mentorName) : [];
  const endingSoon = isAdminTier
    ? activeCards.filter((c) => c.endDate && new Date(c.endDate) <= in7)
    : [];

  // 인턴 대표: nag admins if one was designated before but none is active now
  // (e.g. the rep's internship ended). Computed globally, across all cohorts.
  let leadMissing = false;
  if (isAdminTier) {
    const leadRows = await prisma.user.findMany({
      where: { kind: "INTERN", internLead: true },
      select: { endDate: true, withdrawnAt: true },
    });
    const hasActiveLead = leadRows.some((l) => !l.withdrawnAt && !isEnded(l.endDate));
    leadMissing = leadRows.length > 0 && !hasActiveLead;
  }

  const teams = [...new Set(teamRows.flatMap((r) => r.teams))].sort((a, b) => a.localeCompare(b, "ko"));
  const mentorSet = new Set<string>();
  for (const r of mentorRows) for (const m of r.mentorNames) mentorSet.add(m);
  const mentorNames = [...mentorSet].sort((a, b) => a.localeCompare(b, "ko"));

  // Announcements: everyone sees ones targeted at them; admins see all (to manage).
  const locale = await getLocale();
  const matchesViewer = (a: (typeof announcementRows)[number]) => {
    if (user.isGuest) return false;
    if (a.audience === "ALL") return true;
    if (a.audience === "STAFF") return user.kind === "STAFF";
    if (a.audience === "INTERN") return user.kind === "INTERN";
    if (a.audience === "TEAM") return !!a.team && user.teams.includes(a.team);
    return false;
  };
  const announcements = announcementRows.filter((a) => isAdminTier || matchesViewer(a));
  const audienceLabel = (a: (typeof announcementRows)[number]) =>
    a.audience === "STAFF"
      ? t("직원")
      : a.audience === "INTERN"
        ? t("인턴")
        : a.audience === "TEAM"
          ? a.team ?? ""
          : t("전체");

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="dash-title">{t("스파크랩 펠로우십 대시보드")}</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {t("누가 무엇을 하고 있고, 지금 누가 근무중인지 한눈에.")}
          </p>
        </div>
        <div className="page-head-actions">
          {isAdminTier ? (
            <AnnouncementButton teams={[...TEAMS]} />
          ) : isLead ? (
            <AnnouncementButton teams={[...TEAMS]} internOnly />
          ) : null}
          <ViewToggle view={view} />
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="announce-list">
          {announcements.map((a) => (
            <AnnouncementBanner
              key={a.id}
              a={{
                id: a.id,
                body: a.body,
                audience: a.audience,
                team: a.team,
                authorName: a.authorName,
                attachments: a.attachments,
              }}
              isAdmin={isAdminTier}
              canManage={isAdminTier || (isLead && !user.isGuest && a.authorName === user.name)}
              internOnly={!isAdminTier}
              audienceLabel={audienceLabel(a)}
              dateStr={fmtShort(a.createdAt, locale)}
              teams={[...TEAMS]}
            />
          ))}
        </div>
      )}

      {isAdminTier && (
        <AdminAttention
          unassigned={unassigned.map((c) => ({ id: c.id, name: c.name }))}
          endingSoon={endingSoon.map((c) => ({ id: c.id, name: c.name, endDate: c.endDate }))}
          leadMissing={leadMissing}
        />
      )}

      <Filters
        teams={teams}
        mentorNames={mentorNames}
        cohorts={frozen ? [] : cohorts.map((c) => ({ id: c.id, label: c.label }))}
        selectedCohort={selectedCohort}
      />

      {filtered.length === 0 ? (
        <div className="card card-pad empty">
          {cards.length === 0
            ? t("아직 등록된 인턴이 없습니다. 가입하면 여기에 카드가 표시됩니다.")
            : t("조건에 맞는 인턴이 없습니다.")}
        </div>
      ) : view === "list" ? (
        <div className="list-view">
          {filtered.map((intern) => (
            <InternCard key={intern.id} intern={intern} variant="list" />
          ))}
        </div>
      ) : (
        <div className="grid">
          {filtered.map((intern) => (
            <InternCard key={intern.id} intern={intern} variant="grid" />
          ))}
        </div>
      )}
    </main>
  );
}
