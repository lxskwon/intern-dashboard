/**
 * Editing is self-service: a person may edit only their own card, tasks, journal
 * entries, schedules, and out-of-office periods. Admins (관리자/대표님) may also
 * edit intern info and manage tiers/status (checked separately). Everyone views.
 */
export function canEdit(
  actor: { id: string | null } | null,
  targetUserId: string
): boolean {
  return !!actor && actor.id === targetUserId;
}

// ---------- staff role tiers ----------
// Tiers: 인턴(intern) < 직원(STAFF) < 관리자(ADMIN). BOSS is the same tier as
// ADMIN but its 구분 displays as 대표님 (currently only Jimmy). A 직원 who
// currently has ≥1 active assigned intern is DISPLAYED as 멘토 — same powers as
// 직원, label only, and it reverts to 직원 when they have no active mentees.

export type Role = "STAFF" | "ADMIN" | "BOSS";

type RoleUser = { isGuest?: boolean; kind?: string; role?: string | null } | null | undefined;

type LeadUser = { isGuest?: boolean; kind?: string; internLead?: boolean | null } | null | undefined;

/** An 인턴 대표: an intern an admin designated. Their only extra power is posting
 *  공지 to the 인턴 audience. */
export function isInternLead(u: LeadUser): boolean {
  return !!u && !u.isGuest && u.kind === "INTERN" && !!u.internLead;
}

/** May post a 공지: admins (any audience) or an 인턴 대표 (인턴 audience only). */
export function canAnnounce(u: RoleUser & LeadUser): boolean {
  return isAdminOrBoss(u) || isInternLead(u);
}

function staff(u: RoleUser): boolean {
  return !!u && !u.isGuest && u.kind === "STAFF";
}

/** Any staff member (직원/멘토/관리자/대표님). Can view staff profiles; the
 *  management pages (전체 요청/기수/배정/구성원) are admin-only (see below). */
export function isStaff(u: RoleUser): boolean {
  return staff(u);
}

/** 대표님 — a 관리자 whose 구분 displays as 대표님. Same powers as any admin. */
export function isBoss(u: RoleUser): boolean {
  return staff(u) && u!.role === "BOSS";
}

/** Admin tier (관리자 + 대표님): the 관리자 menu (전체 요청, 기수 관리, 배정 관리,
 * 구성원 관리), editing intern info, and changing others' tier/status. 직원/멘토
 * do NOT have any of these. */
export function isAdminOrBoss(u: RoleUser): boolean {
  return staff(u) && (u!.role === "ADMIN" || u!.role === "BOSS");
}

/** Admins (including 대표님) assign mentor↔intern pairings for other people. */
export function canAssign(u: RoleUser): boolean {
  return isAdminOrBoss(u);
}

/** Korean label for the 구분 field / role pill. `isMentor` = this staff member
 * currently has ≥1 active assigned intern (only toggles the 직원 ↔ 멘토 label). */
export function roleLabel(u: RoleUser, isMentor = false): string {
  if (!staff(u)) return "인턴";
  if (u!.role === "BOSS") return "대표님";
  if (u!.role === "ADMIN") return "관리자";
  return isMentor ? "멘토" : "직원";
}
