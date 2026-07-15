"use client";

import { useActionState } from "react";
import { signupAction, type FormState } from "@/lib/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    signupAction,
    undefined
  );

  return (
    <form action={formAction}>
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="field">
        <label>구분</label>
        <div className="kind-picker">
          <label className="kind-option">
            <input type="radio" name="kind" value="INTERN" defaultChecked />
            <span>
              <strong>인턴</strong>
              <small>내 카드와 업무를 관리해요</small>
            </span>
          </label>
          <label className="kind-option">
            <input type="radio" name="kind" value="STAFF" />
            <span>
              <strong>멘토</strong>
              <small>인턴을 조회하고 소통해요</small>
            </span>
          </label>
        </div>
      </div>
      <div className="field">
        <label htmlFor="name">이름</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">비밀번호 (6자 이상)</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="code">액세스 코드</label>
        <input id="code" name="code" required placeholder="공유받은 코드를 입력" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? "가입 중…" : "가입하기"}
      </button>
    </form>
  );
}
