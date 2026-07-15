"use client";

import { useActionState } from "react";
import { updateWorkPeriodAction, type FormState } from "@/lib/actions";

export type WorkPeriodInitial = {
  userId: string;
  startDate: string; // yyyy-mm-dd or ""
  endDate: string;
};

/** Edit the intern's work period (start/end dates). */
export function WorkPeriodForm({ initial }: { initial: WorkPeriodInitial }) {
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
          저장되었습니다.
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>시작일</label>
          <input name="startDate" type="date" defaultValue={initial.startDate} />
        </div>
        <div className="field">
          <label>종료일</label>
          <input name="endDate" type="date" defaultValue={initial.endDate} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "저장 중…" : "근무 기간 저장"}
      </button>
    </form>
  );
}
