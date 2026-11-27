import { createFileRoute } from "@tanstack/react-router";
import { ImageInfo } from "@/components/admin/ImageInfo";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Btn, Empty, Field, Panel, TextInput } from "@/components/admin/ui";
import { generateVariants, saveRow, uploadMedia, useRemove, useRows } from "@/lib/admin/api";
import { folderLabel, MEDIA_FOLDERS } from "@/lib/media-folders";
import type { MediaFolder, MediaItem } from "@/lib/types";

export const Route = createFileRoute("/admin/media")({
  component: MediaLibrary,
});

type MediaTab = "all" | MediaFolder | "uncategorized";

function MediaLibrary() {
  const qc = useQueryClient();
  const { data: media = [] } = useRows<MediaItem>("media", {
    order: { column: "created_at", ascending: false },
    limit: 400,
  });
  const remove = useRemove("media");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [tab, setTab] = useState<MediaTab>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const countFor = (t: MediaTab) => {
    if (t === "all") return media.length;
    if (t === "uncategorized") return media.filter((m) => !m.folder).length;
    return media.filter((m) => m.folder === t).length;
  };

  const filtered = media.filter((m) => {
    if (tab === "uncategorized" && m.folder) return false;
    if (tab !== "all" && tab !== "uncategorized" && m.folder !== tab) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${m.file_name} ${m.alt_text ?? ""} ${m.caption ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const uploadFolder: MediaFolder | undefined =
    tab !== "all" && tab !== "uncategorized" ? tab : undefined;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) await uploadMedia(file, uploadFolder);
      void qc.invalidateQueries({ queryKey: ["admin", "media"] });
      toast.success(
        uploadFolder ? `Uploaded to ${folderLabel(uploadFolder)}` : "Uploaded",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel
        title="Media library"
        description="Organised into Branding, Updates, Playbook, and Insights."
        actions={
          <label className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {busy ? "Uploading…" : uploadFolder ? `Upload to ${folderLabel(uploadFolder)}` : "Upload"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void upload(e.target.files)}
            />
          </label>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {(["all", ...MEDIA_FOLDERS.map((f) => f.id), "uncategorized"] as MediaTab[]).map((t) => {
            const count = countFor(t);
            if (t === "uncategorized" && count === 0) return null;
            const label =
              t === "all" ? "All" : t === "uncategorized" ? "Uncategorized" : folderLabel(t);
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
          <div className="ml-auto min-w-[160px] flex-1 sm:max-w-[220px]">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or alt…"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty text="No media in this section yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`overflow-hidden rounded-md border text-left ${
                  selected?.id === item.id ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <img
                  src={item.public_url}
                  alt={item.alt_text ?? item.file_name}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
                <div className="px-2 py-1">
                  <span className="block truncate text-[11px] font-medium text-foreground">
                    {item.file_name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {folderLabel(item.folder)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Details">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a file to edit its metadata.</p>
        ) : (
          <div className="space-y-3">
            <img
              src={selected.public_url}
              alt={selected.alt_text ?? selected.file_name}
              className="w-full rounded-md border border-border"
            />
            <ImageInfo url={selected.public_url} kind="standard" />
            <Btn
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void fetch(selected.public_url)
                  .then((r) => r.blob())
                  .then((b) => generateVariants(b, selected.storage_path))
                  .then((size) => {
                    if (!size) throw new Error("This file type can't be resized");
                    return saveRow("media", { id: selected.id, ...size } as { id?: string });
                  })
                  .then(() => {
                    toast.success("Optimised sizes created");
                    void qc.invalidateQueries({ queryKey: ["admin", "media"] });
                  })
                  .catch((e: Error) => toast.error(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Working…" : "Create faster-loading sizes"}
            </Btn>
            <Field label="Folder">
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                value={selected.folder ?? ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    folder: (e.target.value || null) as MediaFolder | null,
                  })
                }
              >
                <option value="">Uncategorized</option>
                {MEDIA_FOLDERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Alt text">
              <TextInput
                value={selected.alt_text ?? ""}
                onChange={(e) => setSelected({ ...selected, alt_text: e.target.value })}
              />
            </Field>
            <Field label="Caption">
              <TextInput
                value={selected.caption ?? ""}
                onChange={(e) => setSelected({ ...selected, caption: e.target.value })}
              />
            </Field>
            <Field label="Public URL">
              <TextInput readOnly value={selected.public_url} />
            </Field>
            <div className="flex gap-2">
              <Btn
                onClick={() => {
                  void saveRow("media", {
                    id: selected.id,
                    folder: selected.folder ?? null,
                    alt_text: selected.alt_text ?? null,
                    caption: selected.caption ?? null,
                  } as { id?: string })
                    .then(() => {
                      toast.success("Saved");
                      void qc.invalidateQueries({ queryKey: ["admin", "media"] });
                    })
                    .catch((e: Error) => toast.error(e.message));
                }}
              >
                Save
              </Btn>
              <Btn
                variant="outline"
                onClick={() => {
                  if (window.confirm("Delete this file record?")) {
                    remove.mutate(selected.id);
                    setSelected(null);
                  }
                }}
              >
                Delete
              </Btn>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
