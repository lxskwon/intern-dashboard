"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { createSession, destroySession, getCurrentUser } from "./session";
import { canEdit, isAdminOrBoss, isInternLead, canAnnounce } from "./permissions";
import { saveUpload, saveResume, deleteResume } from "./uploads";
import { summarizeResumePdf } from "./ai";
import { answerHelp, type HelpMessage } from "./help";
import { getLocale } from "./i18n-server";
import { taskTokens } from "./text";
import {
  markCommentsSeen,
  markConversationRead,
  mentorEmailsForIntern,
} from "./notifications";
import {
  emailAssignment,
  emailApprovalRequest,
  emailMentorAdded,
  emailMentorRemoved,
  emailMentorChanged,
} from "./email";
import { getT } from "./i18n-server";
import { seoulTodayUTCDate } from "./format";
import { autoCloseEndedInternTasks } from "./autoclose";

// ---------- helpers ----------

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
}

/** A mentor's email if they have a staff account (name-based lookup), else null. */
async function staffEmailByName(name: string): Promise<string | null> {
  const s = await prisma.user.findFirst({
    where: { kind: "STAFF", name: { equals: name, mode: "insensitive" } },
    select: { email: true },
  });
  return s?.email ?? null;
}

/** Email sparkai@ + the intern's mentor(s) about a new 승인/확정 request. */
async function notifyRequest(internId: string, what: string): Promise<void> {
  const intern = await prisma.user.findUnique({
    where: { id: internId },
    select: { name: true, mentorNames: true },
  });
  if (!intern) return;
  const emails = await mentorEmailsForIntern(intern);
  await emailApprovalRequest(intern.name, what, emails);
}

/** Split a comma/newline-separated list of names into a deduped, trimmed array. */
function parseNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

/** Selected teams (본부) from the multi-picker — deduped, trimmed, order kept. */
function parseTeams(fd: FormData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of fd.getAll("teams")) {
    const team = String(v).trim();
    if (team && !seen.has(team.toLowerCase())) {
      seen.add(team.toLowerCase());
      out.push(team);
    }
  }
  return out;
}

function optDate(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export type FormState = { error?: string; ok?: boolean } | undefined;

/** Return a form error, translated to the current UI locale. */
async function fe(ko: string): Promise<FormState> {
  return { error: (await getT())(ko) };
}

// ---------- auth ----------

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return fe("이메일과 비밀번호를 입력하세요.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fe("이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  if (user.withdrawnAt) {
    return fe("탈퇴 처리된 계정입니다. 관리자에게 문의하세요.");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Help chatbot — answers questions about how to use the dashboard. */
export async function helpChatAction(
  history: HelpMessage[]
): Promise<{ reply: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const clean = (history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!clean.length) return { error: "메시지를 입력하세요." };
  const reply = await answerHelp(clean, await getLocale());
  return { reply };
}

/** Set the UI language (ko | en). Not sensitive, so a plain long-lived cookie. */
export async function setLocaleAction(locale: string): Promise<void> {
  const l = locale === "en" ? "en" : "ko";
  const jar = await cookies();
  jar.set("lang", l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const kind = str(fd, "kind") === "STAFF" ? "STAFF" : "INTERN";
  // Interns and staff have separate access codes. Interns fall back to the
  // shared SIGNUP_CODE if a dedicated intern code isn't configured.
  const code = str(fd, "code");
  const expected =
    kind === "STAFF"
      ? process.env.SIGNUP_CODE ?? ""
      : process.env.INTERN_SIGNUP_CODE ?? process.env.SIGNUP_CODE ?? "";
  if (!expected || code !== expected) {
    return fe("액세스 코드가 올바르지 않습니다.");
  }

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!name || !email || !password) return fe("이름, 이메일, 비밀번호를 모두 입력하세요.");
  if (password.length < 6) return fe("비밀번호는 6자 이상이어야 합니다.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fe("이미 해당 이메일의 사용자가 있습니다.");

  // New interns join the currently active cohort (기수).
  const activeCohort =
    kind === "INTERN" ? await prisma.cohort.findFirst({ where: { isActive: true } }) : null;
  const user = await prisma.user.create({
    data: {
      name,
      email,
      kind,
      // New staff join as 직원. 관리자 is granted later by an admin.
      role: kind === "STAFF" ? "STAFF" : null,
      teams: kind === "STAFF" ? parseTeams(fd) : [],
      passwordHash: await bcrypt.hash(password, 10),
      cohortId: activeCohort?.id ?? null,
    },
  });

  await createSession(user.id);
  // Staff have no card; send them to the dashboard.
  redirect(kind === "STAFF" ? "/" : `/interns/${user.id}`);
}

// ---------- cohorts (기수) ----------

const TERMS = ["봄", "여름", "가을", "겨울"];

/** Create a new cohort and make it the active one (admins only). */
export async function createCohortAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") return fe("권한이 없습니다.");

  const year = parseInt(str(fd, "year"), 10);
  const term = str(fd, "term");
  if (!year || year < 2000 || year > 2100) return fe("연도를 올바르게 입력하세요.");
  if (!TERMS.includes(term)) return fe("시즌을 선택하세요.");

  const label = `${year}년 ${term}`;
  const existing = await prisma.cohort.findFirst({ where: { OR: [{ label }, { year, term }] } });
  if (existing) return fe("이미 존재하는 기수입니다.");

  const created = await prisma.cohort.create({ data: { label, year, term, isActive: true } });
  // Only one cohort is active at a time.
  await prisma.cohort.updateMany({ where: { id: { not: created.id } }, data: { isActive: false } });

  revalidatePath("/");
  revalidatePath("/me");
  return { ok: true };
}

/** Switch which cohort is active (the dashboard default + signup target). */
export async function setActiveCohortAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  const id = str(fd, "cohortId");
  const cohort = await prisma.cohort.findUnique({ where: { id } });
  if (!cohort) throw new Error("기수를 찾을 수 없습니다.");
  // Activating a cohort clears any prior 종료 mark; deactivating the others does
  // NOT end them — they just lose the "활성" label and stay displayed normally.
  await prisma.cohort.update({ where: { id }, data: { isActive: true, endedAt: null } });
  await prisma.cohort.updateMany({ where: { id: { not: id } }, data: { isActive: false } });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/cohorts");
}

/** End the active cohort and auto-activate the next one chronologically. */
export async function endActiveCohortAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (!isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
  const id = str(fd, "cohortId");
  const current = await prisma.cohort.findUnique({ where: { id } });
  if (!current || !current.isActive) throw new Error("활성 기수가 아닙니다.");

  const TERM: Record<string, number> = { 봄: 1, 여름: 2, 가을: 3, 겨울: 4 };
  const rank = (c: { year: number; term: string }) => c.year * 10 + (TERM[c.term] ?? 0);
  const all = await prisma.cohort.findMany();
  // The next cohort = earliest one that comes chronologically AFTER the current.
  const next = all
    .filter((c) => rank(c) > rank(current))
    .sort((a, b) => rank(a) - rank(b))[0];

  // 종료 explicitly ends this cohort (dimmed + 종료됨). The auto-activated next
  // one becomes active and is cleared of any prior 종료 mark.
  await prisma.cohort.update({ where: { id }, data: { isActive: false, endedAt: new Date() } });
  if (next) await prisma.cohort.update({ where: { id: next.id }, data: { isActive: true, endedAt: null } });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/cohorts");
}

/** Delete a cohort (only if it's not active and has no interns). */
export async function deleteCohortAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  const id = str(fd, "cohortId");
  const cohort = await prisma.cohort.findUnique({
    where: { id },
    include: { _count: { select: { interns: true } } },
  });
  if (!cohort) throw new Error("기수를 찾을 수 없습니다.");
  if (cohort.isActive) throw new Error("활성 기수는 삭제할 수 없습니다.");
  if (cohort._count.interns > 0) throw new Error("소속 인턴이 있는 기수는 삭제할 수 없습니다.");
  await prisma.cohort.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/me");
}

/** Save the admin-only note on an intern's card (admins only). */
export async function updateAdminNoteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") return fe("권한이 없습니다.");
  const userId = str(fd, "userId");
  await prisma.user.update({ where: { id: userId }, data: { adminNote: optStr(fd, "adminNote") } });
  revalidatePath(`/interns/${userId}`);
  return { ok: true };
}

// ---------- profile / card ----------

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const targetId = str(fd, "userId");
  const isOwner = canEdit(actor, targetId);
  const adminEdit = !isOwner && isAdminOrBoss(actor);
  if (!isOwner && !adminEdit) return fe("권한이 없습니다.");

  const name = str(fd, "name");
  if (!name) return fe("이름을 입력하세요.");

  // Both the owner and an admin may edit EVERY field (이름·본부·멘토·이메일·전화·
  // GitHub·이력서). 대표님(BOSS)/관리자 = super admin over intern cards.
  const email = str(fd, "email").toLowerCase();
  if (!email) return fe("이메일을 입력하세요.");

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.id !== targetId) {
    return fe("이미 해당 이메일의 사용자가 있습니다.");
  }

  // Resume: upload a new file, or remove the existing one. Kept in a private
  // bucket; we store only the storage path + original filename.
  const current = await prisma.user.findUnique({
    where: { id: targetId },
    select: { resumePath: true, mentorNames: true },
  });
  let resumePath = current?.resumePath ?? null;
  let resumeName: string | null | undefined = undefined; // undefined = leave unchanged
  let resumeSummary: string | null | undefined = undefined;

  const removeResume = str(fd, "removeResume") === "1";
  const resumeFile = fd.get("resume");
  if (resumeFile instanceof File && resumeFile.size > 0) {
    const saved = await saveResume(resumeFile, targetId);
    if (saved) {
      if (current?.resumePath) await deleteResume(current.resumePath);
      resumePath = saved.path;
      resumeName = saved.name;
      // Generate an AI summary from PDFs (Claude reads PDFs natively).
      const isPdf =
        resumeFile.type === "application/pdf" || saved.name.toLowerCase().endsWith(".pdf");
      resumeSummary = isPdf
        ? await summarizeResumePdf(Buffer.from(await resumeFile.arrayBuffer()))
        : null;
    }
  } else if (removeResume) {
    if (current?.resumePath) await deleteResume(current.resumePath);
    resumePath = null;
    resumeName = null;
    resumeSummary = null;
  }

  const mentorNames = parseNames(str(fd, "mentorNames"));
  await prisma.user.update({
    where: { id: targetId },
    data: {
      name,
      email,
      teams: parseTeams(fd),
      mentorNames,
      phone: optStr(fd, "phone"),
      githubUrl: optStr(fd, "githubUrl"),
      resumePath,
      ...(resumeName !== undefined ? { resumeName } : {}),
      ...(resumeSummary !== undefined ? { resumeSummary } : {}),
    },
  });

  // When an admin edits someone else's card, notify mentors added/removed
  // (like the assign flow). Owners editing their own card don't trigger mail.
  if (adminEdit) {
    const lc = (s: string) => s.trim().toLowerCase();
    const oldNames = current?.mentorNames ?? [];
    const added = mentorNames.filter((n) => !oldNames.some((o) => lc(o) === lc(n)));
    const removed = oldNames.filter((o) => !mentorNames.some((n) => lc(n) === lc(o)));
    if (added.length === 1 && removed.length === 1) {
      await emailMentorChanged(added[0], email);
      await emailMentorRemoved(removed[0], name, await staffEmailByName(removed[0]), null);
      await emailMentorAdded(added[0], name, await staffEmailByName(added[0]), null);
    } else {
      for (const m of added) await emailMentorAdded(m, name, await staffEmailByName(m), email);
      for (const m of removed) await emailMentorRemoved(m, name, await staffEmailByName(m), email);
    }
    revalidatePath("/assign");
  }

  revalidatePath("/");
  revalidatePath(`/interns/${targetId}`);
  return { ok: true };
}

/** A staff member updates their own 본부 (teams) from their account page. */
export async function updateStaffTeamsAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  await prisma.user.update({ where: { id: actor.id }, data: { teams: parseTeams(fd) } });
  revalidatePath("/me");
  revalidatePath("/");
}

// ---------- admin: member tier & status ----------

/** An admin promotes/demotes a 직원 ↔ 관리자. 대표님(BOSS) is untouchable. */
export async function setUserTierAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (!isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
  const userId = str(fd, "userId");
  const tier = str(fd, "tier");
  if (tier !== "STAFF" && tier !== "ADMIN") throw new Error("잘못된 요청입니다.");
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { kind: true, role: true },
  });
  if (!target || target.kind !== "STAFF") throw new Error("직원 계정만 변경할 수 있습니다.");
  if (target.role === "BOSS") throw new Error("대표님 권한은 변경할 수 없습니다.");
  await prisma.user.update({ where: { id: userId }, data: { role: tier } });
  revalidatePath("/members");
  revalidatePath("/");
}

/** An admin marks a member 탈퇴 (left) or restores them. 탈퇴 blocks login and
 * shows a grey label. 대표님 and the actor's own account can't be changed. */
export async function setWithdrawnAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (!isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
  const userId = str(fd, "userId");
  const withdraw = str(fd, "withdraw") === "1";
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("사용자를 찾을 수 없습니다.");
  if (target.role === "BOSS") throw new Error("대표님 계정은 변경할 수 없습니다.");
  if (target.id === actor.id) throw new Error("본인 계정은 변경할 수 없습니다.");
  await prisma.user.update({
    where: { id: userId },
    data: { withdrawnAt: withdraw ? new Date() : null },
  });
  revalidatePath("/members");
  revalidatePath("/");
}

// ---------- 출·퇴근 (manual check-in / out) ----------

/** Whether the intern has a 기록 (journal entry) dated today — required before
 *  they can press 퇴근. */
async function hasJournalToday(internId: string): Promise<boolean> {
  const n = await prisma.taskEntry.count({
    where: { internId, entryDate: seoulTodayUTCDate() },
  });
  return n > 0;
}

/** Intern presses 출근 — marks them 근무중 for today (clears any earlier 퇴근). */
export async function checkInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  if (!canEdit(actor, userId)) return fe("권한이 없습니다.");
  const date = seoulTodayUTCDate();
  await prisma.checkIn.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, inAt: new Date() },
    update: { inAt: new Date(), outAt: null },
  });
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

/** Intern presses 퇴근 — only allowed once they've added today's 기록. */
export async function checkOutAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  if (!canEdit(actor, userId)) return fe("권한이 없습니다.");
  if (!(await hasJournalToday(userId))) return fe("기록 추가하셔야 퇴근 버튼이 활성화 됩니다.");
  const date = seoulTodayUTCDate();
  await prisma.checkIn.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, inAt: new Date(), outAt: new Date() },
    update: { outAt: new Date() },
  });
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

// ---------- announcements ----------

/** Parse the shared 파일/링크 inputs into attachment create-rows. */
async function announcementAttachments(fd: FormData) {
  const links = str(fd, "links")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const files = fd.getAll("files").filter((f): f is File => typeof f !== "string");
  const saved = [];
  for (const file of files) {
    const s = await saveUpload(file);
    if (s) saved.push(s);
  }
  return [
    ...saved.map((s) => ({ kind: s.isImage ? "IMAGE" : "FILE", url: s.url, name: s.name })),
    ...links.map((url) => ({ kind: "LINK", url, name: url })),
  ];
}

/** An admin sets/unsets an intern as 인턴 대표. */
export async function setInternLeadAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (!isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
  const userId = str(fd, "userId");
  const lead = str(fd, "lead") === "1";
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { kind: true } });
  if (!target || target.kind !== "INTERN") throw new Error("인턴만 지정할 수 있습니다.");
  await prisma.user.update({ where: { id: userId }, data: { internLead: lead } });
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/members");
  revalidatePath("/");
}

/** Posts a dashboard announcement, with optional attachments. Admins can target
 *  any audience; an 인턴 대표 is locked to the 인턴 audience. */
export async function createAnnouncementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  if (!canAnnounce(actor)) return fe("권한이 없습니다.");
  const admin = isAdminOrBoss(actor);
  const body = str(fd, "body").trim();
  if (!body) return fe("공지 내용을 입력하세요.");
  const rawAud = str(fd, "audience");
  let audience = ["ALL", "STAFF", "INTERN", "TEAM"].includes(rawAud) ? rawAud : "ALL";
  let team = audience === "TEAM" ? str(fd, "team").trim() : null;
  if (!admin) {
    // 인턴 대표 — interns only.
    audience = "INTERN";
    team = null;
  }
  if (audience === "TEAM" && !team) return fe("본부를 선택하세요.");
  const attachments = await announcementAttachments(fd);
  await prisma.announcement.create({
    data: { body, audience, team, authorName: actor.name, attachments: { create: attachments } },
  });
  revalidatePath("/");
  return { ok: true };
}

/** An admin edits an existing announcement (body/audience/본부) and may add more
 *  attachments. Existing attachments are removed separately. */
export async function updateAnnouncementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const id = str(fd, "id");
  if (!id) return fe("공지를 찾을 수 없습니다.");
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) return fe("공지를 찾을 수 없습니다.");
  const admin = isAdminOrBoss(actor);
  // An 인턴 대표 may only edit their own posts.
  if (!admin && !(isInternLead(actor) && existing.authorName === actor.name)) {
    return fe("권한이 없습니다.");
  }
  const body = str(fd, "body").trim();
  if (!body) return fe("공지 내용을 입력하세요.");
  const rawAud = str(fd, "audience");
  let audience = ["ALL", "STAFF", "INTERN", "TEAM"].includes(rawAud) ? rawAud : "ALL";
  let team = audience === "TEAM" ? str(fd, "team").trim() : null;
  if (!admin) {
    audience = "INTERN";
    team = null;
  }
  if (audience === "TEAM" && !team) return fe("본부를 선택하세요.");
  const attachments = await announcementAttachments(fd);
  await prisma.announcement.update({
    where: { id },
    data: { body, audience, team, attachments: { create: attachments } },
  });
  revalidatePath("/");
  return { ok: true };
}

/** Removes an announcement — admins any, an 인턴 대표 only their own. */
export async function deleteAnnouncementAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "id");
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new Error("공지를 찾을 수 없습니다.");
  const admin = isAdminOrBoss(actor);
  if (!admin && !(isInternLead(actor) && existing.authorName === actor.name)) {
    throw new Error("권한이 없습니다.");
  }
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/");
}

export async function updateWorkPeriodAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const targetId = str(fd, "userId");
  const isOwner = canEdit(actor, targetId);
  if (!isOwner && !isAdminOrBoss(actor)) return fe("권한이 없습니다.");

  const start = optDate(fd, "startDate");
  const end = optDate(fd, "endDate");
  await prisma.user.update({
    where: { id: targetId },
    data: {
      startDate: start,
      endDate: end,
      // The intern's own edit needs admin 확정; an admin editing it directly is
      // already authoritative, so it's confirmed immediately.
      periodConfirmed: isOwner ? !(start || end) : true,
      periodConfirmedAt: !isOwner && (start || end) ? new Date() : null,
    },
  });
  // Only the intern's own change pings admins for confirmation.
  if (isOwner && (start || end)) await notifyRequest(targetId, "근무 기간");

  // If an admin just set an end date that's already passed, close the intern's
  // still-ongoing tasks right away (마감일 → 종료일 when unset).
  if (!isOwner && end) await autoCloseEndedInternTasks();

  revalidatePath("/");
  revalidatePath(`/interns/${targetId}`);
  revalidatePath("/me");
  revalidatePath("/projects");
  return { ok: true };
}

/** An admin confirms an intern's work period. */
export async function approveWorkPeriodAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  const userId = str(fd, "userId");
  await prisma.user.update({
    where: { id: userId },
    data: { periodConfirmed: true, periodConfirmedAt: new Date() },
  });
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function deleteAccountAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  if (!canEdit(actor, userId)) throw new Error("권한이 없습니다.");

  await prisma.user.delete({ where: { id: userId } });
  await destroySession();
  revalidatePath("/");
  redirect("/signup");
}

// ---------- work schedules ----------

export async function addWorkScheduleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  const isOwner = canEdit(actor, userId);
  if (!isOwner && !isAdminOrBoss(actor)) return fe("권한이 없습니다.");

  const days = fd
    .getAll("days")
    .map((d) => String(d))
    .filter((d) => /^[0-6]$/.test(d));
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");

  if (!days.length) return fe("근무 요일을 하나 이상 선택하세요.");
  if (!startTime || !endTime) return fe("근무 시작·종료 시간을 입력하세요.");
  if (endTime < startTime) return fe("종료 시간은 시작 시간보다 빠를 수 없습니다.");

  // The intern's own block starts PENDING until confirmed; an admin adding it
  // directly is already authoritative (APPROVED).
  await prisma.workSchedule.create({
    data: {
      userId,
      days: days.join(","),
      startTime,
      endTime,
      status: isOwner ? "PENDING" : "APPROVED",
      confirmedAt: isOwner ? null : new Date(),
    },
  });
  if (isOwner) await notifyRequest(userId, "근무 시간");

  revalidatePath("/");
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  return { ok: true };
}

/** An admin confirms an intern's work-hours block. */
export async function approveWorkScheduleAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  const id = str(fd, "scheduleId");
  const sched = await prisma.workSchedule.findUnique({ where: { id } });
  if (!sched) throw new Error("일정을 찾을 수 없습니다.");
  await prisma.workSchedule.update({
    where: { id },
    data: { status: "APPROVED", confirmedAt: new Date() },
  });
  revalidatePath(`/interns/${sched.userId}`);
  revalidatePath("/me");
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function deleteWorkScheduleAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "scheduleId");
  const sched = await prisma.workSchedule.findUnique({ where: { id } });
  if (!sched) throw new Error("일정을 찾을 수 없습니다.");
  if (!canEdit(actor, sched.userId) && !isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");

  await prisma.workSchedule.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath(`/interns/${sched.userId}`);
}

// ---------- assignments ----------

export type TaskSuggestion = { id: string; title: string; internName: string };

/** Suggest existing tasks (from other interns) that share terms with the query. */
export async function searchTasksAction(query: string): Promise<TaskSuggestion[]> {
  const actor = await getCurrentUser();
  if (!actor) return [];
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const tasks = await prisma.assignment.findMany({
    where: { internId: { not: actor.id } },
    select: { id: true, title: true, intern: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const qTokens = taskTokens(q);
  const scored = tasks
    .map((t) => {
      const tl = t.title.toLowerCase();
      let score = 0;
      if (tl.includes(q) || q.includes(tl)) score += 3;
      const tt = new Set(taskTokens(t.title));
      for (const tok of qTokens) if (tt.has(tok)) score += 1;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return scored.map((x) => ({ id: x.t.id, title: x.t.title, internName: x.t.intern.name }));
}

export type ProjectSuggestion = { id: string; name: string; count: number };

/** Suggest existing projects matching the query, for the project autocomplete. */
export async function searchProjectsAction(query: string): Promise<ProjectSuggestion[]> {
  const actor = await getCurrentUser();
  if (!actor) return [];
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const projects = await prisma.project.findMany({
    include: { _count: { select: { tasks: true } } },
    take: 200,
  });
  const qTokens = taskTokens(q);
  return projects
    .map((pr) => {
      const nl = pr.name.toLowerCase();
      let score = 0;
      if (nl.includes(q)) score += 3;
      const tt = new Set(taskTokens(pr.name));
      for (const tok of qTokens) if (tt.has(tok)) score += 1;
      return { pr, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => ({ id: x.pr.id, name: x.pr.name, count: x.pr._count.tasks }));
}

/** Resolve a project field (existing id, existing/new name, or none) to an id. */
async function resolveProject(projectId: string, projectName: string): Promise<string | null> {
  if (projectId) return projectId;
  if (!projectName) return null;
  const existing = await prisma.project.findFirst({
    where: { name: { equals: projectName, mode: "insensitive" } },
  });
  if (existing) return existing.id;
  const created = await prisma.project.create({ data: { name: projectName } });
  return created.id;
}

export async function createAssignmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const internId = str(fd, "internId");
  const title = str(fd, "title");
  if (!title) throw new Error("Title is required");
  if (!canEdit(actor, internId)) throw new Error("Not allowed");

  await prisma.assignment.create({
    data: {
      internId,
      title,
      description: optStr(fd, "description"),
      link: optStr(fd, "link"),
      githubUrl: optStr(fd, "githubUrl"),
      startDate: optDate(fd, "startDate"),
      expectedDoneDate: optDate(fd, "expectedDoneDate"),
      assignedById: actor.id,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/interns/${internId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateProjectAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = str(fd, "projectId");
  const name = str(fd, "name");
  if (!id) return fe("프로젝트를 찾을 수 없습니다.");
  if (!name) return fe("프로젝트 이름을 입력하세요.");

  await prisma.project.update({
    where: { id },
    data: {
      name,
      lead: optStr(fd, "lead"),
      description: optStr(fd, "description"),
      startDate: optDate(fd, "startDate"),
      dueDate: optDate(fd, "dueDate"),
    },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { ok: true };
}

export async function setTaskProjectAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const a = await assignmentIfEditable(actor.id, str(fd, "assignmentId"));
  const projectId = await resolveProject(str(fd, "projectId"), str(fd, "projectName"));
  await prisma.assignment.update({ where: { id: a.id }, data: { projectId } });
  revalidatePath(`/tasks/${a.id}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateAssignmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const a = await prisma.assignment.findUnique({ where: { id: str(fd, "assignmentId") } });
  if (!a) return fe("업무를 찾을 수 없습니다.");
  if (a.internId !== actor.id) return fe("권한이 없습니다.");

  const title = str(fd, "title");
  if (!title) return fe("제목을 입력하세요.");

  await prisma.assignment.update({
    where: { id: a.id },
    data: {
      title,
      description: optStr(fd, "description"),
      link: optStr(fd, "link"),
      githubUrl: optStr(fd, "githubUrl"),
      startDate: optDate(fd, "startDate"),
      expectedDoneDate: optDate(fd, "expectedDoneDate"),
    },
  });
  revalidatePath(`/tasks/${a.id}`);
  revalidatePath(`/interns/${a.internId}`);
  revalidatePath("/");
  return { ok: true };
}

async function assignmentIfEditable(actorId: string, assignmentId: string) {
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!a) throw new Error("업무를 찾을 수 없습니다.");
  if (a.internId !== actorId) throw new Error("권한이 없습니다.");
  return a;
}

export async function completeAssignmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const a = await assignmentIfEditable(actor.id, str(fd, "assignmentId"));
  await prisma.assignment.update({
    where: { id: a.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath(`/interns/${a.internId}`);
  revalidatePath(`/tasks/${a.id}`);
  revalidatePath("/");
}

export async function reopenAssignmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const a = await assignmentIfEditable(actor.id, str(fd, "assignmentId"));
  await prisma.assignment.update({
    where: { id: a.id },
    data: { status: "ACTIVE", completedAt: null },
  });
  revalidatePath(`/interns/${a.internId}`);
  revalidatePath(`/tasks/${a.id}`);
  revalidatePath("/");
}

export async function deleteAssignmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const a = await assignmentIfEditable(actor.id, str(fd, "assignmentId"));
  await prisma.assignment.delete({ where: { id: a.id } });
  revalidatePath(`/interns/${a.internId}`);
  revalidatePath("/");
}

// ---------- unavailability (부재 일정) ----------

export async function addUnavailabilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  if (!canEdit(actor, userId)) return fe("권한이 없습니다.");

  const start = optDate(fd, "startDate");
  const end = optDate(fd, "endDate");
  if (!start || !end) return fe("시작일과 종료일을 입력하세요.");
  if (end < start) return fe("종료일은 시작일보다 빠를 수 없습니다.");
  const reason = str(fd, "reason");
  if (!reason) return fe("사유를 입력하세요.");

  // New requests start PENDING and must be approved by an admin.
  await prisma.unavailability.create({
    data: { userId, startDate: start, endDate: end, reason },
  });
  await notifyRequest(userId, "부재 일정");
  revalidatePath("/calendar");
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

/** Add a single-day 출·퇴근 조정 (late arrival / early leave). Like a 부재,
 *  it starts PENDING and needs admin approval. */
export async function addScheduleAdjustAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const userId = str(fd, "userId");
  if (!canEdit(actor, userId)) return fe("권한이 없습니다.");

  const date = optDate(fd, "date");
  if (!date) return fe("날짜를 입력하세요.");
  const adjustType = str(fd, "adjustType") === "EARLY" ? "EARLY" : "LATE";
  const adjustTime = str(fd, "adjustTime");
  if (!adjustTime) return fe("시각을 입력하세요.");
  const reason = optStr(fd, "reason");

  await prisma.unavailability.create({
    data: { userId, startDate: date, endDate: date, kind: "ADJUST", adjustType, adjustTime, reason },
  });
  await notifyRequest(userId, "출·퇴근 조정");
  revalidatePath("/calendar");
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

/** An admin (관리자) approves a pending out-of-office request. */
export async function approveUnavailabilityAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.kind !== "STAFF") throw new Error("권한이 없습니다.");
  const id = str(fd, "unavailabilityId");
  const item = await prisma.unavailability.findUnique({ where: { id } });
  if (!item) throw new Error("일정을 찾을 수 없습니다.");

  await prisma.unavailability.update({
    where: { id },
    data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() },
  });
  revalidatePath("/calendar");
  revalidatePath(`/interns/${item.userId}`);
  revalidatePath("/me");
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function deleteUnavailabilityAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "unavailabilityId");
  const item = await prisma.unavailability.findUnique({ where: { id } });
  if (!item) throw new Error("일정을 찾을 수 없습니다.");
  if (!canEdit(actor, item.userId)) throw new Error("권한이 없습니다.");

  await prisma.unavailability.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath(`/interns/${item.userId}`);
  revalidatePath("/");
}

// ---------- task journal entries ----------

/** Validate an optional task link belongs to the given intern. Returns the id or null. */
async function resolveEntryTask(assignmentId: string, internId: string): Promise<string | null | false> {
  if (!assignmentId) return null;
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { internId: true },
  });
  if (!a || a.internId !== internId) return false; // not this intern's task
  return assignmentId;
}

export async function addTaskEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const internId = str(fd, "internId");
  if (!canEdit(actor, internId)) return fe("권한이 없습니다.");

  const link = await resolveEntryTask(str(fd, "assignmentId"), internId);
  if (link === false) return fe("업무를 찾을 수 없습니다.");

  const body = optStr(fd, "body");
  const entryDate = optDate(fd, "entryDate") ?? new Date();

  const links = str(fd, "links")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const files = fd.getAll("files").filter((f): f is File => typeof f !== "string");
  const saved = [];
  for (const file of files) {
    const s = await saveUpload(file);
    if (s) saved.push(s);
  }

  if (!body && !links.length && !saved.length) {
    return fe("내용, 파일, 또는 링크 중 하나 이상을 추가하세요.");
  }

  await prisma.taskEntry.create({
    data: {
      internId,
      assignmentId: link,
      authorId: actor.id,
      entryDate,
      body,
      attachments: {
        create: [
          ...saved.map((s) => ({
            kind: s.isImage ? "IMAGE" : "FILE",
            url: s.url,
            name: s.name,
          })),
          ...links.map((url) => ({ kind: "LINK", url, name: url })),
        ],
      },
    },
  });

  revalidatePath(`/interns/${internId}`);
  revalidatePath(`/interns/${internId}/log`);
  if (link) revalidatePath(`/tasks/${link}`);
  revalidatePath("/activity");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTaskEntryAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "entryId");
  const entry = await prisma.taskEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("기록을 찾을 수 없습니다.");
  if (!canEdit(actor, entry.internId)) throw new Error("권한이 없습니다.");

  await prisma.taskEntry.delete({ where: { id } });
  revalidatePath(`/interns/${entry.internId}`);
  revalidatePath(`/interns/${entry.internId}/log`);
  if (entry.assignmentId) revalidatePath(`/tasks/${entry.assignmentId}`);
  revalidatePath("/activity");
  revalidatePath("/");
}

export async function updateTaskEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const id = str(fd, "entryId");
  const entry = await prisma.taskEntry.findUnique({ where: { id } });
  if (!entry) return fe("기록을 찾을 수 없습니다.");
  if (!canEdit(actor, entry.internId)) return fe("권한이 없습니다.");

  // The edit form always submits the task selector, so "" means unlink.
  const link = await resolveEntryTask(str(fd, "assignmentId"), entry.internId);
  if (link === false) return fe("업무를 찾을 수 없습니다.");

  const body = optStr(fd, "body");
  const entryDate = optDate(fd, "entryDate") ?? entry.entryDate;
  const links = str(fd, "links")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const files = fd.getAll("files").filter((f): f is File => typeof f !== "string");
  const saved = [];
  for (const file of files) {
    const s = await saveUpload(file);
    if (s) saved.push(s);
  }

  await prisma.taskEntry.update({
    where: { id },
    data: {
      body,
      entryDate,
      assignmentId: link,
      attachments: {
        create: [
          ...saved.map((s) => ({ kind: s.isImage ? "IMAGE" : "FILE", url: s.url, name: s.name })),
          ...links.map((url) => ({ kind: "LINK", url, name: url })),
        ],
      },
    },
  });
  revalidatePath(`/interns/${entry.internId}`);
  revalidatePath(`/interns/${entry.internId}/log`);
  if (entry.assignmentId) revalidatePath(`/tasks/${entry.assignmentId}`); // old link
  if (link) revalidatePath(`/tasks/${link}`); // new link
  revalidatePath("/activity");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAttachmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "attachmentId");
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { entry: true },
  });
  if (!att) throw new Error("첨부를 찾을 수 없습니다.");
  if (att.announcementId) {
    // Announcement attachment — admin only.
    if (!isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
    await prisma.attachment.delete({ where: { id } });
    revalidatePath("/");
    return;
  }
  if (!att.entry || !canEdit(actor, att.entry.internId)) throw new Error("권한이 없습니다.");
  await prisma.attachment.delete({ where: { id } });
  revalidatePath(`/interns/${att.entry.internId}`);
  if (att.entry.assignmentId) revalidatePath(`/tasks/${att.entry.assignmentId}`);
}

// ---------- mentor → intern claims ----------

export async function addMenteeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const internName = str(fd, "internName");
  if (!internName) return fe("인턴 이름을 입력하세요.");

  const existing = await prisma.mentorMentee.findFirst({
    where: { mentorId: actor.id, internName: { equals: internName, mode: "insensitive" } },
  });
  if (existing) return fe("이미 등록된 인턴입니다.");

  await prisma.mentorMentee.create({ data: { mentorId: actor.id, internName } });
  // 멘토 is a dynamic display label now — no role change on assignment.
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMenteeAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "claimId");
  const claim = await prisma.mentorMentee.findUnique({ where: { id } });
  if (!claim) throw new Error("등록을 찾을 수 없습니다.");
  // The owning mentor may remove their own; 관리자/대표님 may remove any.
  if (claim.mentorId !== actor.id && !isAdminOrBoss(actor)) throw new Error("권한이 없습니다.");
  await prisma.mentorMentee.delete({ where: { id } });
  // An admin unassigning someone else's pairing → let both sides know.
  if (claim.mentorId !== actor.id) {
    const mentor = await prisma.user.findUnique({
      where: { id: claim.mentorId },
      select: { name: true, email: true },
    });
    const intern = await prisma.user.findFirst({
      where: { kind: "INTERN", name: { equals: claim.internName, mode: "insensitive" } },
      select: { name: true, email: true },
    });
    if (mentor) {
      await emailMentorRemoved(
        mentor.name,
        intern?.name ?? claim.internName,
        mentor.email,
        intern?.email ?? null
      );
    }
  }
  revalidatePath("/me");
  revalidatePath("/assign");
  revalidatePath("/");
}

// ---------- admin assignment ----------

/** An admin (관리자/대표님) assigns a mentor to an intern (creates the link and
 * emails both). 멘토 is a dynamic display label, so no role change is made. */
export async function assignMentorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  if (!isAdminOrBoss(actor)) return fe("권한이 없습니다.");
  const mentorId = str(fd, "mentorId");
  const internId = str(fd, "internId");
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  const intern = await prisma.user.findUnique({ where: { id: internId } });
  if (!mentor || mentor.kind !== "STAFF") return fe("멘토를 선택하세요.");
  if (!intern || intern.kind !== "INTERN") return fe("인턴을 선택하세요.");

  // "add" (keep existing mentors, add this one) | "override" (replace all with
  // just this one). The admin chooses in the confirm dialog when the intern
  // already has a mentor.
  const mode = str(fd, "mode") === "override" ? "override" : "add";
  const nameEq = { equals: intern.name, mode: "insensitive" as const };
  const lc = (s: string) => s.trim().toLowerCase();
  const claim = await prisma.mentorMentee.findFirst({ where: { mentorId, internName: nameEq } });
  const nameMatch = intern.mentorNames.some((n) => lc(n) === lc(mentor.name));
  const alreadyPaired = !!claim || nameMatch;

  if (mode === "override") {
    // Collect the intern's current mentors first, so we can send a 담당 해제
    // notice to each one that's being removed.
    const currentClaims = await prisma.mentorMentee.findMany({
      where: { internName: nameEq },
      include: { mentor: { select: { name: true, email: true } } },
    });
    const removed = new Map<string, { name: string; email: string | null }>();
    for (const c of currentClaims) removed.set(lc(c.mentor.name), { name: c.mentor.name, email: c.mentor.email });
    for (const n of intern.mentorNames) {
      if (!removed.has(lc(n))) removed.set(lc(n), { name: n, email: await staffEmailByName(n) });
    }
    // Replace ALL of this intern's mentors (claims + self-typed) with just this one.
    await prisma.mentorMentee.deleteMany({ where: { internName: nameEq } });
    await prisma.user.update({ where: { id: internId }, data: { mentorNames: [] } });
    await prisma.mentorMentee.create({ data: { mentorId, internName: intern.name } });
    // Notify each removed mentor (everyone except the newly-assigned one).
    for (const [k, r] of removed) {
      if (k === lc(mentor.name)) continue;
      await emailMentorRemoved(r.name, intern.name, r.email, intern.email);
    }
  } else {
    if (alreadyPaired) return fe("이미 배정되어 있는 멘토·인턴입니다.");
    await prisma.mentorMentee.create({ data: { mentorId, internName: intern.name } });
  }
  await emailAssignment(
    { name: mentor.name, email: mentor.email },
    { name: intern.name, email: intern.email }
  );
  revalidatePath("/assign");
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

// ---------- comments (public) & messages (private) ----------

async function internExists(internId: string) {
  const u = await prisma.user.findUnique({ where: { id: internId } });
  return u && u.kind === "INTERN" ? u : null;
}

export async function addCommentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const internId = str(fd, "internId");
  const body = str(fd, "body");
  if (!body) return fe("댓글 내용을 입력하세요.");
  if (!(await internExists(internId))) return fe("인턴을 찾을 수 없습니다.");

  await prisma.comment.create({
    data: { internId, authorId: actor.id, authorName: actor.name, body },
  });
  revalidatePath(`/interns/${internId}`);
  return { ok: true };
}

export async function deleteCommentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "commentId");
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new Error("댓글을 찾을 수 없습니다.");
  // The author or the intern (card owner) may delete a comment.
  if (comment.authorId !== actor.id && comment.internId !== actor.id) {
    throw new Error("권한이 없습니다.");
  }
  await prisma.comment.delete({ where: { id } });
  revalidatePath(`/interns/${comment.internId}`);
}

/** Called when an intern card is opened: marks its comments as seen. */
export async function markCardSeenAction(internId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;
  if (actor.id === internId) await markCommentsSeen(actor.id);
  revalidatePath("/");
  revalidatePath(`/interns/${internId}`);
}

/** Called when a conversation is opened: marks its incoming messages read. */
export async function markConversationSeenAction(
  internId: string,
  partnerId: string
): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;
  if (actor.id !== internId && actor.id !== partnerId) return; // not a participant
  await markConversationRead(actor.id, internId, partnerId);
  revalidatePath("/");
  revalidatePath("/messages");
}

export async function sendMessageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const internId = str(fd, "internId");
  const body = str(fd, "body");
  if (!body) return fe("메시지 내용을 입력하세요.");

  const intern = await internExists(internId);
  if (!intern) return fe("인턴을 찾을 수 없습니다.");

  // A thread is (internId, partnerId) where partner is the non-intern side.
  // Messaging is only allowed between a mentor and an intern.
  let partnerId: string;
  let partnerName: string;
  if (actor.id === internId) {
    // Intern replying within an existing thread — partner comes from the form.
    partnerId = str(fd, "partnerId");
    partnerName = str(fd, "partnerName");
    if (!partnerId) return fe("받는 사람을 찾을 수 없습니다.");
    const partner = await prisma.user.findUnique({ where: { id: partnerId }, select: { kind: true } });
    if (!partner || partner.kind !== "STAFF") return fe("관리자에게만 메시지를 보낼 수 있습니다.");
  } else {
    // Someone messaging an intern's card — only an admin may do so.
    if (actor.kind !== "STAFF") return fe("관리자만 인턴에게 메시지를 보낼 수 있습니다.");
    partnerId = actor.id;
    partnerName = actor.name;
  }

  await prisma.message.create({
    data: { internId, partnerId, partnerName, authorId: actor.id, body },
  });
  revalidatePath(`/interns/${internId}`);
  return { ok: true };
}
