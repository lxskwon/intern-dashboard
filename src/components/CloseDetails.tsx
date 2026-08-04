"use client";

import { useT } from "@/components/LangProvider";

/** A "닫기" button that collapses the nearest enclosing <details>. Placed next
 *  to a 저장 button so it's clear the panel can be dismissed once saved. */
export function CloseDetails({ className = "btn btn-sm" }: { className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        const d = e.currentTarget.closest("details");
        if (d) d.open = false;
      }}
    >
      {t("닫기")}
    </button>
  );
}
