import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/MediaPicker";
import { Btn, Empty, Field, Panel, Table, TextArea, TextInput } from "@/components/admin/ui";
import { useRemove, useRows, useSave } from "@/lib/admin/api";
import { slugify } from "@/lib/format";
import { APPROVED_CATEGORIES, APPROVED_TAGS, MAX_ARTICLE_TAGS } from "@/lib/taxonomy";
import { applyApprovedTaxonomy } from "@/lib/taxonomy.functions";
import type { Category, Tag } from "@/lib/types";

export const Route = createFileRoute("/admin/taxonomy")({
  component: Taxonomy,
});

function Taxonomy() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  async function handleSyncApproved() {
    if (
      !window.confirm(
        `Replace all categories and tags with the ${APPROVED_CATEGORIES.length} approved categories (with descriptions) and ${APPROVED_TAGS.length} approved tags, and reassign every existing article (max ${MAX_ARTICLE_TAGS} tags each)?`,
      )
    ) {
      return;
    }
    setSyncing(true);
    try {
      const summary = await applyApprovedTaxonomy();
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(
        `Synced ${summary.categoriesCount} categories and ${summary.tagsCount} tags; reassigned ${summary.articlesUpdated} articles (removed ${summary.removedCategories} old categories and ${summary.removedTags} old tags).`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Approved Taxonomy"
        description={`Keep the site locked to the ${APPROVED_CATEGORIES.length} core categories and ${APPROVED_TAGS.length} approved tags (max ${MAX_ARTICLE_TAGS} tags per article).`}
        actions={
          <Btn disabled={syncing} onClick={() => void handleSyncApproved()}>
            {syncing ? "Applying…" : "Apply Approved Categories & Tags"}
          </Btn>
        }
      >
        <p className="text-xs text-muted-foreground">
          Applies the {APPROVED_CATEGORIES.length} core categories with descriptions and{" "}
          {APPROVED_TAGS.length} approved tags, reassigns all existing articles, and removes extra
          categories and tags. Safe to run again anytime.
        </p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Categories />
        <Tags />
      </div>
    </div>
  );
}

function Categories() {
  const { data: rows = [] } = useRows<Category>("categories", { order: { column: "position" } });
  const save = useSave("categories");
  const remove = useRemove("categories");
  const [draft, setDraft] = useState<Partial<Category>>({ name: "", slug: "" });

  return (
    <Panel title="Categories" description="Group content into editorial sections.">
      <div className="space-y-3">
        <Field label="Name">
          <TextInput
            value={draft.name ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                name: e.target.value,
                slug: draft.id ? (draft.slug ?? "") : slugify(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Slug">
          <TextInput
            value={draft.slug ?? ""}
            onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
          />
        </Field>
        <Field label="Description">
          <TextArea
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <MediaPicker
          label="Category image"
          value={draft.image_url ?? ""}
          onChange={(url) => setDraft({ ...draft, image_url: url })}
        />
        <div className="flex gap-2">
          <Btn
            onClick={() => {
              if (!draft.name) return;
              save.mutate({
                ...(draft.id ? { id: draft.id } : {}),
                name: draft.name,
                slug: draft.slug || slugify(draft.name),
                description: draft.description ?? null,
                image_url: draft.image_url ?? null,
              });
              setDraft({ name: "", slug: "" });
            }}
          >
            {draft.id ? "Update category" : "Add category"}
          </Btn>
          {draft.id ? (
            <Btn variant="outline" onClick={() => setDraft({ name: "", slug: "" })}>
              Cancel
            </Btn>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Empty text="No categories yet." />
        ) : (
          <Table head={["Name", "Description", ""]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {row.description || "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn variant="ghost" onClick={() => setDraft(row)}>
                    Edit
                  </Btn>
                  <Btn variant="ghost" onClick={() => remove.mutate(row.id)}>
                    Delete
                  </Btn>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </Panel>
  );
}

function Tags() {
  const { data: rows = [] } = useRows<Tag>("tags", { order: { column: "name" } });
  const save = useSave("tags");
  const remove = useRemove("tags");
  const [name, setName] = useState("");

  return (
    <Panel title="Tags" description="Fine-grained topics attached to content.">
      <div className="flex gap-2">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag" />
        <Btn
          onClick={() => {
            if (!name) return;
            save.mutate({ name, slug: slugify(name) });
            setName("");
          }}
        >
          Add
        </Btn>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rows.length === 0 ? (
          <Empty text="No tags yet." />
        ) : (
          rows.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                if (window.confirm(`Delete tag "${tag.name}"?`)) remove.mutate(tag.id);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              {tag.name} ×
            </button>
          ))
        )}
      </div>
    </Panel>
  );
}
