"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/** Grid / list switch for the dashboard, persisted in the URL. */
export function ViewToggle({ view }: { view: "grid" | "list" }) {
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
    <div className="view-toggle" role="group" aria-label="보기 방식">
      <button
        type="button"
        className={view === "grid" ? "active" : ""}
        onClick={() => set("grid")}
        aria-pressed={view === "grid"}
      >
        ▦ 그리드
      </button>
      <button
        type="button"
        className={view === "list" ? "active" : ""}
        onClick={() => set("list")}
        aria-pressed={view === "list"}
      >
        ☰ 리스트
      </button>
    </div>
  );
}
