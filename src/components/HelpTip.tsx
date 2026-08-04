"use client";

import { useState } from "react";

/** A small "?" that reveals a short explanation on hover / click. */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="help-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="help-tip-btn"
        aria-label={text}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && <span className="help-tip-bubble">{text}</span>}
    </span>
  );
}
