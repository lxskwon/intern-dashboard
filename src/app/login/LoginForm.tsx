"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <form action={formAction}>
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
