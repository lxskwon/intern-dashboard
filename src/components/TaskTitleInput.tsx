"use client";

import { useRef, useState } from "react";
import { searchTasksAction, type TaskSuggestion } from "@/lib/actions";

export function TaskTitleInput() {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await searchTasksAction(v);
      setSuggestions(r);
      setOpen(r.length > 0);
    }, 250);
  }

  return (
    <div className="autocomplete">
      <input
        name="title"
        required
        autoComplete="off"
        placeholder="예: 온보딩 플로우 개편"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="autocomplete-list">
          <div className="autocomplete-hint">
            비슷한 업무가 있어요 — 같은 업무라면 클릭해 이름을 맞춰보세요
          </div>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(s.title);
                setOpen(false);
              }}
            >
              <span className="ac-title">{s.title}</span>
              <span className="ac-intern">{s.internName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
