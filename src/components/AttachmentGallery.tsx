"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";

export type AttachmentItem = { id: string; kind: string; url: string; name: string | null };

/**
 * Renders entry attachments: non-images as chips, images as uniform square
 * thumbnails (cropped). Clicking a thumbnail opens a full-screen lightbox with
 * prev/next arrows and ←/→/Esc keyboard control (Twitter-style).
 */
export function AttachmentGallery({
  list,
  caption,
}: {
  list: AttachmentItem[];
  caption?: string;
}) {
  const images = list.filter((a) => a.kind === "IMAGE");
  const files = list.filter((a) => a.kind !== "IMAGE");
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  // Clamp at the ends (no wrap-around) so spamming an arrow doesn't loop back
  // and make it seem like you've moved into another entry's photos.
  const prev = useCallback(() => setIndex((i) => (i === null ? i : Math.max(i - 1, 0))), []);
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : Math.min(i + 1, images.length - 1))),
    [images.length]
  );

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, close, prev, next]);

  if (!list || list.length === 0) return null;

  const current = index === null ? null : images[index];

  return (
    <div className="attachments">
      {files.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="attach-link">
          {a.kind === "LINK" ? "🔗" : "📎"} {a.name ?? a.url}
        </a>
      ))}

      {images.length > 0 && (
        <div className="photo-grid">
          {images.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="photo-thumb"
              onClick={() => setIndex(i)}
              aria-label={a.name ?? "사진 보기"}
            >
              <img src={a.url} alt={a.name ?? ""} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <button className="lightbox-close" onClick={close} aria-label="닫기">
            ×
          </button>
          {images.length > 1 && (
            <button
              className="lightbox-nav prev"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="이전 사진"
            >
              ‹
            </button>
          )}
          <img
            className="lightbox-img"
            src={current.url}
            alt={current.name ?? ""}
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <button
              className="lightbox-nav next"
              disabled={index === images.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="다음 사진"
            >
              ›
            </button>
          )}
          {caption && (
            <div className="lightbox-caption" onClick={(e) => e.stopPropagation()}>
              {caption}
            </div>
          )}
          {images.length > 1 && (
            <div className="lightbox-count" onClick={(e) => e.stopPropagation()}>
              {index! + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
