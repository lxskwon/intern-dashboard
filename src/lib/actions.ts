"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { createSession, createGuestSession, destroySession, getCurrentUser } from "./session";
import { canEdit } from "./permissions";
import { saveUpload } from "./uploads";
import { taskTokens } from "./text";
import { markCommentsSeen, markConversationRead } from "./notifications";

// ---------- helpers ----------

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
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

// ---------- auth ----------

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Enter as a view-only guest — no signup, no edit rights. */
export async function guestLoginAction(): Promise<void> {
  await createGuestSession();
  redirect("/");
}

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const code = str(fd, "code");
  const expected = process.env.SIGNUP_CODE ?? "";
  if (!expected || code !== expected) {
    return { error: "액세스 코드가 올바르지 않습니다." };
  }

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!name || !email || !password) return { error: "이름, 이메일, 비밀번호를 모두 입력하세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "이미 해당 이메일의 사용자가 있습니다." };

  const kind = str(fd, "kind") === "STAFF" ? "STAFF" : "INTERN";
  const user = await prisma.user.create({
    data: { name, email, kind, passwordHash: await bcrypt.hash(password, 10) },
  });

  await createSession(user.id);
  // Staff have no card; send them to the dashboard.
  redirect(kind === "STAFF" ? "/" : `/interns/${user.id}`);
}

// ---------- profile / card ----------

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const targetId = str(fd, "userId");
  if (!canEdit(actor, targetId)) return { error: "권한이 없습니다." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  if (!name) return { error: "이름을 입력하세요." };
  if (!email) return { error: "이메일을 입력하세요." };

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.id !== targetId) {
    return { error: "이미 해당 이메일의 사용자가 있습니다." };
  }

  await prisma.user.update({
    where: { id: targetId },
    data: {
      name,
      email,
      team: optStr(fd, "team"),
      mentorName: optStr(fd, "mentorName"),
    },
  });

  revalidatePath("/");
  revalidatePath(`/interns/${targetId}`);
  return { ok: true };
}

export async function updateWorkPeriodAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const targetId = str(fd, "userId");
  if (!canEdit(actor, targetId)) return { error: "권한이 없습니다." };

  await prisma.user.update({
    where: { id: targetId },
    data: {
      startDate: optDate(fd, "startDate"),
      endDate: optDate(fd, "endDate"),
    },
  });

  revalidatePath("/");
  revalidatePath(`/interns/${targetId}`);
  return { ok: true };
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
  if (!canEdit(actor, userId)) return { error: "권한이 없습니다." };

  const days = fd
    .getAll("days")
    .map((d) => String(d))
    .filter((d) => /^[0-6]$/.test(d));
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");

  if (!days.length) return { error: "근무 요일을 하나 이상 선택하세요." };
  if (!startTime || !endTime) return { error: "근무 시작·종료 시간을 입력하세요." };
  if (endTime < startTime) return { error: "종료 시간은 시작 시간보다 빠를 수 없습니다." };

  await prisma.workSchedule.create({
    data: { userId, days: days.join(","), startTime, endTime },
  });

  revalidatePath("/");
  revalidatePath(`/interns/${userId}`);
  return { ok: true };
}

export async function deleteWorkScheduleAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "scheduleId");
  const sched = await prisma.workSchedule.findUnique({ where: { id } });
  if (!sched) throw new Error("일정을 찾을 수 없습니다.");
  if (!canEdit(actor, sched.userId)) throw new Error("권한이 없습니다.");

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

  const projectId = await resolveProject(str(fd, "projectId"), str(fd, "projectName"));

  await prisma.assignment.create({
    data: {
      internId,
      title,
      description: optStr(fd, "description"),
      link: optStr(fd, "link"),
      startDate: optDate(fd, "startDate"),
      expectedDoneDate: optDate(fd, "expectedDoneDate"),
      assignedById: actor.id,
      projectId,
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
  if (!id) return { error: "프로젝트를 찾을 수 없습니다." };
  if (!name) return { error: "프로젝트 이름을 입력하세요." };

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
  if (!a) return { error: "업무를 찾을 수 없습니다." };
  if (a.internId !== actor.id) return { error: "권한이 없습니다." };

  const title = str(fd, "title");
  if (!title) return { error: "제목을 입력하세요." };

  await prisma.assignment.update({
    where: { id: a.id },
    data: {
      title,
      description: optStr(fd, "description"),
      link: optStr(fd, "link"),
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
  if (!canEdit(actor, userId)) return { error: "권한이 없습니다." };

  const start = optDate(fd, "startDate");
  const end = optDate(fd, "endDate");
  if (!start || !end) return { error: "시작일과 종료일을 입력하세요." };
  if (end < start) return { error: "종료일은 시작일보다 빠를 수 없습니다." };

  await prisma.unavailability.create({
    data: { userId, startDate: start, endDate: end, reason: optStr(fd, "reason") },
  });
  revalidatePath("/calendar");
  revalidatePath(`/interns/${userId}`);
  revalidatePath("/");
  return { ok: true };
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

export async function addTaskEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const assignmentId = str(fd, "assignmentId");
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || !canEdit(actor, assignment.internId)) {
    return { error: "권한이 없거나 업무를 찾을 수 없습니다." };
  }

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
    return { error: "내용, 파일, 또는 링크 중 하나 이상을 추가하세요." };
  }

  await prisma.taskEntry.create({
    data: {
      assignmentId,
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

  revalidatePath(`/tasks/${assignmentId}`);
  revalidatePath(`/interns/${assignment.internId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTaskEntryAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "entryId");
  const entry = await prisma.taskEntry.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!entry) throw new Error("기록을 찾을 수 없습니다.");
  if (!canEdit(actor, entry.assignment.internId)) throw new Error("권한이 없습니다.");

  await prisma.taskEntry.delete({ where: { id } });
  revalidatePath(`/tasks/${entry.assignmentId}`);
  revalidatePath("/activity");
  revalidatePath("/");
}

export async function updateTaskEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const id = str(fd, "entryId");
  const entry = await prisma.taskEntry.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!entry) return { error: "기록을 찾을 수 없습니다." };
  if (!canEdit(actor, entry.assignment.internId)) return { error: "권한이 없습니다." };

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
      attachments: {
        create: [
          ...saved.map((s) => ({ kind: s.isImage ? "IMAGE" : "FILE", url: s.url, name: s.name })),
          ...links.map((url) => ({ kind: "LINK", url, name: url })),
        ],
      },
    },
  });
  revalidatePath(`/tasks/${entry.assignmentId}`);
  revalidatePath("/activity");
  revalidatePath(`/interns/${entry.assignment.internId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAttachmentAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "attachmentId");
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { entry: { include: { assignment: true } } },
  });
  if (!att) throw new Error("첨부를 찾을 수 없습니다.");
  if (!canEdit(actor, att.entry.assignment.internId)) throw new Error("권한이 없습니다.");
  await prisma.attachment.delete({ where: { id } });
  revalidatePath(`/tasks/${att.entry.assignmentId}`);
}

// ---------- mentor → intern claims ----------

export async function addMenteeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser();
  const internName = str(fd, "internName");
  if (!internName) return { error: "인턴 이름을 입력하세요." };

  const existing = await prisma.mentorMentee.findFirst({
    where: { mentorId: actor.id, internName: { equals: internName, mode: "insensitive" } },
  });
  if (existing) return { error: "이미 등록된 인턴입니다." };

  await prisma.mentorMentee.create({ data: { mentorId: actor.id, internName } });
  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMenteeAction(fd: FormData): Promise<void> {
  const actor = await requireUser();
  const id = str(fd, "claimId");
  const claim = await prisma.mentorMentee.findUnique({ where: { id } });
  if (!claim) throw new Error("등록을 찾을 수 없습니다.");
  if (claim.mentorId !== actor.id) throw new Error("권한이 없습니다.");
  await prisma.mentorMentee.delete({ where: { id } });
  revalidatePath("/me");
  revalidatePath("/");
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
  if (!body) return { error: "댓글 내용을 입력하세요." };
  if (!(await internExists(internId))) return { error: "인턴을 찾을 수 없습니다." };

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
  if (!body) return { error: "메시지 내용을 입력하세요." };

  const intern = await internExists(internId);
  if (!intern) return { error: "인턴을 찾을 수 없습니다." };

  // A thread is (internId, partnerId) where partner is the non-intern side.
  // Messaging is only allowed between a mentor and an intern.
  let partnerId: string;
  let partnerName: string;
  if (actor.id === internId) {
    // Intern replying within an existing thread — partner comes from the form.
    partnerId = str(fd, "partnerId");
    partnerName = str(fd, "partnerName");
    if (!partnerId) return { error: "받는 사람을 찾을 수 없습니다." };
    const partner = await prisma.user.findUnique({ where: { id: partnerId }, select: { kind: true } });
    if (!partner || partner.kind !== "STAFF") return { error: "멘토에게만 메시지를 보낼 수 있습니다." };
  } else {
    // Someone messaging an intern's card — only a mentor may do so.
    if (actor.kind !== "STAFF") return { error: "멘토만 인턴에게 메시지를 보낼 수 있습니다." };
    partnerId = actor.id;
    partnerName = actor.name;
  }

  await prisma.message.create({
    data: { internId, partnerId, partnerName, authorId: actor.id, body },
  });
  revalidatePath(`/interns/${internId}`);
  return { ok: true };
}
