import type { Metadata } from "next";
import "./globals.css";
import { getViewer, isFrozenIntern } from "@/lib/session";
import { prisma } from "@/lib/db";
import { seoulTodayUTCDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { newCommentCount, pendingApprovalCount, allPendingApprovalCount } from "@/lib/notifications";
import { LangProvider } from "@/components/LangProvider";
import { TopBar } from "@/components/TopBar";
import { HelpChat } from "@/components/HelpChat";

export const metadata: Metadata = {
  title: "스파크랩 펠로우십 대시보드",
  description: "누가 무엇을 하고 있고, 지금 누가 여유 있는지 한눈에.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  const locale = await getLocale();

  let comments = 0;
  let approvals = 0;
  let allRequests = 0;
  let internCheck: { userId: string; working: boolean; hasJournalToday: boolean } | null = null;
  if (viewer && !viewer.isGuest) {
    if (viewer.kind === "INTERN") {
      comments = await newCommentCount(viewer.id, viewer.commentsSeenAt);
      // Active interns get the 출근/퇴근 toggle in the topbar.
      if (!isFrozenIntern(viewer)) {
        const todayUTC = seoulTodayUTCDate();
        const [ci, journalCount] = await Promise.all([
          prisma.checkIn.findUnique({
            where: { userId_date: { userId: viewer.id, date: todayUTC } },
            select: { inAt: true, outAt: true },
          }),
          prisma.taskEntry.count({ where: { internId: viewer.id, entryDate: todayUTC } }),
        ]);
        internCheck = {
          userId: viewer.id,
          working: !!(ci?.inAt && !ci?.outAt),
          hasJournalToday: journalCount > 0,
        };
      }
    } else if (viewer.kind === "STAFF") {
      [approvals, allRequests] = await Promise.all([
        pendingApprovalCount(viewer),
        allPendingApprovalCount(),
      ]);
    }
  }

  return (
    <html lang={locale}>
      <body>
        <LangProvider locale={locale}>
          {viewer && (
            <TopBar
              viewer={viewer}
              comments={comments}
              approvals={approvals}
              allRequests={allRequests}
              internCheck={internCheck}
            />
          )}
          {children}
          {viewer && <HelpChat />}
        </LangProvider>
      </body>
    </html>
  );
}
