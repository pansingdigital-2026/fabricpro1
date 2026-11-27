import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/MediaPicker";
import { SectionBuilder, type BuilderSection } from "@/components/admin/SectionBuilder";
import { Btn, Field, Panel, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/ui";
import { db as supabase } from "@/lib/db/client";
import { saveRow, useRows } from "@/lib/admin/api";
import { slugify } from "@/lib/format";
import type { Category, ContentType, SeoFields, SitePage } from "@/lib/types";

export const Route = createFileRoute("/admin/pages/$id")({
  component: PageEditor,
});

function PageEditor() {
  const { id } = useParams({ from: "/admin/pages/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [seo, setSeo] = useState<SeoFields>({});
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: types = [] } = useRows<ContentType>("content_types", {
    order: { column: "position" },
  });
  const { data: categories = [] } = useRows<Category>("categories", {
    order: { column: "position" },
  });

  const { data: existing } = useQuery({
    queryKey: ["admin", "page", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("pages").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data as SitePage;
    },
  });

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setSlug(existing.slug);
    setStatus(existing.status);
    setSeo(existing.seo ?? {});
    setSections(
      (existing.sections ?? []).map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title ?? "",
        subtitle: s.subtitle ?? "",
        enabled: true,
        settings: s.settings ?? {},
      })),
    );
  }, [existing]);

  async function save(nextStatus?: string) {
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const finalStatus = nextStatus ?? status;
      const row = await saveRow("pages", {
        ...(isNew ? {} : { id }),
        title,
        slug: slug || slugify(title),
        status: finalStatus,
        seo,
        sections: sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          subtitle: s.subtitle,
          settings: s.settings,
        })),
        published_at: finalStatus === "published" ? new Date().toISOString() : null,
      } as { id?: string });
      setStatus(finalStatus);
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Page saved");
      if (isNew) void navigate({ to: "/admin/pages/$id", params: { id: String(row["id"]) } });
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
          {isNew ? "New page" : title || "Edit page"}
        </h1>
        <div className="flex gap-2">
          <Btn variant="outline" onClick={() => void navigate({ to: "/admin/pages" })}>
            Back
          </Btn>
          <Btn variant="outline" disabled={saving} onClick={() => void save("draft")}>
            Save draft
          </Btn>
          <Btn disabled={saving} onClick={() => void save("published")}>
            {saving ? "Saving…" : "Publish"}
          </Btn>
        </div>
      </div>

      <Panel title="Page details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <TextInput
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (isNew) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug" hint="Published at /p/slug">
            <TextInput value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
          </Field>
          <Field label="Status">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              {["draft", "published", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </Panel>

      <Panel title="Sections" description="Build the page from reusable blocks.">
        <SectionBuilder
          sections={sections}
          onChange={setSections}
          types={types}
          categories={categories}
        />
      </Panel>

      <Panel title="SEO">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta title">
            <TextInput
              value={seo.title ?? ""}
              onChange={(e) => setSeo({ ...seo, title: e.target.value })}
            />
          </Field>
          <Field label="Canonical URL">
            <TextInput
              value={seo.canonical ?? ""}
              onChange={(e) => setSeo({ ...seo, canonical: e.target.value })}
            />
          </Field>
          <Field label="Meta description" className="sm:col-span-2">
            <TextArea
              value={seo.description ?? ""}
              onChange={(e) => setSeo({ ...seo, description: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <MediaPicker
              label="Social share image"
              value={seo.ogImage ?? ""}
              onChange={(url) => setSeo({ ...seo, ogImage: url })}
            />
          </div>
          <Toggle
            label="No-index this page"
            checked={!!seo.noindex}
            onChange={(v) => setSeo({ ...seo, noindex: v })}
          />
        </div>
      </Panel>
    </div>
  );
}
