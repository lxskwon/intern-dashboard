"use client";

import { useState } from "react";
import { TEAMS } from "@/lib/constants";

/**
 * Multi-select for 본부 (teams). Each chosen 본부 is its own dropdown that shows
 * the selected team; a "본부 추가" button adds another dropdown. Duplicate picks
 * are prevented (a team already chosen elsewhere is hidden from other dropdowns).
 * Submits one hidden `teams` input per non-empty selection.
 */
export function TeamsPicker({ initial = [] }: { initial?: string[] }) {
  const [rows, setRows] = useState<string[]>(initial.length ? initial : [""]);

  const setRow = (i: number, v: string) => setRows((rs) => rs.map((r, idx) => (idx === i ? v : r)));
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : [""]));
  const addRow = () => setRows((rs) => [...rs, ""]);

  // Keep the "본부 추가" button until there are as many dropdowns as teams
  // (i.e. nothing left to add) — even if a dropdown is still unfilled.
  const canAddMore = rows.length < TEAMS.length;

  return (
    <div className="teams-picker">
      {rows.map((row, i) => {
        const taken = new Set(rows.filter((_, idx) => idx !== i).filter(Boolean));
        const opts = TEAMS.filter((tm) => !taken.has(tm));
        return (
          <div className="teams-picker-row" key={i}>
            <select value={row} onChange={(e) => setRow(i, e.currentTarget.value)}>
              <option value="">선택</option>
              {opts.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
            {(rows.length > 1 || row) && (
              <button
                type="button"
                className="teams-picker-x"
                aria-label="삭제"
                onClick={() => removeRow(i)}
              >
                ×
              </button>
            )}
            {i === rows.length - 1 && canAddMore && (
              <button type="button" className="btn btn-sm" onClick={addRow}>
                + 본부 추가
              </button>
            )}
          </div>
        );
      })}
      {rows.filter(Boolean).map((tm, i) => (
        <input key={i} type="hidden" name="teams" value={tm} />
      ))}
    </div>
  );
}
