import "server-only";
import { cookies } from "next/headers";
import { type Locale, makeT, type Translator } from "./i18n";

const COOKIE = "lang";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v === "en" ? "en" : "ko";
}

/** Server-side translator for the current request's locale. */
export async function getT(): Promise<Translator> {
  return makeT(await getLocale());
}
