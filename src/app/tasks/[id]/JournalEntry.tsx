"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTaskEntryAction,
  deleteTaskEntryAction,
  deleteAttachmentAction,
  type FormState,
} from "@/lib/actions";

type Attachment = { id: string; kind: string; url: string; name: string | null };
export type JournalEntryData = {
  id: string;
  entryDate: string; // yyyy-mm-dd
  body: string | null;
  authorName: string;
  attachments: Attachment[];
};

function Attachments({ list }: { list: Attachment[] }) {
  if (list.length === 0) return null;
  return (
    <div className="attachments">
      {list.map((a) =>
        a.kind === "IMAGE" ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
            <img className="attach-img" src={a.url} alt={a.name ?? ""} />
          </a>
        ) : (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="attach-link">
            {a.kind === "LINK" ? "🔗" : "📎"} {a.name ?? a.url}
          </a>
        )
      )}
    </div>
  );
}

export function JournalEntry({ entry, mine }: { entry: JournalEntryData; mine: boolean }) {
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
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <span className="journal-author">{entry.authorName}</span>
        {mine && !editing && (
          <span className="inline">
            <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
              수정
            </button>
            <form action={deleteTaskEntryAction}>
              <input type="hidden" name="entryId" value={entry.id} />
              <button type="submit" className="btn btn-sm btn-danger">
                삭제
              </button>
            </form>
          </span>
        )}
      </div>

      {!editing ? (
        <>
          {entry.body && <p className="journal-body">{entry.body}</p>}
          <Attachments list={entry.attachments} />
        </>
      ) : (
        <form action={formAction} style={{ marginTop: 8, maxWidth: 560 }}>
          <input type="hidden" name="entryId" value={entry.id} />
          {state?.error && <div className="alert">{state.error}</div>}
          <div className="field">
            <label>날짜</label>
            <input name="entryDate" type="date" defaultValue={entry.entryDate} />
          </div>
          <div className="field">
            <label>내용</label>
            <textarea name="body" defaultValue={entry.body ?? ""} />
          </div>
          {entry.attachments.length > 0 && (
            <div className="field">
              <label>기존 첨부</label>
              <div className="pill-row">
                {entry.attachments.map((a) => (
                  <span key={a.id} className="task-pill">
                    {a.kind === "LINK" ? "🔗" : a.kind === "IMAGE" ? "🖼️" : "📎"}{" "}
                    {a.name ?? a.url}
                    <button
                      type="button"
                      className="pill-x"
                      aria-label="첨부 삭제"
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
              <label>파일 / 이미지 추가</label>
              <input name="files" type="file" multiple />
            </div>
            <div className="field">
              <label>링크 추가 (한 줄에 하나씩)</label>
              <textarea name="links" placeholder="https://…" style={{ minHeight: 44 }} />
            </div>
          </div>
          <div className="inline">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
