"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useT } from "./LangProvider";

/** Grid / list switch for the dashboard, persisted in the URL. */
export function ViewToggle({ view }: { view: "grid" | "list" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(next: "grid" | "list") {
    const p = new URLSearchParams(params.toString());
    if (next === "grid") p.delete("view");
    else p.set("view", next);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="view-toggle" role="group" aria-label={t("보기 방식")}>
      <button
        type="button"
        className={view === "grid" ? "active" : ""}
        onClick={() => set("grid")}
        aria-pressed={view === "grid"}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
        {t("그리드")}
      </button>
      <button
        type="button"
        className={view === "list" ? "active" : ""}
        onClick={() => set("list")}
        aria-pressed={view === "list"}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
        {t("리스트")}
      </button>
    </div>
  );
}
