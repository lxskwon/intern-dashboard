import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { seoulDateKey, todayKey, dateKeyUTC, fmtDate } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { BodyText } from "@/components/BodyText";
import { getT, getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const LIMIT = 60;

function keyLabel(
  key: number,
  today: number,
  yesterday: number,
  t: (ko: string, vars?: Record<string, string | number>) => string,
  locale: Locale
): string {
  if (key === today) return t("오늘");
  if (key === yesterday) return t("어제");
  const y = Math.floor(key / 10000);
  const m0 = (Math.floor(key / 100) % 100) - 1;
  const d = key % 100;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    month: locale === "en" ? "short" : "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m0, d)));
}

export default async function ActivityPage() {
  const user = await getViewer();
  if (!user) redirect("/login");
  if (isFrozenIntern(user)) redirect(`/interns/${user.id}`);
  const t = await getT();
  const locale = await getLocale();

  const entries = await prisma.taskEntry.findMany({
    include: {
      intern: { select: { id: true, name: true, photoUrl: true } },
      assignment: { select: { id: true, title: true } },
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
        {t("최근 활동")}
      </h1>
      <p className="page-sub">{t("인턴들이 남긴 최근 업무 기록입니다.")}</p>

      {entries.length === 0 ? (
        <div className="card card-pad empty">{t("아직 활동 기록이 없습니다.")}</div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="feed-group">
            <div className="feed-date">{keyLabel(g.key, today, yesterday, t, locale)}</div>
            <div className="card" style={{ overflow: "hidden" }}>
              {g.entries.map((e) => (
                <div key={e.id} className="feed-row">
                  <Avatar name={e.intern.name} photoUrl={e.intern.photoUrl} size={36} />
                  <div className="feed-body">
                    <div className="feed-head">
                      <Link href={`/interns/${e.intern.id}?back=${encodeURIComponent("/activity")}`} className="feed-task-link">
                        <strong>{e.intern.name}</strong>
                      </Link>
                      {e.assignment && (
                        <>
                          <span className="muted"> · </span>
                          <Link href={`/tasks/${e.assignment.id}?back=${encodeURIComponent("/activity")}`} className="feed-task-link">
                            📌 {e.assignment.title}
                          </Link>
                        </>
                      )}
                    </div>
                    {e.body && (
                      <div className="feed-text">
                        <BodyText text={e.body} />
                      </div>
                    )}
                    <AttachmentGallery
                      list={e.attachments}
                      caption={[
                        fmtDate(e.entryDate, locale),
                        e.assignment ? `📌 ${e.assignment.title}` : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    />
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
