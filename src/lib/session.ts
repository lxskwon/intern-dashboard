import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
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

/** A view-only session for people who just want to browse without an account. */
export async function createGuestSession(): Promise<void> {
  const token = await new SignJWT({ guest: true })
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
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
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
    if (payload.guest === true) {
      return { isGuest: true, id: null, name: "게스트", kind: "GUEST" };
    }
    const userId = payload.userId;
    if (typeof userId !== "string") return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? { ...user, isGuest: false } : null;
  } catch {
    return null;
  }
}
