import { marked } from "marked";
import { sanitizeHtml } from "../sanitize-html";

/** Strip dangerous tags, inline event handlers, and javascript:/data: URLs from HTML. */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html);
}

/** Convert Markdown from an agent into clean, sanitized HTML for article storage. */
export function markdownToSafeHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  return sanitizeArticleHtml(typeof raw === "string" ? raw : "");
}