"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/components/LangProvider";

/** 본부 filter for the 구성원 관리 page — updates ?team= so the stats and lists
 *  re-render for the chosen division. */
export function MembersFilter({ teams, selected }: { teams: string[]; selected: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("team", v);
    else params.delete("team");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="field" style={{ maxWidth: 280 }}>
      <label>{t("본부")}</label>
      <select value={selected} onChange={(e) => onChange(e.currentTarget.value)}>
        <option value="">{t("전체 본부")}</option>
        {teams.map((tm) => (
          <option key={tm} value={tm}>
            {tm}
          </option>
        ))}
      </select>
    </div>
  );
}
