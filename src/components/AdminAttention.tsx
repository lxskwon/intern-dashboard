import Link from "next/link";
import { getT, getLocale } from "@/lib/i18n-server";
import { fmtShort } from "@/lib/format";

type Mini = { id: string; name: string; endDate?: Date | string | null };

/** Admin-only "needs attention" panel on the dashboard: interns with no mentor,
 *  and interns whose internship ends within a week. Renders nothing if clear. */
export async function AdminAttention({
  unassigned,
  endingSoon,
  leadMissing = false,
}: {
  unassigned: Mini[];
  endingSoon: Mini[];
  /** A 인턴 대표 was designated before but none is currently active. */
  leadMissing?: boolean;
}) {
  if (!unassigned.length && !endingSoon.length && !leadMissing) return null;
  const t = await getT();
  const locale = await getLocale();

  return (
    <div className="card card-pad section admin-attention">
      <h2 className="section-title">🔔 {t("관리자 관심 필요")}</h2>
      {leadMissing && (
        <p className="attention-notice">
          🧑‍💼 {t("현재 인턴 대표가 없습니다. 인턴 대표를 새로 지정해주세요.")}{" "}
          <Link href="/members" className="attention-notice-link">
            {t("구성원 관리 →")}
          </Link>
        </p>
      )}
      <div className="attention-groups">
      {unassigned.length > 0 && (
        <div className="attention-group">
          <span className="attention-label">{t("멘토 미배정 ({n})", { n: unassigned.length })}</span>
          <span className="pill-row">
            {unassigned.map((i) => (
              <Link key={i.id} href={`/interns/${i.id}`} className="task-pill">
                {i.name}
              </Link>
            ))}
          </span>
        </div>
      )}
      {endingSoon.length > 0 && (
        <div className="attention-group">
          <span className="attention-label warn">
            {t("종료 임박 · 1주 이내 ({n})", { n: endingSoon.length })}
          </span>
          <span className="pill-row">
            {endingSoon.map((i) => (
              <Link key={i.id} href={`/interns/${i.id}`} className="task-pill">
                {i.name}
                {i.endDate ? ` · ${fmtShort(i.endDate, locale)}` : ""}
              </Link>
            ))}
          </span>
        </div>
      )}
      </div>
    </div>
  );
}
