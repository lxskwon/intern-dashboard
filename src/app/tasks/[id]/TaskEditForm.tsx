"use client";

import { useActionState } from "react";
import { updateAssignmentAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { CloseDetails } from "@/components/CloseDetails";

export type TaskEditInitial = {
  id: string;
  title: string;
  description: string;
  link: string;
  githubUrl: string;
  startDate: string;
  expectedDoneDate: string;
};

export function TaskEditForm({ initial }: { initial: TaskEditInitial }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateAssignmentAction,
    undefined
  );

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="assignmentId" value={initial.id} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {t("저장되었습니다.")}
        </div>
      )}
      <div className="field">
        <label>{t("제목")} *</label>
        <input name="title" defaultValue={initial.title} required />
      </div>
      <div className="field">
        <label>{t("설명")}</label>
        <textarea name="description" defaultValue={initial.description} />
      </div>
      <div className="row">
        <div className="field">
          <label>{t("링크 (티켓 / 문서)")}</label>
          <input name="link" type="url" defaultValue={initial.link} placeholder="https://…" />
        </div>
        <div className="field">
          <label>{t("깃허브")}</label>
          <input
            name="githubUrl"
            type="url"
            defaultValue={initial.githubUrl}
            placeholder="https://github.com/…"
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>{t("시작일")}</label>
          <input name="startDate" type="date" defaultValue={initial.startDate} />
        </div>
        <div className="field">
          <label>{t("완료 예정일 (마감일)")}</label>
          <input name="expectedDoneDate" type="date" defaultValue={initial.expectedDoneDate} />
        </div>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? t("저장 중…") : t("저장")}
        </button>
        <CloseDetails className="btn" />
      </div>
    </form>
  );
}
