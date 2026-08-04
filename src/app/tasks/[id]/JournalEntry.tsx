"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTaskEntryAction,
  deleteTaskEntryAction,
  deleteAttachmentAction,
  type FormState,
} from "@/lib/actions";
import { useT, useLocale } from "@/components/LangProvider";
import { fmtDate } from "@/lib/format";
import { BodyText } from "@/components/BodyText";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import type { TaskOption } from "./TaskEntryForm";

type Attachment = { id: string; kind: string; url: string; name: string | null };
export type JournalEntryData = {
  id: string;
  entryDate: string; // yyyy-mm-dd
  body: string | null;
  attachments: Attachment[];
  assignmentId: string | null;
  taskTitle: string | null;
};

export function JournalEntry({
  entry,
  mine,
  tasks = [],
  showTaskLink = true,
}: {
  entry: JournalEntryData;
  mine: boolean;
  tasks?: TaskOption[];
  showTaskLink?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const galleryCaption = [
    fmtDate(entry.entryDate, locale),
    entry.taskTitle ? `📌 ${entry.taskTitle}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateTaskEntryAction,
    undefined
  );
  const [removing, startRemove] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  function removeAttachment(attachmentId: string) {
    startRemove(async () => {
      const fd = new FormData();
      fd.set("attachmentId", attachmentId);
      await deleteAttachmentAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="journal-entry">
      {!editing ? (
        <>
          {/* Actions float to the top-right so the body text starts at the top
              and wraps to their left, instead of the buttons reserving a line. */}
          {mine && (
            <span className="journal-actions">
              <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
                {t("수정")}
              </button>
              <form action={deleteTaskEntryAction} style={{ display: "inline-flex" }}>
                <input type="hidden" name="entryId" value={entry.id} />
                <button type="submit" className="btn btn-sm btn-danger">
                  {t("삭제")}
                </button>
              </form>
            </span>
          )}
          {showTaskLink && entry.assignmentId && entry.taskTitle && (
            <Link href={`/tasks/${entry.assignmentId}`} className="entry-task-link">
              📌 {entry.taskTitle}
            </Link>
          )}
          {entry.body && (
            <div className="journal-body">
              <BodyText text={entry.body} />
            </div>
          )}
          <AttachmentGallery list={entry.attachments} caption={galleryCaption} />
        </>
      ) : (
        <form action={formAction} style={{ marginTop: 8, maxWidth: 560 }}>
          <input type="hidden" name="entryId" value={entry.id} />
          {state?.error && <div className="alert">{state.error}</div>}
          <div className="row">
            <div className="field">
              <label>{t("날짜")}</label>
              <input name="entryDate" type="date" defaultValue={entry.entryDate} />
            </div>
            <div className="field">
              <label>{t("관련 업무 (선택)")}</label>
              <select name="assignmentId" defaultValue={entry.assignmentId ?? ""}>
                <option value="">{t("연결 안 함")}</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>{t("내용")}</label>
            <textarea name="body" defaultValue={entry.body ?? ""} />
          </div>
          {entry.attachments.length > 0 && (
            <div className="field">
              <label>{t("기존 첨부")}</label>
              <div className="pill-row">
                {entry.attachments.map((a) => (
                  <span key={a.id} className="task-pill">
                    {a.kind === "LINK" ? "🔗" : a.kind === "IMAGE" ? "🖼️" : "📎"}{" "}
                    {a.name ?? a.url}
                    <button
                      type="button"
                      className="pill-x"
                      aria-label={t("첨부 삭제")}
                      disabled={removing}
                      onClick={() => removeAttachment(a.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <div className="field">
              <label>{t("파일 / 이미지 추가")}</label>
              <input name="files" type="file" multiple />
            </div>
            <div className="field">
              <label>{t("링크 추가 (한 줄에 하나씩)")}</label>
              <textarea name="links" placeholder="https://…" style={{ minHeight: 44 }} />
            </div>
          </div>
          <div className="inline">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? t("저장 중…") : t("저장")}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              {t("취소")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
