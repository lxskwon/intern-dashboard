import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { dateKeyUTC, ymdUTC, dayKey } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ym = (y: number, m0: number) => `${y}-${pad(m0 + 1)}`;

type Ev = { kind: "start" | "end" | "away"; label: string };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const monthParam = one(sp.month);
  // "Today" in Korea time (Vercel servers run in UTC).
  const seoul = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const sv = (t: string) => Number(seoul.find((p) => p.type === t)?.value ?? "0");
  const now = { year: sv("year"), month0: sv("month") - 1, date: sv("day") };
  let year = now.year;
  let month0 = now.month0;
  if (/^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month0 = m - 1;
  }

  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leading = first.getDay();

  const [interns, unavail] = await Promise.all([
    prisma.user.findMany({
      where: { kind: "INTERN" },
      select: { name: true, startDate: true, endDate: true },
    }),
    prisma.unavailability.findMany({
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Build a per-day event map for this month.
  const events: Record<number, Ev[]> = {};
  const add = (day: number, ev: Ev) => {
    (events[day] ??= []).push(ev);
  };

  for (const i of interns) {
    if (i.startDate) {
      const { year: y, month0: m, day } = ymdUTC(i.startDate);
      if (y === year && m === month0) add(day, { kind: "start", label: `${i.name} 시작` });
    }
    if (i.endDate) {
      const { year: y, month0: m, day } = ymdUTC(i.endDate);
      if (y === year && m === month0) add(day, { kind: "end", label: `${i.name} 종료` });
    }
  }
  for (const u of unavail) {
    const sKey = dateKeyUTC(u.startDate);
    const eKey = dateKeyUTC(u.endDate);
    for (let d = 1; d <= daysInMonth; d++) {
      const k = dayKey(year, month0, d);
      if (sKey <= k && k <= eKey) {
        add(d, {
          kind: "away",
          label: `${u.user.name} 부재${u.reason ? ` (${u.reason})` : ""}`,
        });
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month0 === 0 ? ym(year - 1, 11) : ym(year, month0 - 1);
  const next = month0 === 11 ? ym(year + 1, 0) : ym(year, month0 + 1);
  const isThisMonth = year === now.year && month0 === now.month0;

  return (
    <main className="container">
      <div className="cal-head">
        <h1 className="page-title" style={{ margin: 0 }}>
          {year}년 {month0 + 1}월
        </h1>
        <div className="inline">
          <Link className="btn btn-sm" href={`/calendar?month=${prev}`}>
            ← 이전
          </Link>
          <Link className="btn btn-sm" href="/calendar">
            오늘
          </Link>
          <Link className="btn btn-sm" href={`/calendar?month=${next}`}>
            다음 →
          </Link>
        </div>
      </div>

      <div className="cal-legend">
        <span className="dot-legend start">인턴 시작</span>
        <span className="dot-legend end">인턴 종료</span>
        <span className="dot-legend away">부재중</span>
      </div>

      <div className="card cal-grid">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          const isToday = isThisMonth && day === now.date;
          const dayEvents = day ? events[day] ?? [] : [];
          return (
            <div key={idx} className={`cal-cell${day ? "" : " empty"}${isToday ? " today" : ""}`}>
              {day && (
                <>
                  <div className="cal-daynum">{day}</div>
                  <div className="cal-events">
                    {dayEvents.map((ev, i) => (
                      <span key={i} className={`cal-ev ${ev.kind}`} title={ev.label}>
                        {ev.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
