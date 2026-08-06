"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 무기록 자동 퇴근 chip whose 기록 was backfilled late. Click to reveal a small
 * black popup with the 보강 date (× to close). Also closes on an outside click
 * and automatically when the intern's dropdown (<details>) is collapsed.
 */
export function BackfillChip({
  label,
  tip,
  closeLabel,
}: {
  label: string;
  tip: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const det = ref.current?.closest("details");
    if (!det) return;
    const onToggle = () => {
      if (!(det as HTMLDetailsElement).open) setOpen(false);
    };
    det.addEventListener("toggle", onToggle);
    return () => det.removeEventListener("toggle", onToggle);
  }, []);

  return (
    <span
      ref={ref}
      className="attend-chip nojournal has-tip"
      role="button"
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      {label}
      {open && (
        <span className="backfill-pop" onClick={(e) => e.stopPropagation()}>
          <span>{tip}</span>
          <button
            type="button"
            className="backfill-pop-x"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}
