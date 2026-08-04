"use client";

import { createContext, useContext } from "react";
import { makeT, type Locale, type Translator } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("ko");

export function LangProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Client-side translator hook. */
export function useT(): Translator {
  return makeT(useContext(LocaleContext));
}
