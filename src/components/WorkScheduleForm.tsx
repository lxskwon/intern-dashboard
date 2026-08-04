"use client";

import { useActionState } from "react";
import { addWorkScheduleAction, type FormState } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/constants";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

/** Add one working-hours block (a set of weekdays + start/end time).
 *  `adminEdit` = an admin is adding it, so it's confirmed immediately. */
export function WorkScheduleForm({ userId, adminEdit = false }: { userId: string; adminEdit?: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addWorkScheduleAction,
    undefined
  );

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="userId" value={userId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {adminEdit ? t("저장했습니다.") : t("근무 시간을 추가했어요. 관리자 확인을 기다리고 있어요.")}
        </div>
      )}
      <div className="field">
        <label>{t("근무 요일")}</label>
        <div className="weekday-picker">
          {WEEKDAYS.map((w, i) => (
            <label key={i} className="weekday-chip">
              <input type="checkbox" name="days" value={i} />
              <span>{w}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>{t("출근 시간")}</label>
          <input name="startTime" type="time" required />
        </div>
        <div className="field">
          <label>{t("퇴근 시간")}</label>
          <input name="endTime" type="time" required />
        </div>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("추가 중…") : t("근무 시간 추가")}
        </button>
        <CloseDetails />
      </div>
    </form>
  );
}
