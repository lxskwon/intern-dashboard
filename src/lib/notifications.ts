import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/** Unread private messages addressed to this user (authored by someone else). */
export async function unreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      authorId: { not: userId },
      OR: [{ internId: userId }, { partnerId: userId }],
    },
  });
}

/** Comments on the intern's own card that arrived since they last looked. */
export async function newCommentCount(
  userId: string,
  seenAt: Date | null | undefined
): Promise<number> {
  return prisma.comment.count({
    where: {
      internId: userId,
      authorId: { not: userId },
      ...(seenAt ? { createdAt: { gt: seenAt } } : {}),
    },
  });
}

/** Emails of the staff who mentor a given intern (by typed name or claim). */
export async function mentorEmailsForIntern(intern: {
  name: string;
  mentorNames: string[];
}): Promise<string[]> {
  const claims = await prisma.mentorMentee.findMany({
    where: { internName: { equals: intern.name, mode: "insensitive" } },
    select: { mentor: { select: { email: true, name: true } } },
  });
  const emails = new Set<string>();
  for (const c of claims) emails.add(c.mentor.email);
  if (intern.mentorNames.length) {
    const named = await prisma.user.findMany({
      where: { kind: "STAFF", name: { in: intern.mentorNames } },
      select: { email: true },
    });
    for (const s of named) emails.add(s.email);
  }
  return [...emails];
}

/** Ids of interns an admin mentors — by matching name, or via a claim. */
async function menteeInternIds(admin: { id: string; name: string }): Promise<string[]> {
  const claims = await prisma.mentorMentee.findMany({
    where: { mentorId: admin.id },
    select: { internName: true },
  });
  const claimedNames = claims.map((c) => c.internName);
  const interns = await prisma.user.findMany({
    where: {
      kind: "INTERN",
      OR: [
        { mentorNames: { has: admin.name } },
        ...(claimedNames.length ? [{ name: { in: claimedNames } }] : []),
      ],
    },
    select: { id: true },
  });
  return interns.map((i) => i.id);
}

// Interns with an unconfirmed work period (dates set but not yet confirmed).
const pendingPeriodWhere = (ids: string[]) => ({
  id: { in: ids },
  periodConfirmed: false,
  OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
});

/** Count of everything from an admin's mentees awaiting confirmation. */
export async function pendingApprovalCount(admin: { id: string; name: string }): Promise<number> {
  const ids = await menteeInternIds(admin);
  if (!ids.length) return 0;
  const [absences, periods, schedules] = await Promise.all([
    prisma.unavailability.count({ where: { status: "PENDING", userId: { in: ids } } }),
    prisma.user.count({ where: pendingPeriodWhere(ids) }),
    prisma.workSchedule.count({ where: { status: "PENDING", userId: { in: ids } } }),
  ]);
  return absences + periods + schedules;
}

/** Everything from an admin's mentees awaiting confirmation, for the approvals list. */
export async function pendingApprovalsFor(admin: { id: string; name: string }) {
  const ids = await menteeInternIds(admin);
  if (!ids.length) return { absences: [], periods: [], schedules: [] };
  const [absences, periods, schedules] = await Promise.all([
    prisma.unavailability.findMany({
      where: { status: "PENDING", userId: { in: ids } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: pendingPeriodWhere(ids),
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { name: "asc" },
    }),
    prisma.workSchedule.findMany({
      where: { status: "PENDING", userId: { in: ids } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { absences, periods, schedules };
}

// Interns with an unconfirmed work period, across everyone (no mentee filter).
const anyPendingPeriodWhere: Prisma.UserWhereInput = {
  kind: "INTERN",
  periodConfirmed: false,
  OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
};

/** Every pending request across ALL interns, for the company-wide requests page. */
export async function allPendingApprovals() {
  const [absences, periods, schedules] = await Promise.all([
    prisma.unavailability.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: anyPendingPeriodWhere,
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { name: "asc" },
    }),
    prisma.workSchedule.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { absences, periods, schedules };
}

/** Total count of pending requests across ALL interns (for the nav badge). */
export async function allPendingApprovalCount(): Promise<number> {
  const [absences, periods, schedules] = await Promise.all([
    prisma.unavailability.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: anyPendingPeriodWhere }),
    prisma.workSchedule.count({ where: { status: "PENDING" } }),
  ]);
  return absences + periods + schedules;
}

/** Mark the messages the user can see on an intern's card as read. */
export async function markThreadRead(userId: string, internId: string): Promise<void> {
  const where =
    userId === internId
      ? { internId, authorId: { not: userId }, readAt: null }
      : { internId, partnerId: userId, authorId: { not: userId }, readAt: null };
  await prisma.message.updateMany({ where, data: { readAt: new Date() } });
}

/** Record that the intern has seen the comments on their own card. */
export async function markCommentsSeen(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { commentsSeenAt: new Date() } });
}

/** Mark a single conversation thread's incoming messages as read. */
export async function markConversationRead(
  userId: string,
  internId: string,
  partnerId: string
): Promise<void> {
  await prisma.message.updateMany({
    where: { internId, partnerId, authorId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}
