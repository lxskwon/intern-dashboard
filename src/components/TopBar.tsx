import Link from "next/link";
import type { Viewer } from "@/lib/session";
import { logoutAction } from "@/lib/actions";

export function TopBar({
  viewer,
  comments = 0,
}: {
  viewer: Viewer;
  comments?: number;
}) {
  const isGuest = viewer.isGuest;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          🧭 인턴 대시보드
        </Link>
        <nav className="nav">
          <Link href="/">대시보드</Link>
          <Link href="/projects">프로젝트</Link>
          <Link href="/activity">최근 활동</Link>
          <Link href="/calendar">캘린더</Link>
          {!isGuest &&
            (viewer.kind === "INTERN" ? (
              <Link href="/me" className="nav-icon-link" title="내 카드">
                내 카드
                {comments > 0 && (
                  <span className="comment-flag" title="새 댓글">
                    💬
                  </span>
                )}
              </Link>
            ) : (
              <Link href="/me">내 계정</Link>
            ))}
        </nav>
        <div className="spacer" />

        {isGuest ? (
          <>
            <div className="whoami">
              <strong>게스트</strong>
              <span className="role-pill" style={{ marginLeft: 8 }}>보기 전용</span>
            </div>
            <Link href="/login" className="btn btn-sm btn-primary">
              로그인
            </Link>
          </>
        ) : (
          <>
            <div className="whoami">
              <strong>{viewer.name}</strong>
              {viewer.kind === "STAFF" && (
                <span className="role-pill" style={{ marginLeft: 8 }}>멘토</span>
              )}
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-sm">
                로그아웃
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
