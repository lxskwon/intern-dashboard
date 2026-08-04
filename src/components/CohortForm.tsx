"use client";

import { useActionState } from "react";
import { createCohortAction, type FormState } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

const TERMS = ["봄", "여름", "가을", "겨울"];

/** Admin form to create a new cohort (기수); the new one becomes active. */
export function CohortForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createCohortAction,
    undefined
  );
  const thisYear = new Date().getFullYear();

  return (
    <form action={formAction}>
      {state?.error && <div className="alert">{state.error}</div>}
      <div className="inline" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 120, marginBottom: 0 }}>
          <label>{t("연도")}</label>
          <input name="year" type="number" min={2000} max={2100} defaultValue={thisYear} required />
        </div>
        <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
          <label>{t("시즌")}</label>
          <select name="term" defaultValue="">
            <option value="" disabled>
              {t("선택")}
            </option>
            {TERMS.map((term) => (
              <option key={term} value={term}>
                {t(term)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          {/* Hidden label spacer + input-height cell so the small button sits
              centered against the 연도/시즌 input boxes */}
          <label aria-hidden="true" style={{ visibility: "hidden" }}>&nbsp;</label>
          <span className="cohort-btn-cell">
            <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
              {pending ? t("추가 중…") : t("기수 추가")}
            </button>
          </span>
        </div>
      </div>
    </form>
  );
}
