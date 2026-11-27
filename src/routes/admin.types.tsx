import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Btn, Empty, Field, Panel, Table, TextArea, TextInput, Toggle } from "@/components/admin/ui";
import { useRemove, useRows, useSave } from "@/lib/admin/api";
import { slugify } from "@/lib/format";
import type { ContentType } from "@/lib/types";

export const Route = createFileRoute("/admin/types")({
  component: ContentTypes,
});

const EMPTY: Partial<ContentType> = {
  name: "",
  plural_name: "",
  slug: "",
  description: "",
  is_video: false,
  enabled: true,
};

function ContentTypes() {
  const { data: rows = [] } = useRows<ContentType>("content_types", {
    order: { column: "position" },
  });
  const save = useSave("content_types");
  const remove = useRemove("content_types");
  const [draft, setDraft] = useState<Partial<ContentType>>(EMPTY);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title={draft.id ? "Edit content type" : "New content type"}
        description="Each type gets its own archive at /slug."
      >
        <div className="space-y-3">
          <Field label="Singular name">
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
          <Field label="Plural name">
            <TextInput
              value={draft.plural_name ?? ""}
              onChange={(e) => setDraft({ ...draft, plural_name: e.target.value })}
            />
          </Field>
          <Field label="Slug" hint="Archive URL segment.">
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
          <Toggle
            label="Video type (shows video fields)"
            checked={!!draft.is_video}
            onChange={(v) => setDraft({ ...draft, is_video: v })}
          />
          <Toggle
            label="Enabled"
            checked={draft.enabled !== false}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
          />
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                if (!draft.name) return;
                save.mutate({
                  ...(draft.id ? { id: draft.id } : {}),
                  name: draft.name,
                  plural_name: draft.plural_name || draft.name,
                  slug: draft.slug || slugify(draft.name),
                  description: draft.description ?? null,
                  is_video: !!draft.is_video,
                  enabled: draft.enabled !== false,
                  position: draft.position ?? rows.length + 1,
                });
                setDraft(EMPTY);
              }}
            >
              {draft.id ? "Update" : "Add type"}
            </Btn>
            {draft.id ? (
              <Btn variant="outline" onClick={() => setDraft(EMPTY)}>
                Cancel
              </Btn>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Content types">
        {rows.length === 0 ? (
          <Empty text="No content types." />
        ) : (
          <Table head={["Name", "Slug", "Enabled", ""]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">{row.plural_name}</td>
                <td className="px-3 py-2 text-muted-foreground">/{row.slug}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => save.mutate({ id: row.id, enabled: e.target.checked })}
                  />
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
      </Panel>
    </div>
  );
}
