/**
 * Strict allowlist HTML sanitizer that runs identically in Node SSR and the
 * browser without requiring a DOM. Strips dangerous tags, event handlers,
 * inline styles, and unsafe URL schemes while preserving editorial formatting,
 * tables, callouts, and responsive <picture>/<img> markup.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "code", "pre", "blockquote", "q", "cite", "abbr",
  "ul", "ol", "li", "dl", "dt", "dd",
  "a", "img", "figure", "figcaption", "picture", "source",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "details", "summary", "section", "article", "aside", "header", "footer", "nav",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "source", "col"]);

const GLOBAL_ATTRS = new Set(["id", "class", "title", "dir", "lang", "aria-label", "aria-hidden"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set([
    "src", "srcset", "sizes", "alt", "width", "height",
    "loading", "decoding", "data-kind", "data-mobile-src",
  ]),
  source: new Set(["src", "srcset", "sizes", "type", "media"]),
  td: new Set(["colspan", "rowspan", "scope"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "type"]),
  details: new Set(["open"]),
};

const URL_ATTRS = new Set(["href", "src", "data-mobile-src"]);
const SAFE_PROTOCOL = /^(?:https?:|mailto:|tel:)/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const DANGEROUS_BLOCK = /<(script|style|iframe|object|embed|svg|math|form|textarea|noscript|template|title|xmp)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#([0-9]+);?/g, (_, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isSafeUrl(raw: string): boolean {
  const decoded = decodeEntities(raw).replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  if (!decoded) return true;
  if (decoded.startsWith("//")) return false;
  if (decoded.startsWith("/") || decoded.startsWith("#") || decoded.startsWith("./") || decoded.startsWith("../")) {
    return true;
  }
  if (HAS_SCHEME.test(decoded)) {
    return SAFE_PROTOCOL.test(decoded);
  }
  return true;
}

function sanitizeSrcSet(raw: string): string | null {
  const parts = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const safe: string[] = [];
  for (const part of parts) {
    const [url, ...rest] = part.split(/\s+/);
    if (!url || !isSafeUrl(url)) continue;
    const descriptor = rest.join(" ");
    if (descriptor && !/^[0-9]+(?:\.[0-9]+)?[wx]$/i.test(descriptor)) continue;
    safe.push(descriptor ? `${url} ${descriptor}` : url);
  }
  return safe.length ? safe.join(", ") : null;
}

function sanitizeAttributes(tagName: string, rawAttrs: string): string {
  const allowedForTag = TAG_ATTRS[tagName];
  const attrRe = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const out: string[] = [];
  let hasTargetBlank = false;
  let hasRel = false;

  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(rawAttrs)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name || name.startsWith("on")) continue;
    if (!GLOBAL_ATTRS.has(name) && !allowedForTag?.has(name)) continue;

    const rawVal = match[2] ?? match[3] ?? match[4] ?? "";

    if (URL_ATTRS.has(name)) {
      if (!isSafeUrl(rawVal)) continue;
    }

    if (name === "srcset") {
      const cleaned = sanitizeSrcSet(rawVal);
      if (!cleaned) continue;
      out.push(`srcset="${escapeAttr(cleaned)}"`);
      continue;
    }

    if (name === "target") {
      const normalized = rawVal.toLowerCase();
      if (normalized !== "_blank" && normalized !== "_self") continue;
      if (normalized === "_blank") hasTargetBlank = true;
      out.push(`target="${normalized}"`);
      continue;
    }

    if (name === "rel") hasRel = true;

    if (name === "open" && match[2] === undefined && match[3] === undefined && match[4] === undefined) {
      out.push("open");
      continue;
    }

    out.push(`${name}="${escapeAttr(decodeEntities(rawVal))}"`);
  }

  if (tagName === "a" && hasTargetBlank && !hasRel) {
    out.push('rel="noopener noreferrer"');
  }

  return out.length ? ` ${out.join(" ")}` : "";
}

/** Sanitize untrusted or editor-authored HTML for safe storage and rendering. */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);

  // Iterate to defeat nested/reconstructed dangerous blocks like <scr<script>ipt>.
  let prev = "";
  for (let i = 0; i < 5 && html !== prev; i++) {
    prev = html;
    html = html.replace(HTML_COMMENT, "").replace(DANGEROUS_BLOCK, "");
  }

  // Filter every remaining tag through the strict allowlist.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (full, rawName: string, rawAttrs: string) => {
    const tag = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) {
      return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    }
    const attrs = sanitizeAttributes(tag, rawAttrs);
    return `<${tag}${attrs}>`;
  });

  return html.trim();
}