"use client";

import { useEffect, useRef, useState } from "react";
import { searchTasksAction, type TaskSuggestion } from "@/lib/actions";
import { useT } from "@/components/LangProvider";

export function TaskTitleInput() {
  const t = useT();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear this (controlled) field when the surrounding form is reset — so
  // Cancel / a successful add wipes the title along with the other fields.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setValue("");
      setSuggestions([]);
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

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
        ref={inputRef}
        name="title"
        required
        autoComplete="off"
        placeholder={t("예: 슬라이드 자동 생성 기능 개발")}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        // Enter here would submit the form (accidentally adding the task).
        // Suggestions already appear as you type, so just close the dropdown.
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="autocomplete-list">
          <div className="autocomplete-hint">
            {t("비슷한 업무가 있어요 — 같은 업무라면 클릭해 이름을 맞춰보세요")}
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
