"use client";

import { useEffect, useRef } from "react";

/**
 * Stops Enter from implicitly submitting the surrounding form from any single-
 * line field — so a task is only ever added by clicking the submit button.
 * Textareas keep their normal newline behavior.
 */
export function NoEnterSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "Enter" && el && el.tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    };
    form.addEventListener("keydown", handler);
    return () => form.removeEventListener("keydown", handler);
  }, []);
  return <span ref={ref} hidden aria-hidden="true" />;
}
