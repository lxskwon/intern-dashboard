"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTaskEntryAction, type FormState } from "@/lib/actions";

export function TaskEntryForm({
  assignmentId,
  today,
}: {
  assignmentId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addTaskEntryAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="entry-form">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          기록이 추가되었습니다.
        </div>
      )}

      <div className="field">
        <label>날짜</label>
        <input name="entryDate" type="date" defaultValue={today} />
      </div>
      <div className="field">
        <label>오늘 한 일</label>
        <textarea name="body" placeholder="오늘 진행한 내용을 적어주세요." />
      </div>
      <div className="row">
        <div className="field">
          <label>파일 / 이미지 첨부</label>
          <input name="files" type="file" multiple />
        </div>
        <div className="field">
          <label>링크 (한 줄에 하나씩)</label>
          <textarea name="links" placeholder="https://…" style={{ minHeight: 44 }} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "저장 중…" : "기록 추가"}
      </button>
    </form>
  );
}
