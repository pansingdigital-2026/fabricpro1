import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isUpdatesType } from "./toc";
import type { ContentItem, SectionSettings } from "./types";

const listSchema = z.object({
  typeSlug: z.string().optional(),
  categorySlug: z.string().optional(),
  tagSlug: z.string().optional(),
  authorSlug: z.string().optional(),
  search: z.string().max(120).optional(),
  featured: z.boolean().optional(),
  editorsPick: z.boolean().optional(),
  ids: z.array(z.string().uuid()).optional(),
  sort: z.enum(["newest", "oldest", "popular"]).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(60).optional(),
  excludeId: z.string().uuid().optional(),
});

const slugSchema = z.object({ slug: z.string().min(1).max(200) });

export const fetchSiteBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchBootstrap } = await import("./public.server");
  return fetchBootstrap();
});

export const fetchContentList = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { listContent } = await import("./public.server");
    return listContent(data);
  });

export const fetchArticle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { getContentBySlug, getRelated, getAdjacent, listContent } = await import(
      "./public.server"
    );
    const item = await getContentBySlug(data.slug);
    if (!item) return { item: null, related: [], recentUpdates: [], prev: null, next: null };
    const [related, adjacent, recentUpdatesRes] = await Promise.all([
      getRelated(item),
      getAdjacent(item),
      isUpdatesType(item.type_slug)
        ? listContent({
            typeSlug: item.type_slug,
            excludeId: item.id,
            sort: "newest",
            perPage: 5,
          })
        : Promise.resolve({ items: [] as ContentItem[], total: 0 }),
    ]);
    return {
      item,
      related,
      recentUpdates: recentUpdatesRes.items,
      prev: adjacent.prev,
      next: adjacent.next,
    };
  });

export const fetchHomepage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ page: z.number().int().min(1).default(1) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { getHomepageSections, listContent } = await import("./public.server");
    const sections = await getHomepageSections();

    const CONTENT_BLOCKS = [
      "featured",
      "featured_with_sidebar",
      "article_grid",
      "article_list",
      "video_grid",
      "related",
    ];

    // Ids used by the lead feature block so the paginated grid never repeats them.
    let excludeIds: string[] = [];

    const results = await Promise.all(
      sections.map(async (section) => {
        const s: SectionSettings = section.settings ?? {};
        if (!CONTENT_BLOCKS.includes(section.block_type)) {
          return { sectionId: section.id, items: [], total: 0 };
        }
        const limit = Number(s.limit ?? 3);
        const sort = s.sort ?? "newest";
        if (s.source === "manual" && Array.isArray(s.manualIds) && s.manualIds.length) {
          const { items, total } = await listContent({
            ids: s.manualIds as string[],
            perPage: limit,
          });
          return { sectionId: section.id, items, total };
        }
        const paginate = s["paginate"] === true;
        const { items, total } = await listContent({
          typeSlug: s.source === "type" ? (s.typeSlug as string | undefined) : undefined,
          categorySlug: s.source === "category" ? (s.categorySlug as string | undefined) : undefined,
          featured: s.source === "featured" ? true : undefined,
          editorsPick: s.source === "editors_pick" ? true : undefined,
          sort: s.source === "popular" ? "popular" : (sort as "newest" | "oldest" | "popular"),
          perPage: limit,
          page: paginate ? data.page : 1,
        });
        if (section.block_type === "featured_with_sidebar") {
          excludeIds = items[0] ? [items[0].id] : [];
        }
        return { sectionId: section.id, items, total };
      }),
    );

    const map: Record<string, ContentItem[]> = {};
    const totals: Record<string, number> = {};
    for (const r of results) {
      map[r.sectionId] = r.items as ContentItem[];
      totals[r.sectionId] = r.total;
    }
    const { isServerDatabaseConfigured } = await import("./db.server");
    return {
      sections,
      itemsBySection: map,
      totalsBySection: totals,
      page: data.page,
      excludeIds,
      dbConfigured: isServerDatabaseConfigured(),
    };
  });


export const fetchPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const { getPageBySlug, listContent } = await import("./public.server");
    const page = await getPageBySlug(data.slug);
    if (!page) return { page: null, itemsBySection: {} };

    const entries = await Promise.all(
      (page.sections ?? []).map(async (section) => {
        const s: SectionSettings = section.settings ?? {};
        if (!["featured", "article_grid", "article_list", "video_grid", "category_feed", "related"].includes(section.type)) {
          return [section.id, []] as const;
        }
        const { items } = await listContent({
          typeSlug: s.source === "type" ? (s.typeSlug as string | undefined) : undefined,
          categorySlug: s.source === "category" ? (s.categorySlug as string | undefined) : undefined,
          featured: s.source === "featured" ? true : undefined,
          editorsPick: s.source === "editors_pick" ? true : undefined,
          ids: s.source === "manual" ? (s.manualIds as string[] | undefined) : undefined,
          sort: (s.sort ?? "newest") as "newest" | "oldest" | "popular",
          perPage: Number(s.limit ?? 3),
        });
        return [section.id, items] as const;
      }),
    );
    return { page, itemsBySection: Object.fromEntries(entries) as Record<string, ContentItem[]> };
  });

export const fetchArchive = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["type", "category", "tag", "author", "search"]),
        slug: z.string().max(200).optional(),
        query: z.string().max(120).optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(60).default(12),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const mod = await import("./public.server");
    const base = { page: data.page, perPage: data.perPage };
    switch (data.kind) {
      case "type": {
        const { items, total } = await mod.listContent({ ...base, typeSlug: data.slug });
        return { items, total, meta: null };
      }
      case "category": {
        const meta = await mod.getCategoryBySlug(data.slug ?? "");
        if (!meta) return { items: [], total: 0, meta: null };
        const { items, total } = await mod.listContent({ ...base, categorySlug: data.slug });
        return { items, total, meta };
      }
      case "tag": {
        const meta = await mod.getTagBySlug(data.slug ?? "");
        if (!meta) return { items: [], total: 0, meta: null };
        const { items, total } = await mod.listContent({ ...base, tagSlug: data.slug });
        return { items, total, meta };
      }
      case "author": {
        const meta = await mod.getAuthorBySlug(data.slug ?? "");
        if (!meta) return { items: [], total: 0, meta: null };
        const { items, total } = await mod.listContent({ ...base, authorSlug: data.slug });
        return { items, total, meta };
      }
      default: {
        const { items, total } = await mod.listContent({ ...base, search: data.query });
        return { items, total, meta: null };
      }
    }
  });

export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        subject: z.string().trim().max(150).optional(),
        message: z.string().trim().min(5).max(4000),
        website: z.string().max(200).optional(), // honeypot
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.website) return { ok: true }; // silently drop bots
    const { getAdminClient } = await import("./db.server");
    const { error } = await getAdminClient().from("contact_submissions").insert({
      name: data.name,
      email: data.email,
      subject: data.subject ?? null,
      message: data.message,
    });
    if (error) throw new Error("Could not send your message. Please try again.");
    return { ok: true };
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./db.server");
    const { error } = await getAdminClient()
      .from("newsletter_subscribers")
      .upsert({ email: data.email.toLowerCase() }, { onConflict: "email" });
    if (error) throw new Error("Could not subscribe. Please try again.");
    return { ok: true };
  });
