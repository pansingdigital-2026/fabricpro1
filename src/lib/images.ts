/**
 * Responsive image helpers. Smaller WebP copies of uploads are saved next to
 * the original as `<name>-w<width>.webp`. If a copy is missing (older uploads),
 * the server falls back to the original file, so URLs never break.
 */
export const VARIANT_WIDTHS = [480, 768, 1200, 1600, 2048] as const;

const LOCAL_UPLOAD = /^\/uploads\/(\d{4})\/([0-9a-f-]{36})\.(jpe?g|png|webp|avif)$/i;

export function isLocalUpload(url: string | null | undefined): url is string {
  return !!url && LOCAL_UPLOAD.test(url);
}

export function variantUrl(url: string, width: number): string {
  const m = LOCAL_UPLOAD.exec(url);
  if (!m) return url;
  return `/uploads/${m[1]}/${m[2]}-w${width}.webp`;
}

/** Widths to generate for an image of the given natural width (never upscale). */
export function variantWidthsFor(naturalWidth: number): number[] {
  return VARIANT_WIDTHS.filter((w) => w < naturalWidth);
}

/** Build a srcset string. Includes the original as the largest candidate. */
export function srcSetFor(url: string | null | undefined, naturalWidth?: number | null): string | undefined {
  if (!isLocalUpload(url)) return undefined;
  const widths = naturalWidth ? variantWidthsFor(naturalWidth) : [...VARIANT_WIDTHS];
  const parts = widths.map((w) => `${variantUrl(url, w)} ${w}w`);
  parts.push(`${url} ${naturalWidth ?? 2560}w`);
  return parts.join(", ");
}

export type ImageKind = "featured" | "standard" | "infographic";

/** Plain-English quality warnings shown in the admin. */
export function imageWarnings(w: number, h: number, kind: ImageKind): string[] {
  const out: string[] = [];
  if (!w || !h) return out;
  if (kind === "infographic") {
    if (w < 1600) out.push(`Only ${w}px wide — small text may be hard to read. Aim for 2048px wide.`);
    if (w / h > 1.4)
      out.push("Wide infographic: text will look tiny on phones. Consider adding a mobile version (tall layout).");
  } else if (w < 1200) {
    out.push(`Only ${w}px wide — may look blurry on large screens. Aim for at least 1200px (ideally 2048px).`);
  }
  return out;
}

const ATTR = (name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
function getAttr(tag: string, name: string): string | undefined {
  const m = ATTR(name).exec(tag);
  return m ? (m[2] ?? m[3]) : undefined;
}

/** Add lazy loading, srcset/sizes and mobile <picture> sources to article body images. */
export function enhanceBodyImages(html: string): string {
  if (!html) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let out = tag.replace(/\/?>$/, "");
    const src = getAttr(tag, "src");
    const width = Number(getAttr(tag, "width")) || undefined;
    if (!getAttr(tag, "loading")) out += ' loading="lazy"';
    if (!getAttr(tag, "decoding")) out += ' decoding="async"';
    const set = getAttr(tag, "srcset") ? undefined : srcSetFor(src, width);
    if (set) out += ` srcset="${set}" sizes="(max-width: 767px) 100vw, 760px"`;
    out += ">";
    const mobile = getAttr(tag, "data-mobile-src");
    if (mobile) {
      const mSet = srcSetFor(mobile) ?? mobile;
      return `<picture><source media="(max-width: 767px)" srcset="${mSet}" sizes="100vw">${out}</picture>`;
    }
    return out;
  });
}
