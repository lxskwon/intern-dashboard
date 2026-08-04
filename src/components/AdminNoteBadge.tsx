"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A small sticky-note icon shown next to an intern's name on the dashboard
 * (admins only). Hover or click reveals the full admin memo. The bubble is
 * rendered in a portal so it stays fully visible even over a dimmed (인턴 종료)
 * card, whose opacity would otherwise fade it.
 */
export function AdminNoteBadge({ note }: { note: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
  };
  const close = () => setPos(null);

  return (
    <span className="note-badge" onMouseEnter={open} onMouseLeave={close}>
      <button
        ref={ref}
        type="button"
        className="note-badge-btn"
        aria-label={note}
        title=""
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pos) close();
          else open();
        }}
      >
        📝
      </button>
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            className="note-badge-bubble"
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1000 }}
          >
            {note}
          </span>,
          document.body
        )}
    </span>
  );
}
