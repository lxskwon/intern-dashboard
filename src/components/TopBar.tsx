import Link from "next/link";
import Image from "next/image";
import type { Viewer } from "@/lib/session";
import { getT } from "@/lib/i18n-server";
import { logoutAction } from "@/lib/actions";
import { isAdminOrBoss, roleLabel } from "@/lib/permissions";
import { hasActiveMentees, isFrozenIntern } from "@/lib/session";
import { LangToggle } from "./LangToggle";
import { AdminMenu } from "./AdminMenu";
import { CheckInToggle } from "./CheckInToggle";

export async function TopBar({
  viewer,
  comments = 0,
  approvals = 0,
  allRequests = 0,
  internCheck = null,
}: {
  viewer: Viewer;
  comments?: number;
  approvals?: number;
  allRequests?: number;
  internCheck?: { userId: string; working: boolean; hasJournalToday: boolean } | null;
}) {
  const t = await getT();
  const isGuest = viewer.isGuest;
  // Frozen (ended) interns are limited to their own card + their 기수, so the
  // general nav links are hidden for them.
  const frozen = isFrozenIntern(viewer);
  const isMentor =
    !isGuest && viewer.kind === "STAFF"
      ? await hasActiveMentees(viewer.id, viewer.name)
      : false;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <Image src="/sparklabs-logo.png" alt="SparkLabs" width={82} height={25} className="brand-logo" />
          <span>{t("펠로우십 대시보드")}</span>
        </Link>
        <nav className="nav">
          {!frozen && (
            <>
              <Link href="/projects">{t("모든 업무")}</Link>
              <Link href="/activity">{t("최근 활동")}</Link>
              <Link href="/calendar">{t("캘린더")}</Link>
            </>
          )}
          {!isGuest &&
            (viewer.kind === "INTERN" ? (
              <Link href="/me" className="nav-icon-link" title={t("내 카드")}>
                {t("내 카드")}
                {comments > 0 && (
                  <span className="comment-flag" title={t("새 댓글")}>
                    💬
                  </span>
                )}
              </Link>
            ) : (
              <Link href="/me" className="nav-icon-link">
                {t("내 계정")}
                {approvals > 0 && (
                  <span className="notif-badge static" style={{ marginLeft: 6 }}>
                    {approvals > 99 ? "99+" : approvals}
                  </span>
                )}
              </Link>
            ))}
        </nav>
        <div className="spacer" />

        {isAdminOrBoss(viewer) && (
          <AdminMenu
            label={t("관리자")}
            items={[
              { href: "/approvals", label: t("전체 요청"), badge: allRequests },
              { href: "/cohorts", label: t("기수 관리") },
              { href: "/assign", label: t("배정 관리") },
              { href: "/members", label: t("구성원 관리") },
              { href: "/attendance", label: t("출퇴근 관리") },
            ]}
          />
        )}

        {internCheck && (
          <CheckInToggle
            userId={internCheck.userId}
            working={internCheck.working}
            hasJournalToday={internCheck.hasJournalToday}
          />
        )}

        <LangToggle />

        {isGuest ? (
          <>
            <div className="whoami">
              <strong>{t("게스트")}</strong>
              <span className="role-pill" style={{ marginLeft: 8 }}>{t("보기 전용")}</span>
            </div>
            <Link href="/login" className="btn btn-sm btn-primary">
              {t("로그인")}
            </Link>
          </>
        ) : (
          <>
            <div className="whoami">
              <strong>{viewer.name}</strong>
              {viewer.kind === "STAFF" && (
                <span className="role-pill" style={{ marginLeft: 8 }}>{t(roleLabel(viewer, isMentor))}</span>
              )}
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-sm">
                {t("로그아웃")}
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
