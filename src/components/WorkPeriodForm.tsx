"use client";

import { useActionState } from "react";
import { updateWorkPeriodAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

export type WorkPeriodInitial = {
  userId: string;
  startDate: string; // yyyy-mm-dd or ""
  endDate: string;
};

/** Edit the intern's work period (start/end dates). `adminEdit` = an admin is
 *  editing someone else's card, so the change is confirmed immediately. */
export function WorkPeriodForm({
  initial,
  adminEdit = false,
}: {
  initial: WorkPeriodInitial;
  adminEdit?: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateWorkPeriodAction,
    undefined
  );

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="userId" value={initial.userId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {adminEdit ? t("저장했습니다.") : t("저장했어요. 관리자 확인을 기다리고 있어요.")}
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>{t("시작일")}</label>
          <input name="startDate" type="date" defaultValue={initial.startDate} />
        </div>
        <div className="field">
          <label>{t("종료일")}</label>
          <input name="endDate" type="date" defaultValue={initial.endDate} />
        </div>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("저장 중…") : t("근무 기간 저장")}
        </button>
        <CloseDetails />
      </div>
    </form>
  );
}
