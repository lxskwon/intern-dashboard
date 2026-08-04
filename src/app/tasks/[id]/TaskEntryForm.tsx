"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTaskEntryAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

export type TaskOption = { id: string; title: string };

/** Add a log entry to an intern's 기록, optionally linked to one of their tasks. */
export function TaskEntryForm({
  internId,
  tasks,
  today,
}: {
  internId: string;
  tasks: TaskOption[];
  today: string;
}) {
  const t = useT();
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
      <input type="hidden" name="internId" value={internId} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {t("기록이 추가되었습니다.")}
        </div>
      )}

      <div className="row">
        <div className="field">
          <label>{t("날짜")}</label>
          <input name="entryDate" type="date" defaultValue={today} />
        </div>
        <div className="field">
          <label>{t("관련 업무 (선택)")}</label>
          <select name="assignmentId" defaultValue="">
            <option value="">{t("연결 안 함")}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t("오늘 한 일")}</label>
        <textarea name="body" placeholder={t("오늘 진행한 내용을 적어주세요.")} />
      </div>
      <div className="row">
        <div className="field">
          <label>{t("파일 / 이미지 첨부 ({n}MB까지)", { n: 4 })}</label>
          <input name="files" type="file" multiple style={{ height: 42 }} />
        </div>
        <div className="field">
          <label>{t("링크 (한 줄에 하나씩)")}</label>
          <textarea name="links" placeholder="https://…" style={{ height: 42, minHeight: 42, resize: "vertical" }} />
        </div>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? t("저장 중…") : t("기록 추가")}
        </button>
        <CloseDetails />
      </div>
    </form>
  );
}
