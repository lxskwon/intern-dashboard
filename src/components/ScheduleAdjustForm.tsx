"use client";

import { useActionState, useState } from "react";
import { addScheduleAdjustAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

/** Add a single-day 출·퇴근 조정 — a late arrival (늦은 출근) or early leave
 *  (이른 퇴근). Needs admin approval, like a 부재. */
export function ScheduleAdjustForm({ userId }: { userId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addScheduleAdjustAction,
    undefined
  );
  const [type, setType] = useState("LATE");

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="userId" value={userId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {t("등록되었습니다. 관리자 승인 후 반영됩니다.")}
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>{t("구분")}</label>
          <select name="adjustType" value={type} onChange={(e) => setType(e.currentTarget.value)}>
            <option value="LATE">{t("늦은 출근")}</option>
            <option value="EARLY">{t("이른 퇴근")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("날짜")}</label>
          <input name="date" type="date" required />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>{type === "EARLY" ? t("퇴근 시각") : t("출근 시각")}</label>
          <input name="adjustTime" type="time" required />
        </div>
        <div className="field">
          <label>{t("사유")}</label>
          <input name="reason" placeholder={t("예: 병원 방문")} />
        </div>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("등록 중…") : t("출·퇴근 조정 추가")}
        </button>
        <CloseDetails />
      </div>
    </form>
  );
}
