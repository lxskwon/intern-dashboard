"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessageAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

export function MessageForm({
  internId,
  partnerId,
  partnerName,
  placeholder,
}: {
  internId: string;
  partnerId?: string;
  partnerName?: string;
  placeholder?: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    sendMessageAction,
    undefined
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="message-form">
      <input type="hidden" name="internId" value={internId} />
      {partnerId && <input type="hidden" name="partnerId" value={partnerId} />}
      {partnerName && <input type="hidden" name="partnerName" value={partnerName} />}
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="message-compose">
        <input name="body" placeholder={placeholder ?? t("메시지 입력…")} required autoComplete="off" />
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
          {pending ? t("전송…") : t("전송")}
        </button>
      </div>
    </form>
  );
}
