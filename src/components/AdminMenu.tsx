"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type AdminMenuItem = { href: string; label: string; badge?: number };

/** Admin-only dropdown in the topbar (left of the 한/영 toggle) that groups the
 *  management pages: 전체 요청 · 기수 관리 · 배정 관리 · 구성원 관리. */
export function AdminMenu({ label, items }: { label: string; items: AdminMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const totalBadge = items.reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <div className="admin-menu" ref={ref}>
      <button
        type="button"
        className={`admin-menu-btn${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        {totalBadge > 0 && (
          <span className="notif-badge static" style={{ marginLeft: 6 }}>
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
        <span className="admin-menu-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="admin-menu-pop">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="admin-menu-item" onClick={() => setOpen(false)}>
              <span>{it.label}</span>
              {it.badge ? (
                <span className="notif-badge static">{it.badge > 99 ? "99+" : it.badge}</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
