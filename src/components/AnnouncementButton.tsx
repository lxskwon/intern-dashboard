"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { AnnouncementForm } from "@/components/AnnouncementForm";

/** Admin "공지 작성" button — opens the shared form to post an announcement to a
 *  chosen audience (전체 / 직원 / 인턴 / 본부별), with 첨부/링크. */
export function AnnouncementButton({
  teams,
  internOnly = false,
}: {
  teams: string[];
  internOnly?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="announce-wrap">
      <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
        📢 {internOnly ? t("공지 작성 (인턴)") : t("공지 작성")}
      </button>
      {open && <AnnouncementForm teams={teams} internOnly={internOnly} onDone={() => setOpen(false)} />}
    </div>
  );
}
