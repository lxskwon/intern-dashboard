"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useT } from "./LangProvider";
const STATUS_FILTERS = [
  { key: "WORKING", label: "근무중" },
  { key: "OFF", label: "퇴근" },
  { key: "AWAY", label: "부재중" },
  { key: "ENDED", label: "인턴 종료" },
];

export function Filters({
  teams,
  mentorNames,
  cohorts,
  selectedCohort,
  defaultCohort,
}: {
  teams: string[];
  mentorNames: string[];
  cohorts: { id: string; label: string }[];
  selectedCohort: string;
  defaultCohort: string;
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
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  return (
    <div className="toolbar">
      <div className="field">
        <label>{t("검색")}</label>
        <input
          type="search"
          placeholder={t("이름…")}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.currentTarget.value)}
        />
      </div>
      {cohorts.length > 0 && (
        <div className="field">
          <label>{t("기수")}</label>
          <select
            value={selectedCohort}
            onChange={(e) => setParam("cohort", e.currentTarget.value)}
          >
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
        <label>{t("상태")}</label>
        <select
          defaultValue={params.get("status") ?? ""}
          onChange={(e) => setParam("status", e.currentTarget.value)}
        >
          <option value="">{t("전체 상태")}</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(s.label)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{t("팀")}</label>
        <select
          defaultValue={params.get("team") ?? ""}
          onChange={(e) => setParam("team", e.currentTarget.value)}
        >
          <option value="">{t("전체 팀")}</option>
          {teams.map((tm) => (
            <option key={tm} value={tm}>
              {tm}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{t("멘토")}</label>
        <select
          defaultValue={params.get("mentor") ?? ""}
          onChange={(e) => setParam("mentor", e.currentTarget.value)}
        >
          <option value="">{t("전체 멘토")}</option>
          {mentorNames.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {/* 초기화 shows only when the view differs from the default. A cohort param
          equal to the active (default) cohort doesn't count as a filter. */}
      {(params.get("q") ||
        params.get("status") ||
        params.get("team") ||
        params.get("mentor") ||
        (params.get("cohort") && params.get("cohort") !== defaultCohort)) && (
        <div className="field" style={{ flex: "0 0 auto", minWidth: 0, marginBottom: 0 }}>
          {/* Hidden label spacer + input-height cell so the button centers on
              the filter inputs instead of sitting at their bottom edge. */}
          <label aria-hidden="true" style={{ visibility: "hidden" }}>&nbsp;</label>
          <span className="cohort-btn-cell">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => router.push(pathname)}
            >
              {t("초기화")}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
