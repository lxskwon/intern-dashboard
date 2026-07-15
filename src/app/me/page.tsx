import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isEnded, isCurrentlyAway } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MenteeClaimForm } from "@/components/MenteeClaimForm";
import { deleteAccountAction, deleteMenteeAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Interns manage everything on their card.
  if (user.kind === "INTERN") redirect(`/interns/${user.id}`);

  // Names this mentor has registered (works even before those interns sign up).
  const claims = await prisma.mentorMentee.findMany({
    where: { mentorId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const claimedNames = claims.map((c) => c.internName);

  // Linked interns = those who typed this mentor's name OR whom this mentor claimed.
  const mentees = await prisma.user.findMany({
    where: {
      kind: "INTERN",
      OR: [
        { mentorName: { equals: user.name, mode: "insensitive" } },
        ...(claimedNames.length ? [{ name: { in: claimedNames } }] : []),
      ],
    },
    include: {
      workSchedules: { select: { days: true, startTime: true, endTime: true } },
      unavailabilities: { select: { startDate: true, endDate: true } },
    },
    orderBy: { name: "asc" },
  });
  const linkedNames = new Set(mentees.map((m) => m.name));

  return (
    <main className="container">
      <h1 className="page-title" style={{ marginTop: 12 }}>
        내 계정
      </h1>
      <p className="page-sub">멘토 계정 정보</p>

      <div className="card card-pad section">
        <h2 className="section-title">내 담당 인턴 ({mentees.length})</h2>
        {mentees.length === 0 ? (
          <div className="empty">
            아직 담당 인턴이 없습니다. 인턴이 멘토 이름에 “{user.name}”을(를) 입력하면 여기에 자동으로
            표시됩니다.
          </div>
        ) : (
          <div className="mentee-list">
            {mentees.map((m) => {
              const ended = isEnded(m.endDate);
              return (
                <Link key={m.id} href={`/interns/${m.id}`} className="mentee-row">
                  <Avatar name={m.name} photoUrl={m.photoUrl} size={36} />
                  <div className="mentee-info">
                    <span className="mentee-name">{m.name}</span>
                    <span className="meta-line">{m.team ?? "팀 없음"}</span>
                  </div>
                  <StatusBadge
                    ended={ended}
                    away={!ended && isCurrentlyAway(m.unavailabilities)}
                    schedules={m.workSchedules}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Register intern names (works before they sign up) */}
      <div className="card card-pad section">
        <h2 className="section-title">담당 인턴 직접 등록</h2>
        <p className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
          인턴이 아직 가입하지 않았어도 이름을 등록해두면, 가입 시 자동으로 연결됩니다.
        </p>
        {claims.length > 0 && (
          <div className="pill-row" style={{ marginBottom: 14 }}>
            {claims.map((c) => (
              <span key={c.id} className="task-pill">
                {c.internName}
                {linkedNames.has(c.internName) ? (
                  <span style={{ color: "#15803d", fontSize: 11, marginLeft: 4 }}>· 연결됨</span>
                ) : (
                  <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>· 대기중</span>
                )}
                <form action={deleteMenteeAction} style={{ display: "inline" }}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <button type="submit" className="pill-x" aria-label="삭제">
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        )}
        <MenteeClaimForm />
      </div>

      <div className="card card-pad section" style={{ maxWidth: 520 }}>
        <h2 className="section-title">계정 정보</h2>
        <dl className="card-meta" style={{ border: "none", padding: 0 }}>
          <div>
            <dt>이름</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>구분</dt>
            <dd>멘토</dd>
          </div>
        </dl>

        <details style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <summary className="btn btn-sm btn-danger" style={{ display: "inline-block" }}>
            계정 삭제
          </summary>
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              계정이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            <form action={deleteAccountAction}>
              <input type="hidden" name="userId" value={user.id} />
              <ConfirmButton message="정말 계정을 삭제할까요? 되돌릴 수 없습니다.">
                계정 영구 삭제
              </ConfirmButton>
            </form>
          </div>
        </details>
      </div>
    </main>
  );
}
