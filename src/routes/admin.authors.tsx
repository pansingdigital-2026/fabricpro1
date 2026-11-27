import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { MediaPicker } from "@/components/admin/MediaPicker";
import { Btn, Empty, Field, Panel, Table, TextArea, TextInput } from "@/components/admin/ui";
import { useRemove, useRows, useSave } from "@/lib/admin/api";
import { slugify } from "@/lib/format";
import type { Author } from "@/lib/types";

export const Route = createFileRoute("/admin/authors")({
  component: Authors,
});

const EMPTY: Partial<Author> = {
  name: "",
  slug: "",
  job_title: "",
  bio: "",
  photo_url: "",
  social_links: {},
};

function Authors() {
  const { data: rows = [] } = useRows<Author>("authors", { order: { column: "name" } });
  const save = useSave("authors");
  const remove = useRemove("authors");
  const [draft, setDraft] = useState<Partial<Author>>(EMPTY);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={draft.id ? "Edit author" : "New author"}>
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
          <Field label="Role / title">
            <TextInput
              placeholder="e.g. Founder & Editor"
              value={draft.job_title ?? ""}
              onChange={(e) => setDraft({ ...draft, job_title: e.target.value })}
            />
          </Field>
          <Field label="LinkedIn URL">
            <TextInput
              placeholder="https://www.linkedin.com/in/..."
              value={draft.social_links?.["linkedin"] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  social_links: { ...(draft.social_links ?? {}), linkedin: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Bio">
            <TextArea
              value={draft.bio ?? ""}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            />
          </Field>
          <MediaPicker
            label="Avatar"
            value={draft.photo_url ?? ""}
            onChange={(url) => setDraft({ ...draft, photo_url: url })}
          />
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                if (!draft.name) return;
                const linkedin = draft.social_links?.["linkedin"]?.trim();
                const socialLinks = { ...(draft.social_links ?? {}) };
                if (linkedin) socialLinks["linkedin"] = linkedin;
                else delete socialLinks["linkedin"];
                save.mutate({
                  ...(draft.id ? { id: draft.id } : {}),
                  name: draft.name,
                  slug: draft.slug || slugify(draft.name),
                  job_title: draft.job_title?.trim() || null,
                  bio: draft.bio ?? null,
                  photo_url: draft.photo_url ?? null,
                  social_links: socialLinks,
                });
                setDraft(EMPTY);
              }}
            >
              {draft.id ? "Update" : "Add author"}
            </Btn>
            {draft.id ? (
              <Btn variant="outline" onClick={() => setDraft(EMPTY)}>
                Cancel
              </Btn>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Authors">
        {rows.length === 0 ? (
          <Empty text="No authors yet." />
        ) : (
          <Table head={["Name", "Slug", ""]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">
                  <div>{row.name}</div>
                  {row.job_title ? <div className="text-xs text-muted-foreground">{row.job_title}</div> : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.slug}</td>
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
