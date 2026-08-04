"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  deleteAttachmentAction,
  type FormState,
} from "@/lib/actions";
import { useT } from "@/components/LangProvider";

type Att = { id: string; kind: string; url: string; name: string | null };

export type AnnouncementInitial = {
  id: string;
  body: string;
  audience: string;
  team: string | null;
  attachments: Att[];
};

/** Shared 공지 form — create (no `initial`) or edit (with `initial`). Supports
 *  파일/이미지 첨부 and 링크 추가, mirroring the 기록 일지 layout. */
export function AnnouncementForm({
  teams,
  initial,
  onDone,
  internOnly = false,
}: {
  teams: string[];
  initial?: AnnouncementInitial;
  onDone?: () => void;
  /** 인턴 대표 mode: audience is locked to 인턴, no selector. */
  internOnly?: boolean;
}) {
  const t = useT();
  const editing = !!initial;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    editing ? updateAnnouncementAction : createAnnouncementAction,
    undefined
  );
  const [audience, setAudience] = useState(initial?.audience ?? "ALL");

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  return (
    <div className="announce-form">
      {/* Existing attachments (edit mode) — each its own form so it isn't
          nested inside the main form. */}
      {editing && initial!.attachments.length > 0 && (
        <div className="field" style={{ marginBottom: 10 }}>
          <label>{t("기존 첨부")}</label>
          <div className="pill-row">
            {initial!.attachments.map((a) => (
              <span key={a.id} className="task-pill">
                {a.kind === "LINK" ? "🔗" : a.kind === "IMAGE" ? "🖼️" : "📎"} {a.name ?? a.url}
                <form action={deleteAttachmentAction} style={{ display: "inline" }}>
                  <input type="hidden" name="attachmentId" value={a.id} />
                  <button type="submit" className="pill-x" aria-label={t("첨부 삭제")}>
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        </div>
      )}

      <form action={formAction}>
        {editing && <input type="hidden" name="id" value={initial!.id} />}
        {state?.error && <div className="alert">{state.error}</div>}
        <div className="field">
          <label>{t("공지 내용")}</label>
          <textarea
            name="body"
            required
            defaultValue={initial?.body ?? ""}
            placeholder={t("공지 내용을 입력하세요.")}
            style={{ minHeight: 84 }}
          />
        </div>
        {internOnly ? (
          <>
            <input type="hidden" name="audience" value="INTERN" />
            <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
              {t("이 공지는 인턴에게만 표시됩니다.")}
            </p>
          </>
        ) : (
          <div className="field">
            <label>{t("대상")}</label>
            <select name="audience" value={audience} onChange={(e) => setAudience(e.currentTarget.value)}>
              <option value="ALL">{t("전체")}</option>
              <option value="STAFF">{t("직원")}</option>
              <option value="INTERN">{t("인턴")}</option>
              <option value="TEAM">{t("본부별")}</option>
            </select>
          </div>
        )}
        {!internOnly && audience === "TEAM" && (
          <div className="field">
            <label>{t("본부")}</label>
            <select name="team" required defaultValue={initial?.team ?? ""}>
              <option value="" disabled>
                {t("선택")}
              </option>
              {teams.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row">
          <div className="field">
            <label>{t("파일 / 이미지 첨부 ({n}MB까지)", { n: 4 })}</label>
            <input name="files" type="file" multiple style={{ height: 42 }} />
          </div>
          <div className="field">
            <label>{t("링크 (한 줄에 하나씩)")}</label>
            <textarea
              name="links"
              placeholder="https://…"
              style={{ height: 42, minHeight: 42, resize: "vertical" }}
            />
          </div>
        </div>
        <div className="inline" style={{ gap: 8 }}>
          <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
            {pending ? (editing ? t("저장 중…") : t("게시 중…")) : editing ? t("저장") : t("게시")}
          </button>
          {onDone && (
            <button type="button" className="btn btn-sm" onClick={onDone}>
              {t("닫기")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
