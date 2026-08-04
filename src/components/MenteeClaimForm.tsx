"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMenteeAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

export function MenteeClaimForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addMenteeAction,
    undefined
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="inline" style={{ gap: 8, flexWrap: "wrap" }}>
      <input
        name="internName"
        placeholder={t("인턴 이름 (예: 홍길동)")}
        required
        style={{ width: "auto", minWidth: 200 }}
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t("추가 중…") : t("추가")}
      </button>
      {state?.error && (
        <span style={{ color: "#b91c1c", fontSize: 12.5 }}>{state.error}</span>
      )}
    </form>
  );
}
