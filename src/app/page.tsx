import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { computeWorkStatus } from "@/lib/constants";
import { isEnded, isCurrentlyAway, STALE_DAYS, ddayInfo } from "@/lib/format";
import { Filters } from "@/components/Filters";
import { ViewToggle } from "@/components/ViewToggle";
import { InternCard, type CardIntern } from "@/components/InternCard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function statusKey(i: CardIntern): string {
  if (i.ended) return "ENDED";
  if (i.away) return "AWAY";
  return computeWorkStatus(i.schedules);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = one(sp.q).trim();
  const status = one(sp.status);
  const team = one(sp.team);
  const mentor = one(sp.mentor);
  const project = one(sp.project);
  const view = one(sp.view) === "list" ? "list" : "grid";

  const where: Prisma.UserWhereInput = { kind: "INTERN" };
  if (q) where.name = { contains: q };
  if (team) where.team = team;
  if (mentor) where.mentorName = mentor;
  if (project) where.assignments = { some: { projectId: project } };

  const [rows, mentorRows, teamRows, claims, projectRows] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        unavailabilities: { select: { startDate: true, endDate: true } },
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
      where: { kind: "INTERN", mentorName: { not: null } },
      select: { mentorName: true },
      distinct: ["mentorName"],
      orderBy: { mentorName: "asc" },
    }),
    prisma.user.findMany({
      where: { kind: "INTERN", team: { not: null } },
      select: { team: true },
      distinct: ["team"],
      orderBy: { team: "asc" },
    }),
    prisma.mentorMentee.findMany({ include: { mentor: { select: { name: true } } } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Map intern name → mentor name, for interns a mentor registered by name.
  const claimMap = new Map<string, string>();
  for (const c of claims) {
    const key = c.internName.toLowerCase();
    if (!claimMap.has(key)) claimMap.set(key, c.mentor.name);
  }

  const now = Date.now();
  const cards: CardIntern[] = rows.map((i) => {
    const ended = isEnded(i.endDate);
    return {
      id: i.id,
      name: i.name,
      team: i.team,
      photoUrl: i.photoUrl,
      startDate: i.startDate,
      endDate: i.endDate,
      schedules: i.workSchedules,
      mentorName: i.mentorName ?? claimMap.get(i.name.toLowerCase()) ?? null,
      ended,
      away: !ended && isCurrentlyAway(i.unavailabilities),
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

  const teams = teamRows.map((t) => t.team!).filter(Boolean);
  const mentorNames = mentorRows.map((m) => m.mentorName!).filter(Boolean);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="dash-title">스파크랩 2026년 여름 인턴 관리 대시보드</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            누가 무엇을 하고 있고, 지금 누가 근무중인지 한눈에.
          </p>
        </div>
        <ViewToggle view={view} />
      </div>

      <Filters teams={teams} mentorNames={mentorNames} projects={projectRows} />

      {filtered.length === 0 ? (
        <div className="card card-pad empty">
          {cards.length === 0
            ? "아직 등록된 인턴이 없습니다. 가입하면 여기에 카드가 표시됩니다."
            : "조건에 맞는 인턴이 없습니다."}
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
