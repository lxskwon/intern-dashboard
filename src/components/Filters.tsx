"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
const STATUS_FILTERS = [
  { key: "WORKING", label: "근무중" },
  { key: "OFF", label: "퇴근" },
  { key: "AWAY", label: "부재중" },
  { key: "ENDED", label: "인턴 종료" },
];

export function Filters({
  teams,
  mentorNames,
  projects,
}: {
  teams: string[];
  mentorNames: string[];
  projects: { id: string; name: string }[];
}) {
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
        <label>검색</label>
        <input
          type="search"
          placeholder="이름…"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.currentTarget.value)}
        />
      </div>
      <div className="field">
        <label>상태</label>
        <select
          defaultValue={params.get("status") ?? ""}
          onChange={(e) => setParam("status", e.currentTarget.value)}
        >
          <option value="">전체 상태</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>팀</label>
        <select
          defaultValue={params.get("team") ?? ""}
          onChange={(e) => setParam("team", e.currentTarget.value)}
        >
          <option value="">전체 팀</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>멘토</label>
        <select
          defaultValue={params.get("mentor") ?? ""}
          onChange={(e) => setParam("mentor", e.currentTarget.value)}
        >
          <option value="">전체 멘토</option>
          {mentorNames.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>프로젝트</label>
        <select
          defaultValue={params.get("project") ?? ""}
          onChange={(e) => setParam("project", e.currentTarget.value)}
        >
          <option value="">전체 프로젝트</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {(params.get("q") ||
        params.get("status") ||
        params.get("team") ||
        params.get("mentor") ||
        params.get("project")) && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => router.push(pathname)}
        >
          초기화
        </button>
      )}
    </div>
  );
}
