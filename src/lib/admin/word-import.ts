import DOMPurify from "dompurify";
import { z } from "zod";
import { slugify } from "@/lib/format";
import type { SeoFields } from "@/lib/types";

export const WORD_MAX_BYTES = 10 * 1024 * 1024;

type WordNode = {
  type: string;
  children?: WordNode[];
  value?: string;
  isBold?: boolean;
  fontSize?: number | null;
  styleId?: string | null;
  styleName?: string | null;
};

export function restoreWordHeadings(node: WordNode): WordNode {
  const children = node.children?.map(restoreWordHeadings);
  if (
    node.type === "paragraph" &&
    !node.styleId &&
    children?.length &&
    children.every((c) => c.type === "run" && c.isBold)
  ) {
    const size = Math.max(...children.map((c) => c.fontSize ?? 0));
    if (size >= 16) {
      const level = size >= 20 ? 1 : 2;
      return { ...node, children, styleId: `Heading${level}`, styleName: `heading ${level}` };
    }
  }
  return children ? { ...node, children } : node;
}

export function validateWordFile(file: Pick<File, "name" | "size">) {
  if (/\.doc$/i.test(file.name))
    throw new Error("Open this older .doc file in Word and save it as .docx, then upload it here.");
  if (!/\.docx$/i.test(file.name)) throw new Error("Choose a Word .docx file.");
  if (!file.size || file.size > WORD_MAX_BYTES)
    throw new Error("Choose a non-empty Word file smaller than 10 MB.");
}

export interface WordArticle {
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  seo: SeoFields;
  authorName: string;
  categoryName: string;
  tagNames: string[];
  publicationDate: string;
  imageAlt: string;
  warnings: string[];
}

const fields: Record<string, string> = {
  section: "section",
  "content type": "section",
  "suggested category": "category",
  category: "category",
  "suggested tags": "tags",
  tags: "tags",
  "primary keyword": "keyword",
  "focus keyword": "keyword",
  "secondary keywords": "secondary",
  "search intent": "intent",
  "seo title": "seoTitle",
  "meta title": "seoTitle",
  "meta description": "description",
  "seo description": "description",
  "suggested slug": "slug",
  slug: "slug",
  title: "title",
  "article title": "title",
  "publication date": "date",
  "published date": "date",
  author: "author",
  "author name": "author",
  "main news source": "sourceName",
  "source name": "sourceName",
  source: "sourceName",
  "original source": "sourceUrl",
  "source url": "sourceUrl",
  "source link": "sourceUrl",
  excerpt: "excerpt",
  extract: "excerpt",
  summary: "excerpt",
  "featured image alt": "imageAlt",
};

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const boldOnly = (el: Element) =>
  el.tagName === "P" &&
  !!el.querySelector("strong") &&
  Array.from(el.childNodes).every(
    (n) => !n.textContent?.trim() || (n instanceof Element && n.tagName === "STRONG"),
  );
const italicOnly = (el: Element) =>
  el.tagName === "P" &&
  !!el.querySelector("em") &&
  Array.from(el.childNodes).every(
    (n) => !n.textContent?.trim() || (n instanceof Element && n.tagName === "EM"),
  );
const comparableText = (value: string) =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const importedSchema = z.object({
  title: z.string().trim().min(1).max(255),
  html: z.string().min(1).max(500_000),
  slug: z.string().max(190),
  excerpt: z.string().max(5000),
});

/** Runs only in the browser: read metadata, then retain the article's actual HTML. */
export function parseWordHtml(input: string): WordArticle {
  if (input.length > 1_000_000) throw new Error("This document is too long to import.");
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "br",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
    ],
    ALLOWED_ATTR: ["href", "title"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  const nodes = Array.from(doc.body.children);
  const metadata: Record<string, string> = {};
  const removed = new Set<Element>();
  for (const node of nodes) {
    const value = text(node);
    if (/^seo metadata$/i.test(value) || /^[-–—_]{3,}$/.test(value) || node.tagName === "HR") {
      removed.add(node);
      continue;
    }
    if (!/^(P|H[1-6])$/.test(node.tagName)) continue;
    const match = /^([^:]{1,40}):\s*(.*)$/.exec(value);
    const key = match?.[1] ? fields[match[1].toLowerCase().trim()] : undefined;
    if (!key) continue;
    let val = match?.[2] ?? "";
    if (key === "sourceUrl") {
      const href = node.querySelector("a")?.getAttribute("href");
      val = href ?? val;
      if (!/^https?:\/\//i.test(val)) val = "";
    }
    metadata[key] = val;
    removed.add(node);
  }
  if (metadata["section"] && !/^updates?$/i.test(metadata["section"])) {
    throw new Error("This upload is for Updates only. The document’s Section must be Updates.");
  }
  const remaining = nodes.filter((node) => !removed.has(node));
  const takeaways = remaining.findIndex((n) => /^key takeaways?$/i.test(text(n)));
  let titleNode = remaining.find((n) => n.tagName === "H1" && !/^key takeaways?$/i.test(text(n)));
  if (!titleNode) {
    const afterTakeaways = takeaways >= 0 ? remaining.slice(takeaways + 1) : remaining;
    titleNode =
      afterTakeaways.find((n) => boldOnly(n) && !/^key takeaways?$/i.test(text(n))) ??
      remaining.find((n) => /^H[2-6]$/.test(n.tagName));
  }
  const title = metadata["title"] || (titleNode ? text(titleNode) : "");
  if (!title)
    throw new Error(
      "No article title found. Use a Heading 1 title or a bold title above the article.",
    );
  if (titleNode) removed.add(titleNode);

  const titleIndex = titleNode ? remaining.indexOf(titleNode) : -1;
  const preTitleExcerptParts: string[] = [];
  if (titleIndex > 0) {
    for (const node of remaining.slice(0, titleIndex)) {
      const value = text(node);
      if (!value) {
        removed.add(node);
        continue;
      }
      if (/^key takeaways?$/i.test(value) || node.tagName === "UL" || node.tagName === "OL") {
        continue;
      }
      if (/^(extract|excerpt|summary|standfirst)$/i.test(value)) {
        removed.add(node);
        continue;
      }
      if (node.tagName === "P") {
        preTitleExcerptParts.push(value);
        removed.add(node);
      }
    }
  }
  const preTitleExcerpt = preTitleExcerptParts.join(" ");

  let postTitleExcerpt = "";
  if (titleIndex >= 0) {
    const nextNode = remaining.slice(titleIndex + 1).find((n) => text(n).length > 0);
    if (nextNode && italicOnly(nextNode)) {
      postTitleExcerpt = text(nextNode);
      removed.add(nextNode);
    }
  }

  const body = doc.createElement("div");
  const hasStyledHeadings = nodes.some((n) => n.tagName === "H2" && !removed.has(n));
  for (const node of nodes) {
    if (removed.has(node)) continue;
    // Word files sometimes use bold Normal paragraphs instead of heading styles.
    if (boldOnly(node)) {
      const heading = doc.createElement(
        hasStyledHeadings && !/^key takeaways?$/i.test(text(node)) ? "h3" : "h2",
      );
      heading.textContent = text(node);
      body.append(heading);
    } else {
      if (node.tagName === "H1") {
        const heading = doc.createElement("h2");
        heading.innerHTML = node.innerHTML;
        body.append(heading);
      } else body.append(node);
    }
  }
  const firstParagraph = Array.from(body.children).find((n) => n.tagName === "P");
  const explicitExcerpt = metadata["excerpt"] || preTitleExcerpt || postTitleExcerpt;
  if (
    explicitExcerpt &&
    firstParagraph &&
    comparableText(text(firstParagraph)) === comparableText(explicitExcerpt)
  ) {
    firstParagraph.remove();
  }
  const excerpt =
    explicitExcerpt || (firstParagraph ? text(firstParagraph) : "");
  const slug = slugify(metadata["slug"] || title);
  const warnings: string[] = [];
  if (!metadata["seoTitle"]) warnings.push("No SEO title supplied; the article title was used.");
  if (!metadata["description"])
    warnings.push("No meta description supplied; the excerpt was used.");
  if (!metadata["sourceUrl"])
    warnings.push("No source link found. Add the original source URL before publishing.");
  const rawDate = metadata["date"] ?? "";
  const date = rawDate ? new Date(rawDate) : null;
  // Noon IST gives date-only imports an unambiguous timestamp on Hostinger.
  const publicationDate =
    date && !Number.isNaN(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T06:30:00.000Z`
      : "";
  if (rawDate && !publicationDate)
    warnings.push("Publication date was not recognised; select a date below.");
  const checked = importedSchema.safeParse({ title, slug, excerpt, html: body.innerHTML });
  if (!checked.success || !text(body))
    throw new Error("The document has no usable article body or exceeds the field limits.");
  return {
    ...checked.data,
    seo: {
      title: (metadata["seoTitle"] || title).slice(0, 300),
      description: (metadata["description"] || excerpt.slice(0, 160)).slice(0, 5000),
      focusKeyword: (metadata["keyword"] ?? "").slice(0, 300),
      ogTitle: (metadata["seoTitle"] || title).slice(0, 300),
      ogDescription: (metadata["description"] || excerpt.slice(0, 160)).slice(0, 5000),
      sourceName: (metadata["sourceName"] ?? "").slice(0, 500),
      sourceUrl: (metadata["sourceUrl"] ?? "").slice(0, 2000),
      secondaryKeywords: (metadata["secondary"] ?? "").slice(0, 2000),
      searchIntent: (metadata["intent"] ?? "").slice(0, 500),
    },
    authorName: (metadata["author"] || "Pankaj Singh").slice(0, 190),
    categoryName: (metadata["category"] ?? "").slice(0, 190),
    tagNames: Array.from(
      new Set(
        (metadata["tags"] ?? "")
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    )
      .slice(0, 30)
      .map((t) => t.slice(0, 100)),
    publicationDate,
    imageAlt: (metadata["imageAlt"] ?? "").slice(0, 2000),
    warnings,
  };
}

export async function readWordArticle(file: File): Promise<WordArticle> {
  validateWordFile(file);
  const mammoth = await import("mammoth/mammoth.browser");
  let html: string;
  try {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
        transformDocument: restoreWordHeadings,
      },
    );
    html = result.value;
  } catch {
    throw new Error(
      "This Word file could not be read. Save an unencrypted .docx copy in Word and try again.",
    );
  }
  const article = parseWordHtml(html);
  if (/<img\b/i.test(html))
    article.warnings.push(
      "Embedded pictures were not imported; add them from Media after importing.",
    );
  return article;
}
