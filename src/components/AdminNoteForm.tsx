"use client";

import { useActionState } from "react";
import { updateAdminNoteAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

/** Admin-only memo pad on an intern's card (referrer, private comments, …). */
export function AdminNoteForm({ userId, initial }: { userId: string; initial: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateAdminNoteAction,
    undefined
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      {state?.error && <div className="alert">{state.error}</div>}
      <textarea
        name="adminNote"
        defaultValue={initial}
        rows={4}
        placeholder={t("예: 추천인, 기타 참고사항 등…")}
      />
      <div
        className="inline"
        style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}
      >
        {state?.ok ? (
          <span style={{ fontSize: 12, color: "#15803d" }}>{t("저장되었습니다.")}</span>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
          {pending ? t("저장 중…") : t("메모 저장")}
        </button>
      </div>
    </form>
  );
}
