import { getPublicServerClient, isServerDatabaseConfigured } from "./db.server";
import { DEFAULT_AUTHOR, DEFAULT_AUTHOR_SLUG, resolveAuthor } from "./authors";
import { mergeSettings } from "./defaults";
import {
  getPreviewBootstrap,
  PREVIEW_AUTHORS,
  PREVIEW_CATEGORIES,
  PREVIEW_CONTENT,
  PREVIEW_HOMEPAGE_SECTIONS,
  PREVIEW_PAGES,
  PREVIEW_TAGS,
} from "./preview-fallback";
import { APPROVED_TAG_SLUGS } from "./taxonomy";
import {
  orderTagsForDailyTicker,
  type ContentTagLink,
  type PublishedContentRef,
} from "./tags-ticker";
import type {
  Author,
  Category,
  ContentItem,
  ContentType,
  HomepageSection,
  MenuItem,
  SitePage,
  SiteBootstrap,
  Tag,
} from "./types";

const CONTENT_SELECT = `
  id, type_slug, title, slug, excerpt, body_html, body_markdown, editor_mode,
  featured_image_url, featured_image_alt, featured_image_caption,
  author_id, category_id, status, is_featured, is_editors_pick,
  video_provider, video_url, video_thumbnail_url, reading_minutes, view_count,
  seo, related_ids, published_at, scheduled_for, created_at, updated_at,
  author:authors(id, name, slug, photo_url, job_title, bio, social_links),
  category:categories(id, name, slug),
  content_tags(tag:tags(id, name, slug))
`;

type Row = Record<string, unknown>;

function normalize(row: Row | null): ContentItem | null {
  if (!row) return null;
  const tags = ((row["content_tags"] as { tag: unknown }[] | null) ?? [])
    .map((t) => t.tag)
    .filter(Boolean);
  const item = { ...row, tags } as unknown as ContentItem;
  delete (item as unknown as Row)["content_tags"];
  return item;
}

async function fetchDefaultAuthor(): Promise<Author> {
  try {
    const db = getPublicServerClient();
    const { data } = await db
      .from("authors")
      .select("id, user_id, name, slug, photo_url, job_title, bio, social_links, seo")
      .eq("slug", DEFAULT_AUTHOR_SLUG)
      .maybeSingle();
    return (data as Author | null) ?? DEFAULT_AUTHOR;
  } catch {
    return DEFAULT_AUTHOR;
  }
}

export async function fetchBootstrap(): Promise<SiteBootstrap> {
  if (!isServerDatabaseConfigured()) return getPreviewBootstrap();
  const db = getPublicServerClient();
  const [
    settingsRes,
    menusRes,
    itemsRes,
    typesRes,
    catsRes,
    tagsRes,
    contentTagsRes,
    publishedRes,
  ] = await Promise.all([
    db.from("site_settings").select("key, value"),
    db.from("menus").select("id, slug, name"),
    db.from("menu_items").select("*").order("position"),
    db.from("content_types").select("*").eq("enabled", true).order("position"),
    db.from("categories").select("*").order("position"),
    db.from("tags").select("*").order("name"),
    db.from("content_tags").select("content_id, tag_id"),
    db.from("content").select("id, published_at").eq("status", "published"),
  ]);

  const settings = mergeSettings((settingsRes.data ?? []) as { key: string; value: unknown }[]);
  const approvedTags = ((tagsRes.data ?? []) as Tag[]).filter((t) =>
    APPROVED_TAG_SLUGS.has(t.slug),
  );
  const orderedTags = orderTagsForDailyTicker(
    approvedTags,
    (contentTagsRes.data ?? []) as ContentTagLink[],
    (publishedRes.data ?? []) as PublishedContentRef[],
    { timeZone: settings.general.timezone || "UTC" },
  );

  const menus: Record<string, MenuItem[]> = {};
  const allItems = (itemsRes.data ?? []) as MenuItem[];
  for (const menu of (menusRes.data ?? []) as { id: string; slug: string }[]) {
    const items = allItems.filter((i) => i.menu_id === menu.id);
    const roots = items.filter((i) => !i.parent_id);
    menus[menu.slug] = roots.map((r) => ({
      ...r,
      children: items.filter((i) => i.parent_id === r.id),
    }));
  }

  return {
    settings,
    menus,
    contentTypes: (typesRes.data ?? []) as ContentType[],
    categories: (catsRes.data ?? []) as Category[],
    tags: orderedTags,
  };
}

export interface ListParams {
  typeSlug?: string | undefined;
  categorySlug?: string | undefined;
  tagSlug?: string | undefined;
  authorSlug?: string | undefined;
  search?: string | undefined;
  featured?: boolean | undefined;
  editorsPick?: boolean | undefined;
  ids?: string[] | undefined;
  sort?: "newest" | "oldest" | "popular" | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  excludeId?: string | undefined;
}

export async function listContent(
  params: ListParams,
): Promise<{ items: ContentItem[]; total: number }> {
  if (!isServerDatabaseConfigured()) {
    let rows = PREVIEW_CONTENT.slice();
    if (params.typeSlug) rows = rows.filter((i) => i.type_slug === params.typeSlug);
    if (params.featured) rows = rows.filter((i) => i.is_featured);
    if (params.editorsPick) rows = rows.filter((i) => i.is_editors_pick);
    if (params.excludeId) rows = rows.filter((i) => i.id !== params.excludeId);
    if (params.ids?.length) {
      const allowed = new Set(params.ids);
      rows = rows.filter((i) => allowed.has(i.id));
    }
    if (params.categorySlug) rows = rows.filter((i) => i.category?.slug === params.categorySlug);
    if (params.authorSlug) rows = rows.filter((i) => i.author?.slug === params.authorSlug);
    if (params.tagSlug) {
      rows = rows.filter((i) => (i.tags ?? []).some((t) => t.slug === params.tagSlug));
    }
    if (params.search) {
      const q = params.search.trim().toLowerCase();
      if (q) {
        rows = rows.filter((i) =>
          `${i.title} ${i.excerpt ?? ""} ${i.body_html ?? ""}`.toLowerCase().includes(q),
        );
      }
    }
    if (params.sort === "oldest") {
      rows.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));
    } else if (params.sort === "popular") {
      rows.sort((a, b) => b.view_count - a.view_count);
    } else {
      rows.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    }
    const perPage = Math.min(Math.max(params.perPage ?? 12, 1), 60);
    const page = Math.max(params.page ?? 1, 1);
    const from = (page - 1) * perPage;
    return { items: rows.slice(from, from + perPage), total: rows.length };
  }
  const db = getPublicServerClient();
  const perPage = Math.min(Math.max(params.perPage ?? 12, 1), 60);
  const page = Math.max(params.page ?? 1, 1);

  let query = db
    .from("content")
    .select(CONTENT_SELECT, { count: "exact" })
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString());

  if (params.typeSlug) query = query.eq("type_slug", params.typeSlug);
  if (params.featured) query = query.eq("is_featured", true);
  if (params.editorsPick) query = query.eq("is_editors_pick", true);
  if (params.excludeId) query = query.neq("id", params.excludeId);
  if (params.ids?.length) query = query.in("id", params.ids);

  if (params.categorySlug) {
    const { data: cat } = await db
      .from("categories")
      .select("id")
      .eq("slug", params.categorySlug)
      .maybeSingle();
    if (!cat) return { items: [], total: 0 };
    query = query.eq("category_id", (cat as { id: string }).id);
  }

  if (params.authorSlug) {
    const { data: author } = await db
      .from("authors")
      .select("id")
      .eq("slug", params.authorSlug)
      .maybeSingle();
    if (!author) return { items: [], total: 0 };
    query = query.eq("author_id", (author as { id: string }).id);
  }

  if (params.tagSlug) {
    const { data: tag } = await db.from("tags").select("id").eq("slug", params.tagSlug).maybeSingle();
    if (!tag) return { items: [], total: 0 };
    const { data: links } = await db
      .from("content_tags")
      .select("content_id")
      .eq("tag_id", (tag as { id: string }).id);
    const ids = ((links ?? []) as { content_id: string }[]).map((l) => l.content_id);
    if (!ids.length) return { items: [], total: 0 };
    query = query.in("id", ids);
  }

  if (params.search) {
    const term = params.search.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,excerpt.ilike.%${term}%,body_html.ilike.%${term}%`,
      );
    }
  }

  if (params.sort === "oldest") query = query.order("published_at", { ascending: true });
  else if (params.sort === "popular") query = query.order("view_count", { ascending: false });
  else query = query.order("published_at", { ascending: false });

  const from = (page - 1) * perPage;
  const { data, count, error } = await query.range(from, from + perPage - 1);
  if (error) throw new Error(error.message);

  const items = ((data ?? []) as Row[]).map((r) => normalize(r)!).filter(Boolean);
  if (items.some((i) => !i.author)) {
    const fallback = await fetchDefaultAuthor();
    for (const item of items) {
      if (!item.author) item.author = fallback;
    }
  }

  return {
    items,
    total: count ?? 0,
  };
}

export async function getContentBySlug(slug: string): Promise<ContentItem | null> {
  if (!isServerDatabaseConfigured()) {
    return PREVIEW_CONTENT.find((i) => i.slug === slug) ?? null;
  }
  const db = getPublicServerClient();
  const { data } = await db.from("content").select(CONTENT_SELECT).eq("slug", slug).maybeSingle();
  const item = normalize(data as Row | null);
  if (!item) return null;
  if (item.status !== "published") return null;
  if (item.published_at && new Date(item.published_at) > new Date()) return null;
  if (!item.author) {
    item.author = resolveAuthor(null, await fetchDefaultAuthor());
  }
  return item;
}

export async function getRelated(item: ContentItem, limit = 3): Promise<ContentItem[]> {
  if (item.related_ids?.length) {
    const { items } = await listContent({ ids: item.related_ids, perPage: limit });
    if (items.length) return items;
  }
  const tagSlug = item.tags?.[0]?.slug;
  if (item.category?.slug) {
    const { items } = await listContent({
      categorySlug: item.category.slug,
      excludeId: item.id,
      perPage: limit,
    });
    if (items.length) return items;
  }
  if (tagSlug) {
    const { items } = await listContent({ tagSlug, excludeId: item.id, perPage: limit });
    if (items.length) return items;
  }
  const { items } = await listContent({ excludeId: item.id, perPage: limit });
  return items;
}

export async function getAdjacent(item: ContentItem) {
  if (!isServerDatabaseConfigured()) {
    const sameType = PREVIEW_CONTENT.filter((i) => i.type_slug === item.type_slug).sort((a, b) =>
      (b.published_at ?? "").localeCompare(a.published_at ?? ""),
    );
    const idx = sameType.findIndex((i) => i.id === item.id);
    const newer = idx > 0 ? sameType[idx - 1] : null;
    const older = idx >= 0 && idx + 1 < sameType.length ? sameType[idx + 1] : null;
    return {
      prev: older ? { title: older.title, slug: older.slug } : null,
      next: newer ? { title: newer.title, slug: newer.slug } : null,
    };
  }
  const db = getPublicServerClient();
  const base = () =>
    db
      .from("content")
      .select("title, slug")
      .eq("status", "published")
      .eq("type_slug", item.type_slug)
      .not("published_at", "is", null);

  const [prev, next] = await Promise.all([
    base()
      .lt("published_at", item.published_at ?? new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    base()
      .gt("published_at", item.published_at ?? new Date().toISOString())
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: (prev.data as { title: string; slug: string } | null) ?? null,
    next: (next.data as { title: string; slug: string } | null) ?? null,
  };
}

export async function getHomepageSections(): Promise<HomepageSection[]> {
  if (!isServerDatabaseConfigured()) return PREVIEW_HOMEPAGE_SECTIONS;
  const db = getPublicServerClient();
  const { data } = await db
    .from("homepage_sections")
    .select("*")
    .eq("enabled", true)
    .order("position");
  return (data ?? []) as HomepageSection[];
}

export async function getPageBySlug(slug: string): Promise<SitePage | null> {
  if (!isServerDatabaseConfigured()) {
    return PREVIEW_PAGES.find((p) => p.slug === slug) ?? null;
  }
  const db = getPublicServerClient();
  const { data } = await db
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as SitePage | null) ?? null;
}

export async function getAuthorBySlug(slug: string) {
  if (!isServerDatabaseConfigured()) {
    return PREVIEW_AUTHORS.find((a) => a.slug === slug) ?? null;
  }
  const db = getPublicServerClient();
  const { data } = await db.from("authors").select("*").eq("slug", slug).maybeSingle();
  if (!data && slug === DEFAULT_AUTHOR_SLUG) return DEFAULT_AUTHOR;
  return data;
}

export async function getCategoryBySlug(slug: string) {
  if (!isServerDatabaseConfigured()) {
    return PREVIEW_CATEGORIES.find((c) => c.slug === slug) ?? null;
  }
  const db = getPublicServerClient();
  const { data } = await db.from("categories").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function getTagBySlug(slug: string) {
  if (!isServerDatabaseConfigured()) {
    return PREVIEW_TAGS.find((t) => t.slug === slug) ?? null;
  }
  const db = getPublicServerClient();
  const { data } = await db.from("tags").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function getRedirectFor(path: string) {
  if (!isServerDatabaseConfigured()) return null;
  const db = getPublicServerClient();
  const { data } = await db
    .from("redirects")
    .select("*")
    .eq("source_path", path)
    .eq("enabled", true)
    .maybeSingle();
  return data as { destination_path: string; kind: "301" | "302" } | null;
}
