"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useT } from "./LangProvider";

/** 기수 filter for 최근 활동 — defaults to the active cohort (so a new cohort
 *  doesn't wade through last year's records); 전체 기수 shows every cohort. */
export function ActivityFilter({
  cohorts,
  selectedCohort,
  defaultCohort,
}: {
  cohorts: { id: string; label: string }[];
  selectedCohort: string;
  defaultCohort: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("cohort", value);
      else next.delete("cohort");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router]
  );

  if (cohorts.length === 0) return null;
  const showReset = selectedCohort !== defaultCohort;

  return (
    <div className="toolbar">
      {/* Only one filter here — cap its width so it doesn't stretch full-page. */}
      <div className="field" style={{ flex: "0 1 260px", maxWidth: 260 }}>
        <label>{t("기수")}</label>
        <select value={selectedCohort} onChange={(e) => setParam(e.currentTarget.value)}>
          <option value="all">{t("전체 기수")}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {showReset && (
        <button type="button" className="btn" onClick={() => router.push(pathname)}>
          {t("필터 초기화")}
        </button>
      )}
    </div>
  );
}
