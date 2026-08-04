"use client";

import { useT } from "@/components/LangProvider";

/** Opens the browser print dialog (→ "Save as PDF"). Hidden when printing. */
export function PrintButton() {
  const t = useT();
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      🖨️ {t("인쇄 / PDF로 저장")}
    </button>
  );
}
