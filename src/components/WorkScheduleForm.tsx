"use client";

import { useActionState } from "react";
import { addWorkScheduleAction, type FormState } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/constants";

/** Add one working-hours block (a set of weekdays + start/end time). */
export function WorkScheduleForm({ userId }: { userId: string }) {
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
          근무 시간이 추가되었습니다.
        </div>
      )}
      <div className="field">
        <label>근무 요일</label>
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
          <label>출근 시간</label>
          <input name="startTime" type="time" required />
        </div>
        <div className="field">
          <label>퇴근 시간</label>
          <input name="endTime" type="time" required />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "추가 중…" : "근무 시간 추가"}
      </button>
    </form>
  );
}
