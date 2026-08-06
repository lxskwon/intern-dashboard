"use client";

import { useEffect, useState } from "react";

/**
 * Gentle, dismissable nudge shown on an intern's card when they had a 무기록 자동
 * 퇴근. Clicking × dismisses it (remembered in the browser). If a newer 무기록 day
 * happens later, the signature changes and it reappears once — so it never nags
 * about something already acknowledged, but still surfaces new occurrences.
 */
export function NoJournalNotice({
  message,
  signature,
  internId,
  closeLabel,
}: {
  message: string;
  signature: string;
  internId: string;
  closeLabel: string;
}) {
  const [show, setShow] = useState(false);
  const key = `njn-dismissed:${internId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== signature) setShow(true);
    } catch {
      setShow(true);
    }
  }, [key, signature]);

  if (!show) return null;

  return (
    <div className="nojournal-memo">
      <span>⚠️ {message}</span>
      <button
        type="button"
        className="nojournal-x"
        aria-label={closeLabel}
        onClick={() => {
          try {
            localStorage.setItem(key, signature);
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
