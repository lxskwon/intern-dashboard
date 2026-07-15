import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const msgs = await prisma.message.findMany({
    where: { OR: [{ internId: user.id }, { partnerId: user.id }] },
    include: { intern: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Group into threads keyed by (internId, partnerId).
  type Thread = {
    key: string;
    internId: string;
    partnerId: string;
    internName: string;
    otherName: string;
    last: string;
    lastAt: Date;
    unread: number;
  };
  const map = new Map<string, Thread>();
  for (const m of msgs) {
    const key = `${m.internId}|${m.partnerId}`;
    const iAmIntern = user.id === m.internId;
    const otherName = iAmIntern ? m.partnerName : m.intern.name;
    const t =
      map.get(key) ??
      ({
        key,
        internId: m.internId,
        partnerId: m.partnerId,
        internName: m.intern.name,
        otherName,
        last: "",
        lastAt: m.createdAt,
        unread: 0,
      } as Thread);
    t.last = m.body;
    t.lastAt = m.createdAt;
    if (m.authorId !== user.id && m.readAt === null) t.unread += 1;
    map.set(key, t);
  }
  const threads = [...map.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        개인 메시지
      </h1>
      <p className="page-sub">나와 관련된 비공개 대화입니다.</p>

      {threads.length === 0 ? (
        <div className="card card-pad empty">주고받은 메시지가 없습니다.</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {threads.map((t) => (
            <Link key={t.key} href={`/messages/${t.internId}/${t.partnerId}`} className="inbox-row">
              <div className="inbox-main">
                <div className="inbox-name">
                  {t.otherName}
                  {user.id !== t.internId && (
                    <span className="inbox-context"> · {t.internName} 카드</span>
                  )}
                </div>
                <div className="inbox-last">{t.last}</div>
              </div>
              <div className="inbox-side">
                <span className="inbox-date">{fmtDate(t.lastAt)}</span>
                {t.unread > 0 && <span className="notif-badge static">{t.unread}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
