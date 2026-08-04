import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { fmtDate as fmtDateI } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const locale = await getLocale();
  const fmtDate = (d: Date | string | null | undefined) => fmtDateI(d, locale);

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
    const thread =
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
    thread.last = m.body;
    thread.lastAt = m.createdAt;
    if (m.authorId !== user.id && m.readAt === null) thread.unread += 1;
    map.set(key, thread);
  }
  const threads = [...map.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        {t("개인 메시지")}
      </h1>
      <p className="page-sub">{t("나와 관련된 비공개 대화입니다.")}</p>

      {threads.length === 0 ? (
        <div className="card card-pad empty">{t("주고받은 메시지가 없습니다.")}</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {threads.map((thread) => (
            <Link key={thread.key} href={`/messages/${thread.internId}/${thread.partnerId}`} className="inbox-row">
              <div className="inbox-main">
                <div className="inbox-name">
                  {thread.otherName}
                  {user.id !== thread.internId && (
                    <span className="inbox-context"> · {t("{name} 카드", { name: thread.internName })}</span>
                  )}
                </div>
                <div className="inbox-last">{thread.last}</div>
              </div>
              <div className="inbox-side">
                <span className="inbox-date">{fmtDate(thread.lastAt)}</span>
                {thread.unread > 0 && <span className="notif-badge static">{thread.unread}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
