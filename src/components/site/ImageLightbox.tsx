import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

/**
 * Tap / click / Enter on an article image opens a full-screen viewer with
 * pinch-zoom, double-tap zoom and panning. Loads the full-size original.
 */
export function ImageLightbox({ containerSelector }: { containerSelector: string }) {
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(containerSelector);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    for (const img of imgs) {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", `Expand image${img.alt ? `: ${img.alt}` : ""}`);
      img.classList.add("site-zoomable");
    }
    const show = (img: HTMLImageElement) => {
      opener.current = img;
      setOpen({ src: img.getAttribute("src") || img.currentSrc, alt: img.alt });
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLImageElement && root.contains(t)) show(t);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLImageElement && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        show(t);
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  }, [containerSelector]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "Tab") {
        e.preventDefault();
        closeBtn.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="site-lightbox" role="dialog" aria-modal="true" aria-label={open.alt || "Image viewer"}>
      <button
        ref={closeBtn}
        type="button"
        className="site-lightbox-close"
        onClick={() => setOpen(null)}
        aria-label="Close image viewer"
      >
        ×
      </button>
      <TransformWrapper
        minScale={1}
        maxScale={6}
        centerOnInit
        doubleClick={{ mode: "toggle", step: 1.5 }}
        wheel={{ step: 0.15 }}
      >
        <TransformComponent wrapperClass="site-lightbox-stage" contentClass="site-lightbox-content">
          <img src={open.src} alt={open.alt} className="site-lightbox-img" />
        </TransformComponent>
      </TransformWrapper>
      <p className="site-lightbox-hint">Pinch or double-tap to zoom · drag to move</p>
    </div>,
    document.body,
  );
}
