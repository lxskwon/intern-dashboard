"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";

/**
 * A password field with a show/hide (eye) toggle. Accepts all the usual
 * <input> props (id, name, autoComplete, minLength, required, …); the `type`
 * is controlled here.
 */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  const [show, setShow] = useState(false);
  const label = show ? t("비밀번호 숨기기") : t("비밀번호 표시");

  return (
    <div className="password-field">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={label}
        title={label}
        tabIndex={-1}
      >
        {show ? (
          // password revealed → plain eye
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          // password hidden → eye with slash
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
