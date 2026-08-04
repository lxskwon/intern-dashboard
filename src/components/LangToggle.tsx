"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LangProvider";
import { setLocaleAction } from "@/lib/actions";
import type { Locale } from "@/lib/i18n";

/** 한 / A language switch. */
export function LangToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (l: Locale) => {
    if (l === locale) return;
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  };

  return (
    <div className="lang-toggle" role="group" aria-label="Language" data-pending={pending}>
      <button
        type="button"
        className={locale === "ko" ? "active" : ""}
        onClick={() => pick("ko")}
        aria-pressed={locale === "ko"}
        title="한국어"
      >
        한
      </button>
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        onClick={() => pick("en")}
        aria-pressed={locale === "en"}
        title="English"
      >
        A
      </button>
    </div>
  );
}
