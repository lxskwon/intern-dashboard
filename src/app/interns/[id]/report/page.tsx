/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { getT, getLocale } from "@/lib/i18n-server";
import { fmtDate } from "@/lib/format";
import { PrintButton } from "./PrintButton";
import { BodyText } from "@/components/BodyText";
import { ReportPhotos } from "@/components/ReportPhotos";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const t = await getT();
  const locale = await getLocale();

  const { id } = await params;
  // The work-log report is private to the intern themselves.
  if (!canEdit(viewer, id)) notFound();

  const intern = await prisma.user.findUnique({
    where: { id },
    include: {
      cohort: { select: { label: true } },
      logEntries: {
        include: {
          attachments: { select: { id: true, kind: true, url: true, name: true } },
          assignment: { select: { title: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!intern || intern.kind !== "INTERN") notFound();

  // Resolve mentor label (listed by intern, and/or claimed by mentors).
  const mentorClaims = await prisma.mentorMentee.findMany({
    where: { internName: { equals: intern.name, mode: "insensitive" } },
    include: { mentor: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const mentorList = [...intern.mentorNames];
  for (const c of mentorClaims) {
    if (!mentorList.some((m) => m.toLowerCase() === c.mentor.name.toLowerCase())) {
      mentorList.push(c.mentor.name);
    }
  }
  const mentorLabel = mentorList.length ? mentorList.join(", ") : null;

  // Group entries by date (newest first).
  const groups: { key: string; date: Date; entries: typeof intern.logEntries }[] = [];
  for (const e of intern.logEntries) {
    const key = e.entryDate.toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, date: e.entryDate, entries: [e] });
  }

  const period =
    intern.startDate || intern.endDate
      ? `${fmtDate(intern.startDate, locale)} – ${fmtDate(intern.endDate, locale)}`
      : null;
  const generated = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="report">
      <div className="report-bar no-print">
        <Link href={`/interns/${intern.id}`}>← {t("카드로 돌아가기")}</Link>
      </div>

      <header className="report-head">
        {/* PDF/print-only letterhead — SparkLabs logo + cohort. Hidden on screen. */}
        <div className="report-pdf-head print-only">
          <img src="/sparklabs-logo.png" alt="SparkLabs" className="report-pdf-logo" />
          <div className="report-pdf-title">
            {intern.cohort?.label ? `${intern.cohort.label} ` : ""}
            {t("펠로우십")}
          </div>
        </div>
        <div className="report-title-row">
          <h1>
            {intern.name} · {t("업무 기록")}
          </h1>
          <PrintButton />
        </div>
        <div className="report-meta">
          {intern.teams.length > 0 && <span>{intern.teams.join(" · ")}</span>}
          {mentorLabel && (
            <span>
              {t("멘토")}: {mentorLabel}
            </span>
          )}
          {period && (
            <span>
              {t("인턴 기간")}: {period}
            </span>
          )}
          <span>
            {t("총 기록")}: {intern.logEntries.length}
          </span>
        </div>
        <div className="report-generated">
          {t("생성일")}: {generated}
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="empty">{t("아직 기록이 없습니다.")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="report-day">
            <h2 className="report-date">{fmtDate(g.date, locale)}</h2>
            {g.entries.map((e) => {
              const images = e.attachments.filter((a) => a.kind === "IMAGE");
              const files = e.attachments.filter((a) => a.kind !== "IMAGE");
              return (
                <div key={e.id} className="report-entry">
                  {e.assignment?.title && (
                    <div className="report-entry-task">📌 {e.assignment.title}</div>
                  )}
                  {e.body && (
                    <div className="report-entry-body">
                      <BodyText text={e.body} />
                    </div>
                  )}
                  {files.length > 0 && (
                    <div className="report-files">
                      {files.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="report-link"
                        >
                          {a.kind === "LINK" ? "🔗" : "📎"} {a.name ?? a.url}
                        </a>
                      ))}
                    </div>
                  )}
                  {images.length > 0 && <ReportPhotos images={images} />}
                </div>
              );
            })}
          </section>
        ))
      )}
    </main>
  );
}
