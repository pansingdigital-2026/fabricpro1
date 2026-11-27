import { useState } from "react";
import { toast } from "sonner";

import { uploadMedia, useRows } from "@/lib/admin/api";
import { MEDIA_FOLDERS } from "@/lib/media-folders";
import type { MediaFolder, MediaItem } from "@/lib/types";

import { Btn, TextInput } from "./ui";

type FilterTab = "all" | MediaFolder;

export function MediaPicker({
  value,
  onChange,
  label = "Image",
  defaultOpen = false,
  defaultFolder,
}: {
  value: string;
  onChange: (url: string, item?: MediaItem) => void;
  label?: string;
  defaultOpen?: boolean;
  defaultFolder?: MediaFolder;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [folder, setFolder] = useState<FilterTab>(defaultFolder ?? "all");
  const [query, setQuery] = useState("");
  const { data: media = [], refetch } = useRows<MediaItem>("media", {
    order: { column: "created_at", ascending: false },
    limit: 200,
  });
  const [busy, setBusy] = useState(false);

  const visible = media.filter((m) => {
    if (folder !== "all" && m.folder !== folder) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${m.file_name} ${m.alt_text ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const targetFolder = folder !== "all" ? folder : defaultFolder;
      const row = await uploadMedia(file, targetFolder);
      onChange(String(row["public_url"]), row as unknown as MediaItem);
      await refetch();
      toast.success("Uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-12 w-16 rounded border border-border object-cover"
          />
        ) : null}
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
        <Btn variant="outline" onClick={() => setOpen((o) => !o)}>
          Library
        </Btn>
        {value ? (
          <Btn variant="ghost" onClick={() => onChange("")}>
            Clear
          </Btn>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", ...MEDIA_FOLDERS.map((f) => f.id)] as FilterTab[]).map((tab) => {
              const tabLabel = tab === "all" ? "All" : MEDIA_FOLDERS.find((f) => f.id === tab)!.label;
              const active = folder === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFolder(tab)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {tabLabel}
                </button>
              );
            })}
            <div className="ml-auto min-w-[140px] flex-1 sm:max-w-[200px]">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by file or alt…"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            {busy ? "Uploading…" : ""}
          </label>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {visible.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.public_url, m);
                  setOpen(false);
                }}
                className="overflow-hidden rounded border border-border text-left hover:border-primary"
              >
                <img src={m.public_url} alt={m.alt_text ?? ""} className="h-16 w-full object-cover" />
                <span className="block truncate px-1.5 pt-1 text-[11px] font-medium text-foreground">
                  {m.file_name}
                </span>
                <span className="block truncate px-1.5 pb-1 text-[10px] text-muted-foreground">
                  {m.alt_text ? `Alt: ${m.alt_text}` : "No alt text"}
                </span>
              </button>
            ))}
            {visible.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground">No media in this folder yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
