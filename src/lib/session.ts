import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { isEnded } from "./format";
import type { User } from "@prisma/client";

const COOKIE_NAME = "intern_dash_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-insecure-secret-please-change-me"
);

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
} as const;

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, COOKIE_OPTS);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * Returns the logged-in user, or null. NOTE: a guest (view-only) session also
 * returns null here — that is intentional, so every action guarded by
 * requireUser()/canEdit() automatically rejects guests. Use getViewer() to tell
 * a guest apart from a logged-out visitor for view purposes.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    if (typeof userId !== "string") return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    // 탈퇴 accounts lose access immediately.
    return user && !user.withdrawnAt ? user : null;
  } catch {
    return null;
  }
}

/**
 * Whether a staff member currently has ≥1 active assigned intern — used to
 * display their 구분 as 멘토 (vs 직원). "Active" = an intern who isn't withdrawn
 * and whose work period hasn't ended. A link exists if the intern lists this
 * person in mentorNames, or via an explicit MentorMentee claim.
 */
export async function hasActiveMentees(staffId: string, staffName: string): Promise<boolean> {
  const all = await prisma.user.findMany({
    where: { kind: "INTERN" },
    select: { name: true, mentorNames: true, endDate: true, withdrawnAt: true },
  });
  // "Active" = not withdrawn and internship not yet ended (same rule everywhere).
  const activeInterns = all.filter((i) => !i.withdrawnAt && !isEnded(i.endDate));
  const lname = staffName.toLowerCase();
  if (activeInterns.some((i) => i.mentorNames.some((m) => m.toLowerCase() === lname))) return true;
  const claims = await prisma.mentorMentee.findMany({
    where: { mentorId: staffId },
    select: { internName: true },
  });
  if (!claims.length) return false;
  const activeNames = new Set(activeInterns.map((i) => i.name.toLowerCase()));
  return claims.some((c) => activeNames.has(c.internName.toLowerCase()));
}

/** An intern whose internship has ended. Such interns are "frozen": they can
 *  only see their own card and their own 기수 (cohort) — no other cohorts, other
 *  pages, or new updates/announcements. */
export function isFrozenIntern(
  u: { kind?: string | null; endDate?: Date | null } | null | undefined
): boolean {
  return !!u && u.kind === "INTERN" && isEnded(u.endDate);
}

/** A guest viewer: browsing without an account, no edit rights. */
export type GuestViewer = { isGuest: true; id: null; name: string; kind: "GUEST" };
/** Anyone who may view the app: a real user or a guest. */
export type Viewer = (User & { isGuest: false }) | GuestViewer;

/** Returns the viewer (real user OR guest), or null if not logged in at all. */
export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    if (typeof userId !== "string") return null; // e.g. a legacy guest token
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.withdrawnAt) return null; // 탈퇴 accounts lose access
    return { ...user, isGuest: false };
  } catch {
    return null;
  }
}
