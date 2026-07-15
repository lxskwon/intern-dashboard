"use client";

import { useActionState } from "react";
import { addUnavailabilityAction, type FormState } from "@/lib/actions";

export function UnavailabilityForm({ userId }: { userId: string }) {
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
          등록되었습니다.
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>시작일</label>
          <input name="startDate" type="date" required />
        </div>
        <div className="field">
          <label>종료일</label>
          <input name="endDate" type="date" required />
        </div>
      </div>
      <div className="field">
        <label>사유 (선택)</label>
        <input name="reason" placeholder="예: 개인 사정, 휴가" />
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "등록 중…" : "부재 일정 추가"}
      </button>
    </form>
  );
}
