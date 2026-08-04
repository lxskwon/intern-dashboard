"use client";

import { useActionState, useState } from "react";
import { signupAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";
import { PasswordInput } from "@/components/PasswordInput";
import { TeamsPicker } from "@/components/TeamsPicker";

export function SignupForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    signupAction,
    undefined
  );
  const [kind, setKind] = useState<"INTERN" | "STAFF">("INTERN");

  return (
    <form action={formAction}>
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="field">
        <label>{t("구분")}</label>
        <div className="kind-picker">
          <label className="kind-option">
            <input
              type="radio"
              name="kind"
              value="INTERN"
              defaultChecked
              onChange={() => setKind("INTERN")}
            />
            <span>
              <strong>{t("인턴")}</strong>
              <small>{t("내 카드와 업무를 관리해요")}</small>
            </span>
          </label>
          <label className="kind-option">
            <input type="radio" name="kind" value="STAFF" onChange={() => setKind("STAFF")} />
            <span>
              <strong>{t("직원")}</strong>
              <small>{t("인턴을 관리하고 소통해요")}</small>
            </span>
          </label>
        </div>
      </div>
      {kind === "STAFF" && (
        <div className="field">
          <label>{t("본부 (여러 개 선택 가능)")}</label>
          <TeamsPicker />
        </div>
      )}
      <div className="field">
        <label htmlFor="name">{t("이름")}</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">{t("이메일")}</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">{t("비밀번호 (6자 이상)")}</label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="code">{t("액세스 코드")}</label>
        <input id="code" name="code" required placeholder={t("공유받은 코드를 입력")} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ width: "100%" }}>
        {pending ? t("가입 중…") : t("가입하기")}
      </button>
    </form>
  );
}
