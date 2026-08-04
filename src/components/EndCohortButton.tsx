"use client";

import { endActiveCohortAction } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

/**
 * 종료 button shown on the active cohort's summary. Ends it (and auto-activates
 * the next cohort). stopPropagation keeps the click from toggling the <details>.
 */
export function EndCohortButton({ cohortId }: { cohortId: string }) {
  const t = useT();
  return (
    <form
      action={endActiveCohortAction}
      style={{ display: "inline" }}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        if (!confirm(t("현재 기수를 종료할까요? 다음 기수가 있으면 자동으로 활성화됩니다."))) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="cohortId" value={cohortId} />
      <button
        type="submit"
        className="btn btn-sm btn-danger"
        onClick={(e) => e.stopPropagation()}
      >
        {t("종료")}
      </button>
    </form>
  );
}
