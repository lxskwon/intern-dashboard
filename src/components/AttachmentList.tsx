/* eslint-disable @next/next/no-img-element */

export type AttachmentItem = { id: string; kind: string; url: string; name: string | null };

/** Renders task-entry attachments: images inline, files/links as chips. */
export function AttachmentList({ list }: { list: AttachmentItem[] }) {
  if (!list || list.length === 0) return null;
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
