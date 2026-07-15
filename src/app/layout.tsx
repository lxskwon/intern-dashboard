import type { Metadata } from "next";
import "./globals.css";
import { getViewer } from "@/lib/session";
import { newCommentCount } from "@/lib/notifications";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "인턴 대시보드",
  description: "누가 무엇을 하고 있고, 지금 누가 여유 있는지 한눈에.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  let comments = 0;
  if (viewer && !viewer.isGuest && viewer.kind === "INTERN") {
    comments = await newCommentCount(viewer.id, viewer.commentsSeenAt);
  }

  return (
    <html lang="ko">
      <body>
        {viewer && <TopBar viewer={viewer} comments={comments} />}
        {children}
      </body>
    </html>
  );
}
