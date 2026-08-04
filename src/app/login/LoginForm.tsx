"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form action={formAction}>
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">{t("이메일")}</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">{t("비밀번호")}</label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? t("로그인 중…") : t("로그인")}
      </button>
    </form>
  );
}
