"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useT } from "./LangProvider";

/** Filter bar for 모든 업무 — narrow the task list by 담당 인턴 or by 본부 (team).
 *  Team filtering matches any task whose intern belongs to that 본부. */
export function TaskFilters({
  interns,
  teams,
  selectedIntern,
  selectedTeam,
}: {
  interns: { id: string; name: string }[];
  teams: string[];
  selectedIntern: string;
  selectedTeam: string;
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

  const hasFilter = selectedIntern !== "" || selectedTeam !== "";

  return (
    <div className="toolbar">
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
      {hasFilter && (
        <button type="button" className="btn" onClick={() => router.push(pathname)}>
          {t("필터 초기화")}
        </button>
      )}
    </div>
  );
}
