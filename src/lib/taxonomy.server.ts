import { getAdminClient } from "./db.server";
import {
  APPROVED_CATEGORIES,
  APPROVED_CATEGORY_SLUGS,
  APPROVED_TAG_SLUGS,
  APPROVED_TAGS,
  resolveArticleReassignment,
} from "./taxonomy";

export interface TaxonomySyncSummary {
  categoriesCount: number;
  tagsCount: number;
  articlesUpdated: number;
  removedCategories: number;
  removedTags: number;
}

/**
 * Idempotently replaces site categories and tags with the 7 approved categories
 * and 42 approved tags, reassigns every existing article's category and up to 4
 * approved tags, and removes unapproved taxonomy rows.
 */
export async function syncApprovedTaxonomy(): Promise<TaxonomySyncSummary> {
  const db = getAdminClient();

  const [catsRes, tagsRes, contentRes, linksRes, headerSettingRes] = await Promise.all([
    db.from("categories").select("id, slug, name, description, position"),
    db.from("tags").select("id, slug, name"),
    db.from("content").select("id, slug, category_id"),
    db.from("content_tags").select("content_id, tag_id"),
    db.from("site_settings").select("key, value").eq("key", "header").maybeSingle(),
  ]);

  const existingCats = (catsRes.data ?? []) as { id: string; slug: string }[];
  const existingTags = (tagsRes.data ?? []) as { id: string; slug: string }[];
  const existingContent = (contentRes.data ?? []) as {
    id: string;
    slug: string;
    category_id: string | null;
  }[];
  const existingLinks = (linksRes.data ?? []) as { content_id: string; tag_id: string }[];

  const oldCatSlugById = new Map(existingCats.map((c) => [c.id, c.slug]));
  const oldTagSlugById = new Map(existingTags.map((t) => [t.id, t.slug]));
  const catIdBySlug = new Map(existingCats.map((c) => [c.slug, c.id]));
  const tagIdBySlug = new Map(existingTags.map((t) => [t.slug, t.id]));

  // 1. Ensure all 7 approved categories exist with exact names, descriptions, and positions.
  for (const cat of APPROVED_CATEGORIES) {
    const existingId = catIdBySlug.get(cat.slug);
    if (existingId) {
      const { error } = await db
        .from("categories")
        .update({
          name: cat.name,
          description: cat.description,
          position: cat.position,
        })
        .eq("id", existingId);
      if (error) throw new Error(`Failed updating category ${cat.slug}: ${error.message}`);
    } else {
      const { data, error } = await db
        .from("categories")
        .insert({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          position: cat.position,
          seo: {},
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed creating category ${cat.slug}: ${error?.message ?? ""}`);
      catIdBySlug.set(cat.slug, String((data as { id: string }).id));
    }
  }

  // 2. Ensure all 42 approved tags exist with exact names.
  for (const tag of APPROVED_TAGS) {
    const existingId = tagIdBySlug.get(tag.slug);
    if (existingId) {
      const { error } = await db.from("tags").update({ name: tag.name }).eq("id", existingId);
      if (error) throw new Error(`Failed updating tag ${tag.slug}: ${error.message}`);
    } else {
      const { data, error } = await db
        .from("tags")
        .insert({
          name: tag.name,
          slug: tag.slug,
          seo: {},
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed creating tag ${tag.slug}: ${error?.message ?? ""}`);
      tagIdBySlug.set(tag.slug, String((data as { id: string }).id));
    }
  }

  // 3. Reassign every existing article's category and up to 4 approved tags.
  const tagsByArticle = new Map<string, string[]>();
  for (const link of existingLinks) {
    const slug = oldTagSlugById.get(link.tag_id);
    if (!slug) continue;
    const list = tagsByArticle.get(link.content_id) ?? [];
    list.push(slug);
    tagsByArticle.set(link.content_id, list);
  }

  let articlesUpdated = 0;
  for (const article of existingContent) {
    const oldCatSlug = article.category_id ? (oldCatSlugById.get(article.category_id) ?? null) : null;
    const oldTagSlugs = tagsByArticle.get(article.id) ?? [];
    const next = resolveArticleReassignment(article.slug, oldCatSlug, oldTagSlugs);
    const nextCategoryId = next.categorySlug ? (catIdBySlug.get(next.categorySlug) ?? null) : null;
    const nextTagIds = next.tagSlugs
      .map((slug) => tagIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id));

    const { error: updateErr } = await db
      .from("content")
      .update({ category_id: nextCategoryId })
      .eq("id", article.id);
    if (updateErr) throw new Error(`Failed updating article ${article.slug}: ${updateErr.message}`);

    const { error: delLinksErr } = await db
      .from("content_tags")
      .delete()
      .eq("content_id", article.id);
    if (delLinksErr) throw new Error(`Failed clearing tags for ${article.slug}: ${delLinksErr.message}`);

    if (nextTagIds.length > 0) {
      const { error: insLinksErr } = await db
        .from("content_tags")
        .insert(nextTagIds.map((tag_id) => ({ content_id: article.id, tag_id })));
      if (insLinksErr) throw new Error(`Failed assigning tags for ${article.slug}: ${insLinksErr.message}`);
    }
    articlesUpdated += 1;
  }

  // 4. Delete all unapproved categories and tags.
  let removedCategories = 0;
  for (const cat of existingCats) {
    if (!APPROVED_CATEGORY_SLUGS.has(cat.slug)) {
      const { error } = await db.from("categories").delete().eq("id", cat.id);
      if (error) throw new Error(`Failed deleting category ${cat.slug}: ${error.message}`);
      removedCategories += 1;
    }
  }

  let removedTags = 0;
  for (const tag of existingTags) {
    if (!APPROVED_TAG_SLUGS.has(tag.slug)) {
      const { error } = await db.from("tags").delete().eq("id", tag.id);
      if (error) throw new Error(`Failed deleting tag ${tag.slug}: ${error.message}`);
      removedTags += 1;
    }
  }

  // 5. Clean up any stale unapproved tagSlugs filter in header settings so the ticker shows only approved tags.
  const headerRow = headerSettingRes.data as { key: string; value: Record<string, unknown> } | null;
  if (headerRow?.value && typeof headerRow.value["tagSlugs"] === "string") {
    const raw = headerRow.value["tagSlugs"];
    const filtered = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && APPROVED_TAG_SLUGS.has(s))
      .join(", ");
    if (filtered !== raw) {
      await db
        .from("site_settings")
        .upsert({ key: "header", value: { ...headerRow.value, tagSlugs: filtered } }, { onConflict: "key" });
    }
  }

  return {
    categoriesCount: APPROVED_CATEGORIES.length,
    tagsCount: APPROVED_TAGS.length,
    articlesUpdated,
    removedCategories,
    removedTags,
  };
}