"use client";

import { useRef, useState } from "react";
import { searchProjectsAction, type ProjectSuggestion } from "@/lib/actions";

export function ProjectInput({
  defaultName = "",
  defaultId = "",
}: {
  defaultName?: string;
  defaultId?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [pid, setPid] = useState(defaultId);
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setName(v);
    setPid(""); // typing a new value means "new/other project" until a pick
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await searchProjectsAction(v);
      setSuggestions(r);
      setOpen(r.length > 0);
    }, 250);
  }

  return (
    <div className="autocomplete">
      <input
        name="projectName"
        autoComplete="off"
        placeholder="프로젝트 이름 (선택)"
        value={name}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <input type="hidden" name="projectId" value={pid} />
      {open && suggestions.length > 0 && (
        <div className="autocomplete-list">
          <div className="autocomplete-hint">기존 프로젝트에 연결하려면 선택하세요</div>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault();
                setName(s.name);
                setPid(s.id);
                setOpen(false);
              }}
            >
              <span className="ac-title">{s.name}</span>
              <span className="ac-intern">{s.count}개 업무</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
