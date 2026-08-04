import "server-only";

/**
 * Email via Resend (https://resend.com). Set RESEND_API_KEY (and optionally
 * EMAIL_FROM like "인턴 대시보드 <noreply@sparklabs.co.kr>") in the env. Until the
 * key is present, sends are logged and skipped so the app works without it.
 */
const FROM = process.env.EMAIL_FROM || "스파크랩 펠로우십 대시보드 <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "https://intern-dashboard-inky-one.vercel.app";

async function send(to: string[], subject: string, html: string): Promise<void> {
  const recipients = [...new Set(to.filter(Boolean))];
  if (!recipients.length) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped — no RESEND_API_KEY] "${subject}" → ${recipients.join(", ")}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: recipients, subject, html }),
    });
    if (!res.ok) console.error("email send failed:", res.status, await res.text());
  } catch (e) {
    console.error("email error:", (e as Error).message);
  }
}

function link(): string {
  return `<p style="margin-top:16px"><a href="${APP_URL}" style="color:#4f46e5;font-weight:700;text-decoration:none">대시보드에서 확인하기 →</a></p>`;
}

/** Notify a mentor and intern that they've been matched. */
export async function emailAssignment(
  mentor: { name: string; email: string },
  intern: { name: string; email: string }
): Promise<void> {
  await send(
    [mentor.email],
    "[스파크랩 펠로우십] 인턴 배정 안내",
    `<p>당신의 인턴은 <b>${intern.name}</b>님으로 배정되었습니다.</p>${link()}`
  );
  await send(
    [intern.email],
    "[스파크랩 펠로우십] 멘토 배정 안내",
    `<p>당신의 멘토는 <b>${mentor.name}</b>님으로 배정되었습니다.</p>${link()}`
  );
}

/** A mentor was added to an intern (via 대표님 override / edit). */
export async function emailMentorAdded(
  mentorName: string,
  internName: string,
  mentorEmail: string | null,
  internEmail: string | null
): Promise<void> {
  if (internEmail) {
    await send(
      [internEmail],
      "[스파크랩 펠로우십] 멘토 배정 안내",
      `<p><b>${mentorName}</b>님이 멘토로 추가되었습니다.</p>${link()}`
    );
  }
  if (mentorEmail) {
    await send(
      [mentorEmail],
      "[스파크랩 펠로우십] 담당 인턴 배정 안내",
      `<p><b>${internName}</b>님이 담당 인턴으로 추가되었습니다.</p>${link()}`
    );
  }
}

/** A 1-for-1 mentor swap — a single combined notice to the intern. */
export async function emailMentorChanged(
  newMentorName: string,
  internEmail: string | null
): Promise<void> {
  if (!internEmail) return;
  await send(
    [internEmail],
    "[스파크랩 펠로우십] 멘토 배정 변경 안내",
    `<p>멘토가 <b>${newMentorName}</b>님으로 변경되었습니다.</p>${link()}`
  );
}

/** A mentor was removed from an intern (대표님 unassigned, no replacement). */
export async function emailMentorRemoved(
  mentorName: string,
  internName: string,
  mentorEmail: string | null,
  internEmail: string | null
): Promise<void> {
  if (internEmail) {
    await send(
      [internEmail],
      "[스파크랩 펠로우십] 멘토 배정 변경 안내",
      `<p><b>${mentorName}</b>님이 더 이상 회원님의 멘토가 아닙니다.</p>${link()}`
    );
  }
  if (mentorEmail) {
    await send(
      [mentorEmail],
      "[스파크랩 펠로우십] 담당 인턴 배정 변경 안내",
      `<p><b>${internName}</b>님이 더 이상 회원님의 담당 인턴이 아닙니다.</p>${link()}`
    );
  }
}

/** Notify sparkai@ + the intern's mentor(s) of a new approval/confirmation request. */
export async function emailApprovalRequest(
  internName: string,
  what: string,
  mentorEmails: string[]
): Promise<void> {
  await send(
    ["sparkai@sparklabs.co.kr", ...mentorEmails],
    `[스파크랩 펠로우십] ${internName} 인턴 ${what} 요청`,
    `<p><b>${internName}</b> 인턴이 <b>${what}</b> 요청을 등록했습니다. 확인/승인해 주세요.</p>${link()}`
  );
}
