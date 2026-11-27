import { z } from "zod";
import { MAX_ARTICLE_TAGS } from "@/lib/taxonomy";

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "Must be an http or https URL");

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((v) => /^https:\/\//i.test(v), "Featured image URL must use https");

const seoInput = z
  .object({
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(400).optional(),
    focusKeyword: z.string().trim().max(200).optional(),
    secondaryKeywords: z.string().trim().max(500).optional(),
    searchIntent: z.string().trim().max(200).optional(),
    ogTitle: z.string().trim().max(200).optional(),
    ogDescription: z.string().trim().max(400).optional(),
    canonical: httpUrl.optional(),
  })
  .optional();

const tagsInput = z
  .array(z.string().trim().min(1).max(100))
  .max(MAX_ARTICLE_TAGS, `At most ${MAX_ARTICLE_TAGS} tags are allowed per article`)
  .optional();

export const uploadArticleSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(250, "Title is too long"),
  slug: z.string().trim().max(190).optional(),
  excerpt: z.string().trim().min(10, "Excerpt is too short").max(600, "Excerpt is too long"),
  bodyMarkdown: z.string().trim().min(20, "Article body is too short").max(50000),
  sourceName: z.string().trim().min(1, "Source name is required").max(150),
  sourceUrl: httpUrl,
  categorySlug: z.string().trim().max(190).optional(),
  tags: tagsInput,
  seo: seoInput,
  idempotencyKey: z.string().trim().min(1).max(190).optional(),
});

export const finalizeUpdateSchema = z.object({
  draftId: z.string().trim().uuid("draftId must be a valid UUID"),
  mediaId: z.string().trim().uuid("mediaId must be a valid UUID"),
  idempotencyKey: z.string().trim().min(1).max(190).optional(),
});

export const publishUpdateSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(250, "Title is too long"),
  slug: z.string().trim().max(190).optional(),
  excerpt: z.string().trim().min(10, "Excerpt is too short").max(600, "Excerpt is too long"),
  bodyMarkdown: z.string().trim().min(20, "Article body is too short").max(50000),
  sourceName: z.string().trim().min(1, "Source name is required").max(150),
  sourceUrl: httpUrl,
  featuredImageUrl: httpsUrl.optional(),
  featuredImageAlt: z.string().trim().max(300).optional(),
  authorSlug: z.string().trim().max(190).optional(),
  categorySlug: z.string().trim().max(190).optional(),
  tags: tagsInput,
  seo: seoInput,
  idempotencyKey: z.string().trim().min(1).max(190).optional(),
});

export const patchUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(250).optional(),
    excerpt: z.string().trim().min(10).max(600).optional(),
    bodyMarkdown: z.string().trim().min(20).max(50000).optional(),
    sourceName: z.string().trim().min(1).max(150).optional(),
    sourceUrl: httpUrl.optional(),
    featuredImageUrl: httpsUrl.optional(),
    featuredImageAlt: z.string().trim().max(300).optional(),
    authorSlug: z.string().trim().max(190).optional(),
    categorySlug: z.string().trim().max(190).optional(),
    tags: tagsInput,
    seo: seoInput,
  })
  .refine((obj) => Object.keys(obj).length > 0, "Provide at least one field to update");

export type PublishUpdateInput = z.infer<typeof publishUpdateSchema>;
export type PatchUpdateInput = z.infer<typeof patchUpdateSchema>;
export type UploadArticleInput = z.infer<typeof uploadArticleSchema>;
export type FinalizeUpdateInput = z.infer<typeof finalizeUpdateSchema>;

/** Normalize a source URL for duplicate detection (lowercase host, drop hash and trailing slash). */
export function normalizeSourceUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    const normalized = u.toString();
    return normalized.endsWith("/") && u.pathname !== "/" ? normalized.slice(0, -1) : normalized;
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/** Check whether an IPv4 or IPv6 literal is private, loopback, link-local, or reserved. */
export function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, "").toLowerCase();
  if (clean === "::1" || clean === "::" || clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80:")) {
    return true;
  }
  const parts = clean.split(".").map((p) => Number(p));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  return false;
}

/** Validate that a remote image URL is safe to fetch (HTTPS only, public host). */
export function validateRemoteImageUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Invalid image URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "Image URL must use https." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIp(host)
  ) {
    return { ok: false, error: "Private or local image hosts are not allowed." };
  }
  return { ok: true, url };
}