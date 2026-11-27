import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { ImageInfo } from "@/components/admin/ImageInfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/MediaPicker";
import { ReadabilityPanel } from "@/components/admin/ReadabilityPanel";
import { RichEditor } from "@/components/admin/RichEditor";
import { WordUpload } from "@/components/admin/WordUpload";
import { Btn, Field, Panel, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/ui";
import { db as supabase } from "@/lib/db/client";
import { saveRow, uploadMedia, useRows } from "@/lib/admin/api";
import type { WordArticle } from "@/lib/admin/word-import";
import { readingTime, slugify } from "@/lib/format";
import { DEFAULT_AUTHOR_SLUG } from "@/lib/authors";
import { folderForContentType } from "@/lib/media-folders";
import {
  MAX_ARTICLE_TAGS,
  resolveApprovedCategory,
  resolveApprovedTags,
} from "@/lib/taxonomy";
import { toSavedReadability, type ReadabilityResult } from "@/lib/analysis/readability";
import type { Author, Category, ContentItem, ContentType, SeoFields, Tag } from "@/lib/types";

export const Route = createFileRoute("/admin/content/$id")({
  head: () => ({
    meta: [
      { title: "Article editor | Fabric-Pro" },
      {
        name: "description",
        content: "Write, import and manage Fabric-Pro articles and SEO metadata.",
      },
      { property: "og:title", content: "Article editor | Fabric-Pro" },
      {
        property: "og:description",
        content: "Write, import and manage Fabric-Pro articles and SEO metadata.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentEditor,
});

type Draft = Partial<ContentItem> & { seo: SeoFields };

const EMPTY: Draft = {
  title: "",
  slug: "",
  type_slug: "news",
  excerpt: "",
  body_html: "",
  body_markdown: "",
  editor_mode: "rich",
  status: "draft",
  is_featured: false,
  is_editors_pick: false,
  featured_image_url: "",
  featured_image_alt: "",
  featured_image_caption: "",
  video_url: "",
  video_provider: "",
  seo: {},
  related_ids: [],
};

function ContentEditor() {
  const { id } = useParams({ from: "/admin/content/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const readability = useRef<ReadabilityResult | null>(null);

  const { data: types = [] } = useRows<ContentType>("content_types", {
    order: { column: "position" },
  });
  const { data: categories = [] } = useRows<Category>("categories", {
    order: { column: "position" },
  });
  const { data: authors = [] } = useRows<Author>("authors", { order: { column: "name" } });
  const { data: tags = [] } = useRows<Tag>("tags", { order: { column: "name" } });

  const { data: existing } = useQuery({
    queryKey: ["admin", "content-item", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*, content_tags(tag_id)")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data as ContentItem & { content_tags: { tag_id: string }[] };
    },
  });

  useEffect(() => {
    if (existing) {
      setDraft({ ...existing, seo: existing.seo ?? {} });
      setTagIds((existing.content_tags ?? []).map((t) => t.tag_id));
    }
  }, [existing]);

  useEffect(() => {
    if (!isNew || draft.author_id || authors.length === 0) return;
    const def = authors.find((a) => a.slug === DEFAULT_AUTHOR_SLUG) ?? authors[0];
    if (def) setDraft((d) => (d.author_id ? d : { ...d, author_id: def.id }));
  }, [isNew, draft.author_id, authors]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setSeo = (patch: Partial<SeoFields>) =>
    setDraft((d) => ({ ...d, seo: { ...d.seo, ...patch } }));

  const currentType = types.find((t) => t.slug === draft.type_slug);
  const mediaFolder = folderForContentType(draft.type_slug);

  async function importArticle(
    article: WordArticle,
    image: File | null,
    library: { url: string; alt: string } | null,
  ) {
    setImporting(true);
    const warnings: string[] = [];
    try {
      const author =
        authors.find((a) => a.name.toLowerCase() === article.authorName.toLowerCase()) ??
        authors.find((a) => a.slug === DEFAULT_AUTHOR_SLUG);
      if (!author)
        warnings.push(
          `Author “${article.authorName}” was not found; select an author before publishing.`,
        );
      else if (author.name.toLowerCase() !== article.authorName.toLowerCase())
        warnings.push(`Author “${article.authorName}” was not found; Pankaj Singh was selected.`);
      const approvedCat = resolveApprovedCategory(article.categoryName);
      const category = approvedCat
        ? categories.find((c) => c.slug === approvedCat.slug)
        : undefined;
      if (article.categoryName && !category) {
        warnings.push(
          `Category “${article.categoryName}” is not in the approved list; choose one of the approved Fabric-Pro categories.`,
        );
      }
      const resolvedTags = resolveApprovedTags(article.tagNames, MAX_ARTICLE_TAGS);
      const matchedTags = resolvedTags.matched
        .map((at) => tags.find((t) => t.slug === at.slug))
        .filter((t): t is Tag => Boolean(t));
      if (resolvedTags.unmatched.length) {
        warnings.push(
          `Skipped unapproved tags: ${resolvedTags.unmatched.join(", ")}. Only approved tags are allowed.`,
        );
      }
      if (resolvedTags.truncated) {
        warnings.push(`Kept the first ${MAX_ARTICLE_TAGS} approved tags (max ${MAX_ARTICLE_TAGS} per article).`);
      }
      let featured: Partial<Draft> = {};
      if (image) {
        if (!/^image\/(webp|jpeg|png)$/.test(image.type) || image.size > 25 * 1024 * 1024)
          throw new Error("Choose a WebP, JPG or PNG image smaller than 25 MB.");
        const bitmap = await createImageBitmap(image);
        bitmap.close();
        const media = await uploadMedia(image, "news");
        const alt = article.imageAlt || image.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        await saveRow("media", { id: String(media["id"]), alt_text: alt });
        featured = { featured_image_url: String(media["public_url"]), featured_image_alt: alt };
        void qc.invalidateQueries({ queryKey: ["admin", "media"] });
      } else if (library) {
        featured = {
          featured_image_url: library.url,
          featured_image_alt: article.imageAlt || library.alt,
        };
      }
      setDraft((d) => ({
        ...d,
        title: article.title,
        slug: article.slug,
        type_slug: "news",
        excerpt: article.excerpt,
        body_html: article.html,
        body_markdown: "",
        editor_mode: "rich",
        status: "draft",
        author_id: author?.id ?? null,
        category_id: category?.id ?? null,
        published_at: article.publicationDate || null,
        seo: {
          ...article.seo,
          ...(featured.featured_image_url ? { ogImage: featured.featured_image_url } : {}),
        },
        ...featured,
      }));
      setTagIds(matchedTags.map((t) => t.id));
      readability.current = null;
      return warnings;
    } finally {
      setImporting(false);
    }
  }

  async function save(nextStatus?: string) {
    if (!draft.title) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const status = nextStatus ?? draft.status ?? "draft";
      const categoryId = draft.category_id || null;
      const savedTagIds = Array.from(new Set(tagIds)).slice(0, MAX_ARTICLE_TAGS);
      const payload: Record<string, unknown> = {
        ...(isNew ? {} : { id }),
        title: draft.title,
        slug: draft.slug || slugify(draft.title),
        type_slug: draft.type_slug,
        excerpt: draft.excerpt || null,
        body_html: draft.body_html || null,
        body_markdown: draft.body_markdown || null,
        editor_mode: draft.editor_mode ?? "rich",
        featured_image_url: draft.featured_image_url || null,
        featured_image_alt: draft.featured_image_alt || null,
        featured_image_caption: draft.featured_image_caption || null,
        author_id: draft.author_id || null,
        category_id: categoryId,
        status,
        is_featured: !!draft.is_featured,
        is_editors_pick: !!draft.is_editors_pick,
        video_url: draft.video_url || null,
        video_provider: draft.video_provider || null,
        video_thumbnail_url: draft.video_thumbnail_url || null,
        reading_minutes: readingTime(draft.body_html ?? ""),
        seo: {
          ...(draft.seo ?? {}),
          ...(readability.current ? { readability: toSavedReadability(readability.current) } : {}),
        },
        related_ids: draft.related_ids ?? [],
        scheduled_for: draft.scheduled_for || null,
        published_at:
          status === "published"
            ? (draft.published_at ?? new Date().toISOString())
            : draft.published_at || null,
      };
      const row = await saveRow("content", payload as { id?: string });
      const rowId = String(row["id"]);

      const { error: deleteTagsError } = await supabase
        .from("content_tags")
        .delete()
        .eq("content_id", rowId);
      if (deleteTagsError) throw new Error(deleteTagsError.message);
      if (savedTagIds.length) {
        const { error: tagsError } = await supabase
          .from("content_tags")
          .insert(
            savedTagIds.map((tag_id) => ({ content_id: rowId, tag_id })),
          );
        if (tagsError) throw new Error(tagsError.message);
      }

      setTagIds(savedTagIds);
      set({ category_id: categoryId });

      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Saved");
      if (isNew) void navigate({ to: "/admin/content/$id", params: { id: rowId } });
      else set({ status: status as ContentItem["status"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-foreground">
          {isNew ? "New content" : draft.title || "Edit content"}
        </h1>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={() => void navigate({ to: "/admin/content" })}>
            Back
          </Btn>
          <Btn variant="outline" disabled={saving || importing} onClick={() => void save("draft")}>
            Save draft
          </Btn>
          <Btn disabled={saving || importing} onClick={() => void save("published")}>
            {saving ? "Saving…" : "Publish"}
          </Btn>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {isNew && draft.type_slug === "news" ? (
            <WordUpload
              onImport={importArticle}
              hasContent={!!draft.title || !!draft.body_html}
              disabled={saving || authors.length === 0 || types.length === 0}
            />
          ) : null}
          <Panel title="Content">
            <div className="space-y-3">
              <Field label="Title">
                <TextInput
                  value={draft.title ?? ""}
                  onChange={(e) =>
                    set({
                      title: e.target.value,
                      slug: isNew ? slugify(e.target.value) : (draft.slug ?? ""),
                    })
                  }
                />
              </Field>
              <Field label="Slug">
                <TextInput
                  value={draft.slug ?? ""}
                  onChange={(e) => set({ slug: slugify(e.target.value) })}
                />
              </Field>
              <Field label="Excerpt" hint="Used in cards, archives and meta description fallback.">
                <TextArea
                  value={draft.excerpt ?? ""}
                  onChange={(e) => set({ excerpt: e.target.value })}
                />
              </Field>
              <RichEditor
                {...(mediaFolder ? { mediaFolder } : {})}
                value={{
                  html: draft.body_html ?? "",
                  markdown: draft.body_markdown ?? "",
                  mode: draft.editor_mode ?? "rich",
                }}
                onChange={(v) =>
                  set({ body_html: v.html, body_markdown: v.markdown, editor_mode: v.mode })
                }
              />
            </div>
          </Panel>

          {currentType?.is_video ? (
            <Panel title="Video">
              <div className="space-y-3">
                <Field label="Video URL (YouTube / Vimeo)">
                  <TextInput
                    value={draft.video_url ?? ""}
                    onChange={(e) => set({ video_url: e.target.value })}
                  />
                </Field>
                <MediaPicker
                  label="Video thumbnail"
                  {...(mediaFolder ? { defaultFolder: mediaFolder } : {})}
                  value={draft.video_thumbnail_url ?? ""}
                  onChange={(url) => set({ video_thumbnail_url: url })}
                />
              </div>
            </Panel>
          ) : null}

          <Panel title="Source attribution">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source name" hint="Shown in the author box (use for Updates / news).">
                <TextInput
                  value={draft.seo?.sourceName ?? ""}
                  onChange={(e) => setSeo({ sourceName: e.target.value })}
                />
              </Field>
              <Field label="Source URL">
                <TextInput
                  value={draft.seo?.sourceUrl ?? ""}
                  onChange={(e) => setSeo({ sourceUrl: e.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta title" hint={`${(draft.seo?.title ?? "").length}/60`}>
                <TextInput
                  value={draft.seo?.title ?? ""}
                  onChange={(e) => setSeo({ title: e.target.value })}
                />
              </Field>
              <Field label="Focus keyword">
                <TextInput
                  value={draft.seo?.focusKeyword ?? ""}
                  onChange={(e) => setSeo({ focusKeyword: e.target.value })}
                />
              </Field>
              <Field
                label="Meta description"
                className="sm:col-span-2"
                hint={`${(draft.seo?.description ?? "").length}/160`}
              >
                <TextArea
                  value={draft.seo?.description ?? ""}
                  onChange={(e) => setSeo({ description: e.target.value })}
                />
              </Field>
              <Field label="Canonical URL">
                <TextInput
                  value={draft.seo?.canonical ?? ""}
                  onChange={(e) => setSeo({ canonical: e.target.value })}
                />
              </Field>
              <Field label="Secondary keywords">
                <TextInput
                  value={draft.seo?.secondaryKeywords ?? ""}
                  onChange={(e) => setSeo({ secondaryKeywords: e.target.value })}
                />
              </Field>
              <Field label="Search intent">
                <TextInput
                  value={draft.seo?.searchIntent ?? ""}
                  onChange={(e) => setSeo({ searchIntent: e.target.value })}
                />
              </Field>
              <Field label="Social title">
                <TextInput
                  value={draft.seo?.ogTitle ?? ""}
                  onChange={(e) => setSeo({ ogTitle: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <MediaPicker
                  label="Social share image"
                  {...(mediaFolder ? { defaultFolder: mediaFolder } : {})}
                  value={draft.seo?.ogImage ?? ""}
                  onChange={(url) => setSeo({ ogImage: url })}
                />
              </div>
              <Toggle
                label="No-index this item"
                checked={!!draft.seo?.noindex}
                onChange={(v) => setSeo({ noindex: v })}
              />
              <Toggle
                label="No-follow links"
                checked={!!draft.seo?.nofollow}
                onChange={(v) => setSeo({ nofollow: v })}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Publish">
            <div className="space-y-3">
              <Field label="Status">
                <SelectInput
                  value={draft.status ?? "draft"}
                  onChange={(e) => set({ status: e.target.value as ContentItem["status"] })}
                >
                  {["draft", "scheduled", "published", "archived"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Schedule for">
                <TextInput
                  type="datetime-local"
                  value={(draft.scheduled_for ?? "").slice(0, 16)}
                  onChange={(e) =>
                    set({
                      scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </Field>
              <Field label="Publication date">
                <TextInput
                  type="date"
                  value={(draft.published_at ?? "").slice(0, 10)}
                  onChange={(e) =>
                    set({ published_at: e.target.value ? `${e.target.value}T06:30:00.000Z` : null })
                  }
                />
              </Field>
              <Toggle
                label="Featured"
                checked={!!draft.is_featured}
                onChange={(v) => set({ is_featured: v })}
              />
              <Toggle
                label="Editor's pick"
                checked={!!draft.is_editors_pick}
                onChange={(v) => set({ is_editors_pick: v })}
              />
            </div>
          </Panel>

          <ReadabilityPanel
            html={draft.body_html ?? ""}
            audience={draft.seo?.audience}
            onAudienceChange={(a) => setSeo(a ? { audience: a } : { audience: undefined })}
            ignoredWords={draft.seo?.readabilityIgnored ?? []}
            onIgnoreWord={(w) =>
              setSeo({
                readabilityIgnored: Array.from(
                  new Set([...(draft.seo?.readabilityIgnored ?? []), w.toLowerCase()]),
                ),
              })
            }
            onResult={(r) => {
              readability.current = r;
            }}
          />

          <Panel title="Organisation">
            <div className="space-y-3">
              <Field label="Content type">
                <SelectInput
                  value={draft.type_slug ?? ""}
                  onChange={(e) => set({ type_slug: e.target.value })}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Category">
                <SelectInput
                  value={draft.category_id ?? ""}
                  onChange={(e) => {
                    set({ category_id: e.target.value || null });
                  }}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Author">
                <SelectInput
                  value={draft.author_id ?? ""}
                  onChange={(e) => set({ author_id: e.target.value || null })}
                >
                  <option value="">None</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field
                label={`Tags (${tagIds.length}/${MAX_ARTICLE_TAGS} max)`}
                hint={`Ctrl/Cmd-click to select up to ${MAX_ARTICLE_TAGS} approved tags.`}
              >
                <select
                  multiple
                  value={tagIds}
                  onChange={(e) => {
                    const picked = Array.from(e.target.selectedOptions).map((o) => o.value);
                    if (picked.length > MAX_ARTICLE_TAGS) {
                      toast.error(`You can assign at most ${MAX_ARTICLE_TAGS} tags per article.`);
                      setTagIds(picked.slice(0, MAX_ARTICLE_TAGS));
                      return;
                    }
                    setTagIds(picked);
                  }}
                  className="h-32 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Featured image">
            <div className="space-y-3">
              <MediaPicker
                label="Image"
                {...(mediaFolder ? { defaultFolder: mediaFolder } : {})}
                value={draft.featured_image_url ?? ""}
                onChange={(url, item) =>
                  set({
                    featured_image_url: url,
                    ...(item?.alt_text && !draft.featured_image_alt
                      ? { featured_image_alt: item.alt_text }
                      : {}),
                  })
                }
              />
              <ImageInfo url={draft.featured_image_url ?? ""} kind="featured" />
              <Field label="Alt text">
                <TextInput
                  value={draft.featured_image_alt ?? ""}
                  onChange={(e) => set({ featured_image_alt: e.target.value })}
                />
              </Field>
              <Field label="Caption">
                <TextInput
                  value={draft.featured_image_caption ?? ""}
                  onChange={(e) => set({ featured_image_caption: e.target.value })}
                />
              </Field>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
