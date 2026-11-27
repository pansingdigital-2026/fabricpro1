import { format, parseISO } from "date-fns";

export function formatDate(value: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!value) return "";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return "";
  }
}

export function readingTime(html: string | null | undefined, explicit?: number | null): number {
  if (explicit && explicit > 0) return explicit;
  const words = (html ?? "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function excerptFrom(html: string | null | undefined, max = 160): string {
  const text = (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function normalizeComparableText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&(apos|#39|#x27|rsquo|lsquo|#8217|#8216);/gi, "'")
    .replace(/&(rdquo|ldquo|#8220|#8221);/gi, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripLeadingDuplicateExcerpt(
  html: string | null | undefined,
  excerpt: string | null | undefined,
): string {
  if (!html || !excerpt?.trim()) return html ?? "";
  const match = /^(\s*(?:<p\b[^>]*>\s*(?:&nbsp;|<br\s*\/?>)*\s*<\/p>\s*)*)(<p\b[^>]*>[\s\S]*?<\/p>\s*)/i.exec(
    html,
  );
  if (!match?.[2]) return html;
  if (normalizeComparableText(match[2]) !== normalizeComparableText(excerpt)) return html;
  return html.slice(match[0].length).trimStart();
}

export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

export function absoluteUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
