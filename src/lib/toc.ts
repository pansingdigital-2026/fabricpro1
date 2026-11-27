import { slugify } from "./format";

export interface TocEntry {
  id: string;
  text: string;
}

const TOC_TYPES = new Set(["blog", "blogs", "playbook", "playbooks", "insight", "insights"]);
const UPDATES_TYPES = new Set(["update", "updates", "news"]);

export function isUpdatesType(typeSlug: string | null | undefined): boolean {
  return UPDATES_TYPES.has((typeSlug ?? "").trim().toLowerCase());
}

export function shouldShowArticleToc(
  typeSlug: string | null | undefined,
  settingEnabled: boolean,
): boolean {
  if (!settingEnabled) return false;
  return TOC_TYPES.has((typeSlug ?? "").trim().toLowerCase());
}

/**
 * Adds stable ids to every <h2> in the article body and returns the
 * "On this page" entries built from them. Pure string work so it runs on the
 * server during SSR as well as in the browser.
 */
export function withHeadingIds(html: string | null | undefined): {
  html: string;
  toc: TocEntry[];
} {
  const source = html ?? "";
  const toc: TocEntry[] = [];
  const used = new Set<string>();

  const out = source.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (match, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!text) return match;

      const existing = /\sid=["']([^"']+)["']/i.exec(attrs)?.[1];
      let id = existing || slugify(text) || `section-${toc.length + 1}`;
      let n = 2;
      while (used.has(id)) id = `${id}-${n++}`;
      used.add(id);
      toc.push({ id, text });

      const cleaned = attrs.replace(/\sid=["'][^"']*["']/i, "");
      return `<h2${cleaned} id="${id}">${inner}</h2>`;
    },
  );

  return { html: out, toc };
}
