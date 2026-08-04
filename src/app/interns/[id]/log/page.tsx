import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { getT, getLocale } from "@/lib/i18n-server";
import { fmtDate as fmtDateI, toDateInput } from "@/lib/format";
import { TaskEntryForm } from "@/app/tasks/[id]/TaskEntryForm";
import { JournalEntry } from "@/app/tasks/[id]/JournalEntry";

export const dynamic = "force-dynamic";

/** Full list of an intern's work-log entries (the card shows only the latest few). */
export default async function InternLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getViewer();
  if (!user) redirect("/login");
  const t = await getT();
  const locale = await getLocale();
  const fmtDate = (d: Date | string | null | undefined) => fmtDateI(d, locale);

  const { id } = await params;
  const intern = await prisma.user.findUnique({
    where: { id },
    include: {
      assignments: {
        select: { id: true, title: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
      logEntries: {
        include: {
          attachments: { select: { id: true, kind: true, url: true, name: true } },
          assignment: { select: { id: true, title: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!intern || intern.kind !== "INTERN") notFound();

  const mine = canEdit(user, intern.id);
  const taskOptions = intern.assignments.map((a) => ({ id: a.id, title: a.title }));

  // Group the log entries by entry date (newest first).
  const logGroups: { key: string; date: Date; entries: typeof intern.logEntries }[] = [];
  for (const e of intern.logEntries) {
    const key = toDateInput(e.entryDate);
    const last = logGroups[logGroups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else logGroups.push({ key, date: e.entryDate, entries: [e] });
  }

  return (
    <main className="container">
      <p style={{ marginTop: 0 }}>
        <Link href={`/interns/${intern.id}`}>← {t("카드로 돌아가기")}</Link>
      </p>

      <div className="card card-pad section">
        <div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t("{name} · 기록 ({n})", { name: intern.name, n: intern.logEntries.length })}
          </h1>
          {mine && (
            <Link href={`/interns/${intern.id}/report`} className="btn btn-sm">
              🖨️ {t("보고서 출력")}
            </Link>
          )}
        </div>

        {mine && (
          <details style={{ margin: "14px 0" }}>
            <summary className="btn btn-sm btn-primary" style={{ display: "inline-block" }}>
              + {t("기록 추가")}
            </summary>
            <div style={{ marginTop: 14 }}>
              <TaskEntryForm
                internId={intern.id}
                tasks={taskOptions}
                today={toDateInput(new Date())}
              />
            </div>
          </details>
        )}

        {logGroups.length === 0 ? (
          <div className="empty" style={{ marginTop: 14 }}>{t("아직 기록이 없습니다.")}</div>
        ) : (
          logGroups.map((g) => (
            <div key={g.key} className="journal-day">
              <div className="journal-date">{fmtDate(g.date)}</div>
              {g.entries.map((e) => (
                <JournalEntry
                  key={e.id}
                  mine={mine}
                  tasks={taskOptions}
                  entry={{
                    id: e.id,
                    entryDate: toDateInput(e.entryDate),
                    body: e.body,
                    attachments: e.attachments,
                    assignmentId: e.assignmentId,
                    taskTitle: e.assignment?.title ?? null,
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
