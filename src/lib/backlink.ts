/**
 * Context-aware back links.
 *
 * Any page that can be reached from multiple places ("여러 접근 방법") should link
 * IN with `?back=<the source's own path + query>`. The destination then renders a
 * back link that returns exactly there — not to a hardcoded default. The label is
 * derived from a single route→name map below (reusing the existing nav
 * translations), and the source's query string is preserved automatically so
 * filters/scroll state survive the round trip.
 *
 * Usage on a destination page:
 *   const back = one(sp.back);
 *   const { href, label } = resolveBack(t, back, {
 *     href: `/interns/${id}`,            // natural parent (fallback)
 *     label: t("← {name} 카드로", { name }),
 *   });
 *   <Link href={href}>{label}</Link>
 *
 * Usage on a source page (link INTO a detail page):
 *   href={`/tasks/${id}?back=${encodeURIComponent(backHref)}`}
 */

type T = (key: string, params?: Record<string, string | number>) => string;

// Source route → its nav name (a key that already has an EN translation). The
// back label is "← " + that name. Ordered longest/most-specific first.
const ROUTE_NAMES: { test: RegExp; key: string }[] = [
  { test: /^\/projects(?:$|[/?#])/, key: "모든 업무" },
  { test: /^\/activity(?:$|[/?#])/, key: "최근 활동" },
  { test: /^\/members(?:$|[/?#])/, key: "구성원 관리" },
  { test: /^\/cohorts(?:$|[/?#])/, key: "기수 관리" },
  { test: /^\/attendance(?:$|[/?#])/, key: "출퇴근 관리" },
  { test: /^\/approvals(?:$|[/?#])/, key: "전체 요청" },
  { test: /^\/assign(?:$|[/?#])/, key: "배정 관리" },
  { test: /^\/me(?:$|[/?#])/, key: "내 계정" },
  { test: /^\/$/, key: "대시보드" },
];

/**
 * Resolve a `?back=` param into a `{ href, label }`. Falls back to the page's
 * natural parent when there's no (or an unrecognized/unsafe) back param.
 */
export function resolveBack(
  t: T,
  back: string | undefined,
  fallback: { href: string; label: string }
): { href: string; label: string } {
  // Only internal absolute paths; guard against open-redirect via "//host".
  if (!back || !back.startsWith("/") || back.startsWith("//")) return fallback;
  const path = back.split(/[?#]/)[0];
  const match = ROUTE_NAMES.find((r) => r.test.test(path));
  if (!match) return fallback;
  const name = match.key === "대시보드" ? t("대시보드로 돌아가기") : t(match.key);
  return { href: back, label: `← ${name}` };
}
