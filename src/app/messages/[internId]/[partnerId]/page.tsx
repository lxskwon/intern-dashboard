import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { MessageForm } from "@/components/MessageForm";
import { MarkRead } from "@/components/MarkRead";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ internId: string; partnerId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { internId, partnerId } = await params;
  // Only the two participants may view a private conversation.
  if (user.id !== internId && user.id !== partnerId) notFound();

  const intern = await prisma.user.findUnique({ where: { id: internId } });
  if (!intern || intern.kind !== "INTERN") notFound();

  const [partner, messages] = await Promise.all([
    prisma.user.findUnique({ where: { id: partnerId }, select: { name: true, kind: true } }),
    prisma.message.findMany({ where: { internId, partnerId }, orderBy: { createdAt: "asc" } }),
  ]);

  // Messaging is only between a mentor and an intern — the partner side must be a mentor.
  if (!partner || partner.kind !== "STAFF") notFound();

  const partnerName = partner?.name ?? messages[0]?.partnerName ?? "상대방";
  const iAmIntern = user.id === internId;
  const otherName = iAmIntern ? partnerName : intern.name;

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <MarkRead internId={internId} partnerId={partnerId} />
      <p style={{ marginTop: 0 }}>
        <Link href="/messages">← 메시지 목록</Link>
      </p>

      <div className="card card-pad">
        <h1 className="page-title" style={{ margin: 0 }}>
          {otherName}
        </h1>
        {!iAmIntern && <p className="page-sub" style={{ margin: "2px 0 16px" }}>{intern.name} 인턴</p>}

        <div className="msg-list" style={{ marginTop: iAmIntern ? 16 : 0, marginBottom: 14 }}>
          {messages.length === 0 ? (
            <div className="empty">아직 메시지가 없습니다. 먼저 인사를 건네보세요.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg-bubble${m.authorId === user.id ? " mine" : ""}`}>
                {m.body}
              </div>
            ))
          )}
        </div>

        <MessageForm
          internId={internId}
          partnerId={partnerId}
          partnerName={partnerName}
          placeholder={`${otherName}님에게 메시지…`}
        />
      </div>
    </main>
  );
}
