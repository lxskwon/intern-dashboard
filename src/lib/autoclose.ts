import { prisma } from "./db";
import { seoulTodayUTCDate } from "./format";

/**
 * When an intern's internship has ended, their still-ongoing (ACTIVE) tasks are
 * auto-closed as of their 종료일 (인턴 종료 date):
 *   - marked 완료 (COMPLETED), completedAt = 종료일
 *   - 마감일 (expectedDoneDate) filled to the 종료일 **only when none was set**;
 *     an explicitly chosen 마감일 is respected and left untouched.
 *
 * Idempotent and cheap: the query only returns already-ended interns that still
 * have an ACTIVE task, so in the steady state it matches nothing and writes
 * nothing. Safe to call on page load, and it also runs the moment an admin ends
 * someone's internship. Returns how many tasks were closed.
 */
export async function autoCloseEndedInternTasks(): Promise<number> {
  const cutoff = seoulTodayUTCDate(); // UTC-midnight of today's Seoul day
  const ended = await prisma.user.findMany({
    where: {
      kind: "INTERN",
      endDate: { not: null, lt: cutoff }, // 종료일이 오늘보다 이전 = 이미 종료됨
      assignments: { some: { status: "ACTIVE" } },
    },
    select: {
      endDate: true,
      assignments: { where: { status: "ACTIVE" }, select: { id: true, expectedDoneDate: true } },
    },
  });

  let closed = 0;
  for (const intern of ended) {
    const end = intern.endDate!;
    for (const a of intern.assignments) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: {
          status: "COMPLETED",
          completedAt: end,
          expectedDoneDate: a.expectedDoneDate ?? end, // fill only if unset
        },
      });
      closed++;
    }
  }
  return closed;
}
