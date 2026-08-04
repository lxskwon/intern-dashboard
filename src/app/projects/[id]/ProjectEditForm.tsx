"use client";

import { useActionState } from "react";
import { updateProjectAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

export type ProjectInitial = {
  id: string;
  name: string;
  lead: string;
  description: string;
  startDate: string;
  dueDate: string;
};

export function ProjectEditForm({ initial }: { initial: ProjectInitial }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProjectAction,
    undefined
  );

  return (
    <form action={formAction} style={{ maxWidth: 560 }}>
      <input type="hidden" name="projectId" value={initial.id} />
      {state?.error && <div className="alert">{state.error}</div>}
      {state?.ok && (
        <div
          className="alert"
          style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
          {t("저장되었습니다.")}
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>{t("프로젝트 이름 *")}</label>
          <input name="name" defaultValue={initial.name} required />
        </div>
        <div className="field">
          <label>{t("담당자")}</label>
          <input name="lead" defaultValue={initial.lead} placeholder={t("담당자 이름")} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>{t("시작일")}</label>
          <input name="startDate" type="date" defaultValue={initial.startDate} />
        </div>
        <div className="field">
          <label>{t("마감일")}</label>
          <input name="dueDate" type="date" defaultValue={initial.dueDate} />
        </div>
      </div>
      <div className="field">
        <label>{t("설명")}</label>
        <textarea name="description" defaultValue={initial.description} placeholder={t("프로젝트 설명")} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("저장 중…") : t("저장")}
      </button>
    </form>
  );
}
