"use client";

import { useT } from "@/components/LangProvider";

/** Resets the add-task form and collapses the "+ 업무 추가" dropdown. Labelled
 *  "닫기" to match the other collapsible panels (it does the same thing). */
export function CancelAddTask() {
  const t = useT();
  return (
    <button
      type="button"
      className="btn"
      onClick={(e) => {
        const form = e.currentTarget.closest("form");
        form?.reset();
        const details = e.currentTarget.closest("details");
        if (details) details.open = false;
      }}
    >
      {t("닫기")}
    </button>
  );
}
