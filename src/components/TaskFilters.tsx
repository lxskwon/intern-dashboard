"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useT } from "./LangProvider";

/** Filter bar for 모든 업무 — narrow the task list by 기수, 담당 인턴 or 본부 (team).
 *  Team filtering matches any task whose intern belongs to that 본부. */
export function TaskFilters({
  cohorts,
  interns,
  teams,
  selectedCohort,
  selectedIntern,
  selectedTeam,
  showReset,
}: {
  cohorts: { id: string; label: string }[];
  interns: { id: string; name: string }[];
  teams: string[];
  selectedCohort: string;
  selectedIntern: string;
  selectedTeam: string;
  showReset: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router]
  );

  return (
    <div className="toolbar">
      {cohorts.length > 0 && (
        <div className="field">
          <label>{t("기수")}</label>
          <select value={selectedCohort} onChange={(e) => setParam("cohort", e.currentTarget.value)}>
            <option value="all">{t("전체 기수")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>{t("담당 인턴")}</label>
        <select value={selectedIntern} onChange={(e) => setParam("intern", e.currentTarget.value)}>
          <option value="">{t("전체 인턴")}</option>
          {interns.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{t("본부")}</label>
        <select value={selectedTeam} onChange={(e) => setParam("team", e.currentTarget.value)}>
          <option value="">{t("전체 본부")}</option>
          {teams.map((tm) => (
            <option key={tm} value={tm}>
              {tm}
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
