import { createHash } from "node:crypto";

import { DEFAULT_AUTHOR, DEFAULT_AUTHOR_LINKEDIN, DEFAULT_AUTHOR_SLUG } from "@/lib/authors";
import { getAdminClient } from "@/lib/db.server";
import { readingTime, slugify } from "@/lib/format";
import {
  MAX_ARTICLE_TAGS,
  resolveApprovedCategory,
  resolveApprovedTags,
} from "@/lib/taxonomy";
import type { Author, ContentItem, SeoFields } from "@/lib/types";
import { isAutoPublishEnabled } from "./events.server";
import { importRemoteFeaturedImage, saveUploadedUpdateImage, UPDATE_IMAGE_HEIGHT, UPDATE_IMAGE_WIDTH } from "./image.server";
import { markdownToSafeHtml } from "./sanitize";
import {
  normalizeSourceUrl,
  type FinalizeUpdateInput,
  type PatchUpdateInput,
  type PublishUpdateInput,
  type UploadArticleInput,
} from "./schema";

export class AgentApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function compactSeo(input?: Record<string, unknown>): SeoFields {
  const out: Record<string, unknown> = {};
  if (!input) return out as SeoFields;
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out as SeoFields;
}

async function resolveApprovedCategoryId(
  db: ReturnType<typeof getAdminClient>,
  categoryInput?: string,
): Promise<string | null> {
  const approved = resolveApprovedCategory(categoryInput);
  if (!approved) return null;
  const { data: cat } = await db
    .from("categories")
    .select("id")
    .eq("slug", approved.slug)
    .maybeSingle();
  return (cat as { id: string } | null)?.id ?? null;
}

async function assignApprovedTags(
  db: ReturnType<typeof getAdminClient>,
  contentId: string,
  rawTags?: readonly string[],
): Promise<void> {
  if (rawTags === undefined) return;
  const { matched } = resolveApprovedTags(rawTags, MAX_ARTICLE_TAGS);
  await db.from("content_tags").delete().eq("content_id", contentId);
  if (matched.length === 0) return;
  const { data: tagRows } = await db.from("tags").select("id, slug");
  const idBySlug = new Map(
    ((tagRows ?? []) as { id: string; slug: string }[]).map((t) => [t.slug, t.id]),
  );
  const tagIds = matched
    .map((t) => idBySlug.get(t.slug))
    .filter((id): id is string => Boolean(id))
    .slice(0, MAX_ARTICLE_TAGS);
  if (tagIds.length > 0) {
    await db
      .from("content_tags")
      .insert(tagIds.map((tag_id) => ({ content_id: contentId, tag_id })));
  }
}

async function resolveAuthorId(authorSlug?: string): Promise<{ id: string | null; name: string }> {
  const db = getAdminClient();
  if (authorSlug) {
    const { data } = await db.from("authors").select("id, name").eq("slug", authorSlug).maybeSingle();
    if (data) return { id: (data as Author).id, name: (data as Author).name };
  }
  const { data: def } = await db.from("authors").select("id, name").eq("slug", DEFAULT_AUTHOR_SLUG).maybeSingle();
  if (def) return { id: (def as Author).id, name: (def as Author).name };

  // Ensure Pankaj Singh exists so every published Update is linked to his author row.
  const { data: created } = await db
    .from("authors")
    .insert({
      name: DEFAULT_AUTHOR.name,
      slug: DEFAULT_AUTHOR.slug,
      job_title: DEFAULT_AUTHOR.job_title,
      social_links: { linkedin: DEFAULT_AUTHOR_LINKEDIN },
    })
    .select("id, name")
    .maybeSingle();
  if (created) return { id: (created as Author).id, name: (created as Author).name };
  return { id: null, name: DEFAULT_AUTHOR.name };
}

async function ensureUniqueSlug(desired: string, excludeId?: string): Promise<string> {
  const db = getAdminClient();
  const base = slugify(desired) || `update-${Date.now()}`;
  let candidate = base;
  for (let i = 2; i <= 50; i++) {
    const { data } = await db.from("content").select("id").eq("slug", candidate).maybeSingle();
    if (!data || (excludeId && (data as { id: string }).id === excludeId)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

async function findDuplicateBySource(sourceUrl: string, excludeId?: string): Promise<{ id: string; slug: string } | null> {
  const db = getAdminClient();
  const target = normalizeSourceUrl(sourceUrl);
  const { data } = await db
    .from("content")
    .select("id, slug, seo")
    .eq("type_slug", "news")
    .order("created_at", { ascending: false })
    .limit(500);

  for (const row of (data ?? []) as Array<{ id: string; slug: string; seo?: SeoFields | null }>) {
    if (excludeId && row.id === excludeId) continue;
    const existing = row.seo?.sourceUrl;
    if (existing && normalizeSourceUrl(existing) === target) {
      return { id: row.id, slug: row.slug };
    }
  }
  return null;
}

async function findUpdateByArticleKey(idempotencyKey: string): Promise<{
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  featured_image_url: string | null;
  seo?: SeoFields | null;
} | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("content")
    .select("id, title, slug, status, published_at, featured_image_url, seo")
    .eq("type_slug", "news")
    .order("created_at", { ascending: false })
    .limit(500);

  for (const row of (data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    published_at: string | null;
    featured_image_url: string | null;
    seo?: SeoFields | null;
  }>) {
    if (row.seo?.automationArticleKey === idempotencyKey) return row;
  }
  return null;
}

/** Step 1: Upload an automated Updates article as a draft under Pankaj Singh. */
export async function createUpdateDraft(input: UploadArticleInput, headerKey?: string) {
  const idempotencyKey = headerKey?.trim() || input.idempotencyKey?.trim() || undefined;

  if (idempotencyKey) {
    const reused = await findUpdateByArticleKey(idempotencyKey);
    if (reused) {
      return {
        draftId: reused.id,
        title: reused.title,
        slug: reused.slug,
        status: reused.status,
        author: DEFAULT_AUTHOR.name,
        reused: true,
      };
    }
  }

  const duplicate = await findDuplicateBySource(input.sourceUrl);
  if (duplicate) {
    throw new AgentApiError(409, "An update with this sourceUrl already exists.", {
      existing: { id: duplicate.id, slug: duplicate.slug, url: `/update/${duplicate.slug}` },
    });
  }

  const db = getAdminClient();
  const slug = await ensureUniqueSlug(input.slug || input.title);
  const author = await resolveAuthorId(DEFAULT_AUTHOR_SLUG);

  const categoryId = await resolveApprovedCategoryId(db, input.categorySlug);

  const bodyHtml = markdownToSafeHtml(input.bodyMarkdown);
  const seo: SeoFields = {
    ...compactSeo(input.seo),
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    automationState: "draft",
    ...(idempotencyKey ? { automationArticleKey: idempotencyKey } : {}),
  };

  const { data, error } = await db
    .from("content")
    .insert({
      type_slug: "news",
      title: input.title,
      slug,
      excerpt: input.excerpt,
      body_html: bodyHtml,
      body_markdown: input.bodyMarkdown,
      editor_mode: "markdown",
      author_id: author.id,
      category_id: categoryId,
      status: "draft",
      is_featured: false,
      is_editors_pick: false,
      reading_minutes: readingTime(bodyHtml),
      seo,
    })
    .select("id, title, slug, status")
    .single();

  if (error || !data) {
    throw new AgentApiError(500, error?.message ?? "Failed to create draft.");
  }

  const row = data as { id: string; title: string; slug: string; status: string };
  await assignApprovedTags(db, row.id, input.tags);
  return {
    draftId: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    author: author.name,
    reused: false,
  };
}

/** Step 2: Upload & convert a 1600 × 900 WebP featured image and attach it to a draft. */
export async function attachUpdateDraftImage(params: {
  draftId: string;
  buffer: Buffer;
  fileName: string;
  altText: string;
  idempotencyKey?: string;
}) {
  const db = getAdminClient();
  const { data: existing, error: fetchErr } = await db
    .from("content")
    .select("id, type_slug, title, featured_image_url, featured_image_alt, seo")
    .eq("id", params.draftId)
    .maybeSingle();

  if (fetchErr) throw new AgentApiError(500, fetchErr.message);
  const draft = existing as {
    id: string;
    type_slug: string;
    title: string;
    featured_image_url: string | null;
    featured_image_alt: string | null;
    seo?: SeoFields | null;
  } | null;

  if (!draft || draft.type_slug !== "news") {
    throw new AgentApiError(404, "Update draft not found.");
  }

  const fileHash = createHash("sha256").update(params.buffer).digest("hex");
  const existingMediaId = draft.seo?.automationMediaId;
  const sameKey = Boolean(params.idempotencyKey && draft.seo?.automationImageKey === params.idempotencyKey);
  const sameContent = draft.seo?.automationImageHash === fileHash && draft.featured_image_alt === params.altText;

  if (existingMediaId && draft.featured_image_url && (sameKey || sameContent)) {
    const { data: mediaRow } = await db
      .from("media")
      .select("id, public_url, width, height, alt_text")
      .eq("id", existingMediaId)
      .maybeSingle();
    if (mediaRow) {
      const m = mediaRow as { id: string; public_url: string; width: number | null; height: number | null; alt_text: string | null };
      return {
        draftId: draft.id,
        title: draft.title,
        mediaId: m.id,
        publicUrl: m.public_url,
        width: m.width ?? UPDATE_IMAGE_WIDTH,
        height: m.height ?? UPDATE_IMAGE_HEIGHT,
        altText: m.alt_text ?? params.altText,
        reused: true,
      };
    }
  }

  let saved: { mediaId: string; publicUrl: string; width: number; height: number; altText: string };
  try {
    saved = await saveUploadedUpdateImage(params.buffer, params.fileName, params.altText);
  } catch (err) {
    throw new AgentApiError(400, err instanceof Error ? err.message : "Failed to process image.");
  }

  const mergedSeo: SeoFields = {
    ...compactSeo(draft.seo as Record<string, unknown> | undefined),
    automationMediaId: saved.mediaId,
    automationImageHash: fileHash,
    ...(params.idempotencyKey ? { automationImageKey: params.idempotencyKey } : {}),
  };

  const { error: updateErr } = await db
    .from("content")
    .update({
      featured_image_url: saved.publicUrl,
      featured_image_alt: saved.altText,
      seo: mergedSeo,
    })
    .eq("id", draft.id);

  if (updateErr) throw new AgentApiError(500, updateErr.message);

  return {
    draftId: draft.id,
    title: draft.title,
    mediaId: saved.mediaId,
    publicUrl: saved.publicUrl,
    width: saved.width,
    height: saved.height,
    altText: saved.altText,
    reused: false,
  };
}

/** Step 3: Verify draft & image ownership, then either queue for review or auto-publish. */
export async function finalizeUpdateDraft(
  input: FinalizeUpdateInput,
  baseUrl: string,
  headerKey?: string,
) {
  const db = getAdminClient();
  const { data: existing, error: fetchErr } = await db
    .from("content")
    .select("id, type_slug, title, slug, excerpt, body_html, body_markdown, featured_image_url, featured_image_alt, status, published_at, seo")
    .eq("id", input.draftId)
    .maybeSingle();

  if (fetchErr) throw new AgentApiError(500, fetchErr.message);
  const draft = existing as {
    id: string;
    type_slug: string;
    title: string;
    slug: string;
    excerpt: string | null;
    body_html: string | null;
    body_markdown: string | null;
    featured_image_url: string | null;
    featured_image_alt: string | null;
    status: string;
    published_at: string | null;
    seo?: SeoFields | null;
  } | null;

  if (!draft || draft.type_slug !== "news") {
    throw new AgentApiError(404, "Update draft not found.");
  }

  const { data: mediaRow } = await db
    .from("media")
    .select("id, public_url")
    .eq("id", input.mediaId)
    .maybeSingle();
  const media = mediaRow as { id: string; public_url: string } | null;
  if (
    !media ||
    draft.seo?.automationMediaId !== media.id ||
    draft.featured_image_url !== media.public_url
  ) {
    throw new AgentApiError(400, "The supplied mediaId does not belong to this draft.");
  }

  const missing: string[] = [];
  if (!draft.title || draft.title.trim().length < 3) missing.push("title");
  if (!draft.excerpt || draft.excerpt.trim().length < 10) missing.push("excerpt");
  if (!draft.body_html || draft.body_html.trim().length < 20) missing.push("body");
  if (!draft.seo?.sourceName?.trim()) missing.push("sourceName");
  if (!draft.seo?.sourceUrl || !/^https?:\/\//i.test(draft.seo.sourceUrl)) missing.push("sourceUrl");
  if (!draft.featured_image_url) missing.push("featuredImage");
  if (!draft.featured_image_alt?.trim()) missing.push("featuredImageAlt");

  if (missing.length > 0) {
    throw new AgentApiError(400, `Draft is incomplete. Missing: ${missing.join(", ")}.`, { missing });
  }

  const liveUrl = `${baseUrl}/news/${draft.slug}`;
  const adminUrl = `${baseUrl}/admin/content/${draft.id}`;

  // Safe retries: already published or already placed in the review queue stay as-is.
  if (draft.status === "published") {
    return {
      draftId: draft.id,
      title: draft.title,
      slug: draft.slug,
      state: "Published" as const,
      status: "published" as const,
      liveUrl,
      reused: true,
    };
  }
  if (draft.seo?.automationState === "ready_for_review") {
    return {
      draftId: draft.id,
      title: draft.title,
      slug: draft.slug,
      state: "Ready for review" as const,
      status: "draft" as const,
      adminUrl,
      reused: true,
    };
  }

  const autoPublish = await isAutoPublishEnabled();
  const now = new Date().toISOString();
  const finalizeKey = headerKey?.trim() || input.idempotencyKey?.trim() || undefined;

  if (!autoPublish) {
    const mergedSeo: SeoFields = {
      ...compactSeo(draft.seo as Record<string, unknown> | undefined),
      automationState: "ready_for_review",
      automationReadyAt: now,
      ...(finalizeKey ? { automationFinalizeKey: finalizeKey } : {}),
    };
    const { error: updateErr } = await db
      .from("content")
      .update({ status: "draft", seo: mergedSeo })
      .eq("id", draft.id);
    if (updateErr) throw new AgentApiError(500, updateErr.message);

    return {
      draftId: draft.id,
      title: draft.title,
      slug: draft.slug,
      state: "Ready for review" as const,
      status: "draft" as const,
      adminUrl,
      reused: false,
    };
  }

  const mergedSeo: SeoFields = {
    ...compactSeo(draft.seo as Record<string, unknown> | undefined),
    automationState: "published",
    automationPublishedAt: now,
    ...(finalizeKey ? { automationFinalizeKey: finalizeKey } : {}),
  };
  const { error: publishErr } = await db
    .from("content")
    .update({ status: "published", published_at: now, seo: mergedSeo })
    .eq("id", draft.id);
  if (publishErr) throw new AgentApiError(500, publishErr.message);

  return {
    draftId: draft.id,
    title: draft.title,
    slug: draft.slug,
    state: "Published" as const,
    status: "published" as const,
    liveUrl,
    reused: false,
  };
}

export async function listRecentUpdates(limit = 20) {
  const db = getAdminClient();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const { data, error } = await db
    .from("content")
    .select("id, title, slug, excerpt, featured_image_url, seo, published_at, status")
    .eq("type_slug", "news")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new AgentApiError(500, error.message);
  return ((data ?? []) as Array<Partial<ContentItem>>).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    url: `/news/${row.slug}`,
    excerpt: row.excerpt ?? "",
    published_at: row.published_at ?? null,
    source_name: row.seo?.sourceName ?? null,
    source_url: row.seo?.sourceUrl ?? null,
    featured_image_url: row.featured_image_url ?? null,
  }));
}

export async function publishAgentUpdate(
  input: PublishUpdateInput,
  baseUrl = "https://fabric-pro.com",
  headerKey?: string,
) {
  const idempotencyKey = headerKey?.trim() || input.idempotencyKey?.trim() || undefined;
  if (idempotencyKey) {
    const reused = await findUpdateByArticleKey(idempotencyKey);
    if (reused) {
      const isPub = reused.status === "published";
      return {
        id: reused.id,
        title: reused.title,
        slug: reused.slug,
        url: `/news/${reused.slug}`,
        state: isPub ? ("Published" as const) : ("Ready for review" as const),
        status: reused.status,
        ...(isPub
          ? { liveUrl: `${baseUrl}/news/${reused.slug}` }
          : { adminUrl: `${baseUrl}/admin/content/${reused.id}` }),
        author: DEFAULT_AUTHOR.name,
        published_at: reused.published_at,
        featured_image_url: reused.featured_image_url,
        reused: true,
      };
    }
  }

  const duplicate = await findDuplicateBySource(input.sourceUrl);
  if (duplicate) {
    throw new AgentApiError(409, "An update with this sourceUrl already exists.", {
      existing: { id: duplicate.id, slug: duplicate.slug, url: `/news/${duplicate.slug}` },
    });
  }

  let featuredImageUrl: string | null = null;
  let featuredImageAlt: string | null = null;
  let mediaId: string | null = null;
  if (input.featuredImageUrl) {
    try {
      const alt = input.featuredImageAlt?.trim() || input.title;
      const saved = await importRemoteFeaturedImage(input.featuredImageUrl, alt);
      featuredImageUrl = saved.publicUrl;
      featuredImageAlt = saved.altText;
      mediaId = saved.mediaId;
    } catch (err) {
      throw new AgentApiError(400, err instanceof Error ? err.message : "Failed to import featured image.");
    }
  }

  const db = getAdminClient();
  const slug = await ensureUniqueSlug(input.slug || input.title);
  const author = await resolveAuthorId(input.authorSlug);
  const autoPublish = await isAutoPublishEnabled();

  const categoryId = await resolveApprovedCategoryId(db, input.categorySlug);

  const bodyHtml = markdownToSafeHtml(input.bodyMarkdown);
  const now = new Date().toISOString();
  const seo: SeoFields = {
    ...compactSeo(input.seo),
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    automationState: autoPublish ? "published" : "ready_for_review",
    ...(autoPublish ? { automationPublishedAt: now } : { automationReadyAt: now }),
    ...(mediaId ? { automationMediaId: mediaId } : {}),
    ...(idempotencyKey ? { automationArticleKey: idempotencyKey } : {}),
  };

  const { data, error } = await db
    .from("content")
    .insert({
      type_slug: "news",
      title: input.title,
      slug,
      excerpt: input.excerpt,
      body_html: bodyHtml,
      body_markdown: input.bodyMarkdown,
      editor_mode: "markdown",
      featured_image_url: featuredImageUrl,
      featured_image_alt: featuredImageAlt,
      author_id: author.id,
      category_id: categoryId,
      status: autoPublish ? "published" : "draft",
      is_featured: false,
      is_editors_pick: false,
      reading_minutes: readingTime(bodyHtml),
      seo,
      published_at: autoPublish ? now : null,
    })
    .select("id, title, slug, status, published_at, featured_image_url")
    .single();

  if (error || !data) {
    throw new AgentApiError(500, error?.message ?? "Failed to save update.");
  }

  const row = data as { id: string; title: string; slug: string; status: string; published_at: string | null; featured_image_url: string | null };
  await assignApprovedTags(db, row.id, input.tags);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    url: `/news/${row.slug}`,
    state: autoPublish ? ("Published" as const) : ("Ready for review" as const),
    status: row.status,
    ...(autoPublish
      ? { liveUrl: `${baseUrl}/news/${row.slug}` }
      : { adminUrl: `${baseUrl}/admin/content/${row.id}` }),
    author: author.name,
    published_at: row.published_at,
    featured_image_url: row.featured_image_url,
    reused: false,
  };
}

export async function patchAgentUpdate(id: string, input: PatchUpdateInput) {
  const db = getAdminClient();
  const { data: existing, error: fetchErr } = await db
    .from("content")
    .select("id, type_slug, title, slug, seo")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw new AgentApiError(500, fetchErr.message);
  const row = existing as { id: string; type_slug: string; title: string; slug: string; seo?: SeoFields | null } | null;
  if (!row || row.type_slug !== "news") {
    throw new AgentApiError(404, "Update not found.");
  }

  if (input.sourceUrl) {
    const duplicate = await findDuplicateBySource(input.sourceUrl, id);
    if (duplicate) {
      throw new AgentApiError(409, "Another update with this sourceUrl already exists.", {
        existing: { id: duplicate.id, slug: duplicate.slug, url: `/news/${duplicate.slug}` },
      });
    }
  }

  const patch: Record<string, unknown> = {
    type_slug: "news",
  };
  if (input.title !== undefined) patch["title"] = input.title;
  if (input.excerpt !== undefined) patch["excerpt"] = input.excerpt;
  if (input.bodyMarkdown !== undefined) {
    const bodyHtml = markdownToSafeHtml(input.bodyMarkdown);
    patch["body_html"] = bodyHtml;
    patch["body_markdown"] = input.bodyMarkdown;
    patch["reading_minutes"] = readingTime(bodyHtml);
  }
  if (input.authorSlug !== undefined) {
    const author = await resolveAuthorId(input.authorSlug);
    patch["author_id"] = author.id;
  }
  if (input.categorySlug !== undefined) {
    patch["category_id"] = await resolveApprovedCategoryId(db, input.categorySlug);
  }
  if (input.featuredImageUrl !== undefined) {
    try {
      const alt = input.featuredImageAlt?.trim() || input.title || row.title;
      const saved = await importRemoteFeaturedImage(input.featuredImageUrl, alt);
      patch["featured_image_url"] = saved.publicUrl;
      patch["featured_image_alt"] = saved.altText;
    } catch (err) {
      throw new AgentApiError(400, err instanceof Error ? err.message : "Failed to import featured image.");
    }
  } else if (input.featuredImageAlt !== undefined) {
    patch["featured_image_alt"] = input.featuredImageAlt;
  }

  if (input.seo !== undefined || input.sourceName !== undefined || input.sourceUrl !== undefined) {
    const mergedSeo: SeoFields = {
      ...compactSeo(row.seo as Record<string, unknown> | undefined),
      ...compactSeo(input.seo),
      ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
    };
    patch["seo"] = mergedSeo;
  }

  const { data: updated, error: updateErr } = await db
    .from("content")
    .update(patch)
    .eq("id", id)
    .select("id, title, slug, status, published_at, featured_image_url")
    .single();

  if (updateErr || !updated) {
    throw new AgentApiError(500, updateErr?.message ?? "Failed to update article.");
  }

  await assignApprovedTags(db, id, input.tags);

  const saved = updated as { id: string; title: string; slug: string; status: string; published_at: string; featured_image_url: string | null };
  return {
    id: saved.id,
    title: saved.title,
    slug: saved.slug,
    url: `/news/${saved.slug}`,
    status: saved.status,
    published_at: saved.published_at,
    featured_image_url: saved.featured_image_url,
  };
}