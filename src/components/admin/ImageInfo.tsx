import { useEffect, useState } from "react";

import { imageWarnings, type ImageKind } from "@/lib/images";

/** Shows original size, quality warnings and desktop / mobile previews. */
export function ImageInfo({
  url,
  kind,
  mobileUrl,
}: {
  url: string;
  kind: ImageKind;
  mobileUrl?: string | undefined;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!url) return;
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!url) return null;
  const warnings = size ? imageWarnings(size.w, size.h, kind) : [];
  const orientation = size ? (size.w > size.h * 1.05 ? "Landscape" : size.h > size.w * 1.05 ? "Portrait" : "Square") : "";
  const cardStyle = kind === "featured";

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
      <p className="text-muted-foreground">
        {size ? `Original size: ${size.w} × ${size.h}px · ${orientation}` : "Reading image size…"}
      </p>
      {warnings.map((w) => (
        <p key={w} className="rounded bg-destructive/10 px-2 py-1 text-destructive">
          ⚠ {w}
        </p>
      ))}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <p className="mb-1 font-medium text-foreground">Desktop</p>
          <div className={cardStyle ? "aspect-video overflow-hidden rounded bg-muted" : ""}>
            <img src={url} alt="" className={cardStyle ? "h-full w-full object-contain" : "h-auto w-full rounded"} />
          </div>
        </div>
        <div className="w-20 shrink-0">
          <p className="mb-1 font-medium text-foreground">Mobile</p>
          <div className="max-h-48 overflow-hidden rounded-md border-2 border-foreground/70 bg-background p-0.5">
            <div className={cardStyle ? "aspect-video overflow-hidden bg-muted" : ""}>
              <img
                src={mobileUrl || url}
                alt=""
                className={cardStyle ? "h-full w-full object-contain" : "h-auto w-full"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
