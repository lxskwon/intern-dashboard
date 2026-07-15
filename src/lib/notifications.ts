import "server-only";
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
