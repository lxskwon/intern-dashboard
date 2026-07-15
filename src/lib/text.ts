/** Break a task title into comparable key terms (drops 1-char noise). */
export function taskTokens(s: string): string[] {
  return Array.from(
    new Set(
      s
        .toLowerCase()
        .split(/[^0-9a-z가-힣]+/i)
        .filter((t) => t.length >= 2)
    )
  );
}

/** How many key terms two task titles share. */
export function relatedScore(a: string, b: string): number {
  const ta = new Set(taskTokens(a));
  let n = 0;
  for (const t of taskTokens(b)) if (ta.has(t)) n += 1;
  return n;
}
