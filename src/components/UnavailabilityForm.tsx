"use client";

import { useActionState } from "react";
import { addUnavailabilityAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

export function UnavailabilityForm({ userId }: { userId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addUnavailabilityAction,
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
          {t("등록되었습니다. 관리자 승인 후 반영됩니다.")}
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>{t("시작일")}</label>
          <input name="startDate" type="date" required />
        </div>
        <div className="field">
          <label>{t("종료일")}</label>
          <input name="endDate" type="date" required />
        </div>
      </div>
      <div className="field">
        <label>{t("사유")} *</label>
        <input
          name="reason"
          required
          placeholder={t("예: 개인 사정, 휴가")}
          onInvalid={(e) => e.currentTarget.setCustomValidity(t("사유를 입력하세요."))}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
        />
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("등록 중…") : t("부재 일정 추가")}
        </button>
        <CloseDetails />
      </div>
    </form>
  );
}
