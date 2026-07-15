import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { seoulDateKey, todayKey, dateKeyUTC } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { AttachmentList } from "@/components/AttachmentList";

export const dynamic = "force-dynamic";

const LIMIT = 60;

function keyLabel(key: number, today: number, yesterday: number): string {
  if (key === today) return "오늘";
  if (key === yesterday) return "어제";
  const m = Math.floor(key / 100) % 100;
  const d = key % 100;
  return `${m}월 ${d}일`;
}

export default async function ActivityPage() {
  const user = await getViewer();
  if (!user) redirect("/login");

  const entries = await prisma.taskEntry.findMany({
    include: {
      assignment: {
        select: { id: true, title: true, intern: { select: { name: true, photoUrl: true } } },
      },
      attachments: { select: { id: true, kind: true, url: true, name: true } },
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: LIMIT,
  });

  const today = todayKey();
  const yesterday = seoulDateKey(new Date(Date.now() - 86_400_000));

  // Group by the entry's own 기록일 (the date the intern assigned to it),
  // not when it was actually posted.
  const groups: { key: number; entries: typeof entries }[] = [];
  for (const e of entries) {
    const key = dateKeyUTC(e.entryDate);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, entries: [e] });
  }

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        최근 활동
      </h1>
      <p className="page-sub">인턴들이 남긴 최근 업무 기록입니다.</p>

      {entries.length === 0 ? (
        <div className="card card-pad empty">아직 활동 기록이 없습니다.</div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="feed-group">
            <div className="feed-date">{keyLabel(g.key, today, yesterday)}</div>
            <div className="card" style={{ overflow: "hidden" }}>
              {g.entries.map((e) => (
                <div key={e.id} className="feed-row">
                  <Avatar
                    name={e.assignment.intern.name}
                    photoUrl={e.assignment.intern.photoUrl}
                    size={36}
                  />
                  <div className="feed-body">
                    <div className="feed-head">
                      <strong>{e.assignment.intern.name}</strong>
                      <span className="muted"> · </span>
                      <Link href={`/tasks/${e.assignment.id}`} className="feed-task-link">
                        {e.assignment.title}
                      </Link>
                    </div>
                    {e.body && <div className="feed-text">{e.body}</div>}
                    <AttachmentList list={e.attachments} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
