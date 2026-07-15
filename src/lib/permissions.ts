/**
 * With no roles, editing is self-service: a person may edit only their own
 * card, tasks, journal entries, schedules, and out-of-office periods. Everyone
 * can view everyone.
 */
export function canEdit(
  actor: { id: string | null } | null,
  targetUserId: string
): boolean {
  return !!actor && actor.id === targetUserId;
}
