"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

type Img = { id: string; url: string; name: string | null };
// A "tile" is one cell in a justified row: a single image, or a vertical stack
// of wide "strip" images. aeff = the tile's effective aspect (width/height).
type Tile = { imgs: Img[]; aeff: number };

// Justified gallery ("tetris"). Wide "strip" screenshots are pulled out so they
// never squish the content photos:
//  - 1 content photo + strips → content sits beside a stack of the strips.
//  - 2+ content photos + strips → strips stack full-width on top, content photos
//    fill their own row(s) below so they render large.
// Every row fills the width exactly (no gaps); aspect ratios preserved.
const TARGET_H = 195; // preferred row height (px)
const MAX_H = 360; // cap so a sparse row can't blow up
const GAP = 6;
const STRIP = 2.8; // aspect >= this = a wide "strip"

export function ReportPhotos({ images }: { images: Img[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [asp, setAsp] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setWidth(el.clientWidth);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    for (const im of images) {
      const img = new window.Image();
      img.onload = () => setAsp((p) => ({ ...p, [im.id]: img.naturalWidth / img.naturalHeight || 1.5 }));
      img.onerror = () => setAsp((p) => ({ ...p, [im.id]: 1.5 }));
      img.src = im.url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = width > 0 && images.every((im) => asp[im.id]);

  let rows: Tile[][] = [];
  if (ready) {
    const invSum = (ims: Img[]) => ims.reduce((s, im) => s + 1 / asp[im.id], 0);
    const single = (im: Img): Tile => ({ imgs: [im], aeff: asp[im.id] });

    // Chunk strips into vertical stacks of 2 (an odd leftover makes one stack of 3).
    const stripTiles = (strs: Img[]): Tile[] => {
      const t: Tile[] = [];
      let k = 0;
      let n = strs.length;
      while (n >= 2) {
        const size = n === 3 ? 3 : 2;
        const c = strs.slice(k, k + size);
        t.push({ imgs: c, aeff: 1 / invSum(c) });
        k += size;
        n -= size;
      }
      if (n === 1) t.push(single(strs[k]));
      return t;
    };

    // Balance-partition tiles into rows that each fill the width; fold a too-sparse
    // trailing row back so nothing dangles.
    const justify = (tiles: Tile[]): Tile[][] => {
      const out: Tile[][] = [];
      if (!tiles.length) return out;
      const T = tiles.reduce((s, t) => s + t.aeff, 0);
      // Preferred rows by height, but cap at ~3 tiles per row so 4 photos always
      // break into a 2×2 grid rather than one squished row.
      const R = Math.min(tiles.length, Math.max(1, Math.round((T * TARGET_H) / width), Math.ceil(tiles.length / 3)));
      const per = T / R;
      let cur: Tile[] = [];
      let sum = 0;
      for (const t of tiles) {
        // Close the current row BEFORE adding this tile if the row is already
        // closer to the per-row target than it would be with the tile added —
        // this balances rows (e.g. 4 photos → 2+2, not 3+1) instead of overshooting.
        if (cur.length && out.length < R - 1 && Math.abs(sum - per) <= Math.abs(sum + t.aeff - per)) {
          out.push(cur);
          cur = [];
          sum = 0;
        }
        cur.push(t);
        sum += t.aeff;
      }
      if (cur.length) out.push(cur);
      while (out.length > 1) {
        const last = out[out.length - 1];
        const ls = last.reduce((s, t) => s + t.aeff, 0);
        if (ls < width / MAX_H) {
          out[out.length - 2] = out[out.length - 2].concat(last);
          out.pop();
        } else break;
      }
      return out;
    };

    const strips = images.filter((im) => asp[im.id] >= STRIP);
    const content = images.filter((im) => asp[im.id] < STRIP);

    if (content.length <= 1) {
      // content (if any) sits beside the strip stack(s)
      rows = justify([...content.map(single), ...stripTiles(strips)]);
    } else if (strips.length) {
      // strips stacked full-width on top, content photos big below
      rows = [...justify(stripTiles(strips)), ...justify(content.map(single))];
    } else {
      rows = justify(content.map(single));
    }
  }

  return (
    <div className="report-photos" ref={ref}>
      {ready ? (
        rows.map((row, ri) => {
          const Aeff = row.reduce((s, t) => s + t.aeff, 0);
          const kTerm = row.reduce((s, t) => s + t.aeff * (t.imgs.length - 1), 0);
          const hGaps = GAP * (row.length - 1);
          const H = Math.min(MAX_H, (width - hGaps + GAP * kTerm) / Aeff);
          return (
            <div className="report-photo-row" key={ri}>
              {row.map((t, ti) => {
                const tileW = t.aeff * (H - (t.imgs.length - 1) * GAP);
                if (t.imgs.length === 1) {
                  const im = t.imgs[0];
                  return <img key={im.id} className="report-photo" src={im.url} alt={im.name ?? ""} style={{ width: tileW, height: H }} />;
                }
                return (
                  <div key={ti} className="report-photo-stack" style={{ width: tileW, height: H }}>
                    {/* Reverse so the later strip sits on top and the first below. */}
                    {[...t.imgs].reverse().map((im) => (
                      <img key={im.id} className="report-photo" src={im.url} alt={im.name ?? ""} style={{ width: tileW, height: tileW / asp[im.id] }} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })
      ) : (
        <div className="report-photo-row">
          {images.map((im) => (
            <img key={im.id} className="report-photo" src={im.url} alt={im.name ?? ""} style={{ height: 150 }} />
          ))}
        </div>
      )}
    </div>
  );
}
