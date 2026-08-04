"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

export function CommentForm({ internId }: { internId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCommentAction,
    undefined
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} style={{ marginTop: 12 }}>
      <input type="hidden" name="internId" value={internId} />
      {state?.error && <div className="alert">{state.error}</div>}
      <textarea name="body" placeholder={t("댓글을 남겨보세요…")} required style={{ minHeight: 60 }} />
      <button className="btn btn-primary btn-sm" type="submit" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? t("등록 중…") : t("댓글 등록")}
      </button>
    </form>
  );
}
