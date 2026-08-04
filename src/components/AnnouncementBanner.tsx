"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { deleteAnnouncementAction } from "@/lib/actions";

type Att = { id: string; kind: string; url: string; name: string | null };

export type BannerAnnouncement = {
  id: string;
  body: string;
  audience: string;
  team: string | null;
  authorName: string;
  attachments: Att[];
};

/** One announcement banner. Bold/prominent by design. Admins get 수정 (inline
 *  edit) and 삭제 controls. */
export function AnnouncementBanner({
  a,
  isAdmin,
  canManage = isAdmin,
  internOnly = false,
  audienceLabel,
  dateStr,
  teams,
}: {
  a: BannerAnnouncement;
  isAdmin: boolean;
  /** May 수정/삭제 this banner (admins any; an 인턴 대표 their own). */
  canManage?: boolean;
  /** Edit form locks the audience to 인턴 (for an 인턴 대표). */
  internOnly?: boolean;
  audienceLabel: string;
  dateStr: string;
  teams: string[];
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="card card-pad announce-banner">
        <AnnouncementForm
          teams={teams}
          internOnly={internOnly}
          initial={{ id: a.id, body: a.body, audience: a.audience, team: a.team, attachments: a.attachments }}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="card card-pad announce-banner">
      <div className="announce-content">
        <div className="announce-head">
          <span className="announce-pin" aria-hidden>📢</span>
          <div className="announce-body">{a.body}</div>
        </div>
        {a.attachments.length > 0 && (
          <div className="announce-attachments">
            <AttachmentGallery list={a.attachments} />
          </div>
        )}
        <div className="announce-meta">
          {isAdmin && <span className="announce-audience">{audienceLabel}</span>}
          <span>
            {a.authorName} · {dateStr}
          </span>
        </div>
      </div>
      {canManage && (
        <div className="announce-actions">
          <button type="button" className="announce-edit" onClick={() => setEditing(true)}>
            {t("수정")}
          </button>
          <form action={deleteAnnouncementAction}>
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="announce-x" aria-label={t("삭제")}>
              ×
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
