import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db as supabase } from "@/lib/db/client";

export interface TableQuery {
  select?: string;
  order?: { column: string; ascending?: boolean };
  eq?: Record<string, string | number | boolean | null>;
  ilike?: { column: string; value: string } | null;
  limit?: number;
}

export async function fetchRows<T = Record<string, unknown>>(
  table: string,
  q: TableQuery = {},
): Promise<T[]> {
  let query = supabase.from(table).select(q.select ?? "*");
  for (const [k, v] of Object.entries(q.eq ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    query = query.eq(k, v as never);
  }
  if (q.ilike && q.ilike.value) query = query.ilike(q.ilike.column, `%${q.ilike.value}%`);
  if (q.order) query = query.order(q.order.column, { ascending: q.order.ascending ?? true });
  if (q.limit) query = query.limit(q.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useRows<T = Record<string, unknown>>(table: string, q: TableQuery = {}) {
  return useQuery({
    queryKey: ["admin", table, q],
    queryFn: () => fetchRows<T>(table, q),
  });
}

export async function saveRow<T extends { id?: string }>(
  table: string,
  values: T,
): Promise<Record<string, unknown>> {
  const { data, error } = values.id
    ? await supabase.from(table).update(values).eq("id", values.id).select().single()
    : await supabase.from(table).insert(values).select().single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function useSave(table: string, invalidate?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => saveRow(table, values),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["admin", invalidate ?? table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemove(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRow(table, id),
    onSuccess: () => {
      toast.success("Deleted");
      void qc.invalidateQueries({ queryKey: ["admin", table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Settings are stored as key/value JSON rows in site_settings. */
export async function saveSettingsGroup(key: string, value: unknown) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

const RESIZABLE = /^image\/(jpeg|png|webp|avif)$/i;

/**
 * Create smaller WebP copies in the browser (free, no outside service) and
 * save them next to the original. Returns the original's natural size.
 */
export async function generateVariants(
  source: Blob,
  storagePath: string,
): Promise<{ width: number; height: number } | null> {
  if (!RESIZABLE.test(source.type)) return null;
  const { variantWidthsFor } = await import("@/lib/images");
  const bitmap = await createImageBitmap(source);
  const size = { width: bitmap.width, height: bitmap.height };
  for (const w of variantWidthsFor(bitmap.width)) {
    const h = Math.round((bitmap.height * w) / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") break; // browser can't make WebP; originals still work
    const form = new FormData();
    form.append("file", blob, `w${w}.webp`);
    form.append("variantOf", storagePath);
    form.append("width", String(w));
    await fetch("/api/admin/upload", { method: "POST", body: form });
  }
  bitmap.close();
  return size;
}

export async function uploadMedia(file: File, folder?: string) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  const row = (await res.json()) as Record<string, unknown>;
  if (folder) row["folder"] = folder;
  try {
    const size = await generateVariants(file, String(row["storage_path"]));
    if (size) Object.assign(row, size);
  } catch {
    /* optimised copies are optional */
  }
  const { data, error: insertError } = await supabase.from("media").insert(row).select().single();
  if (insertError) throw new Error(insertError.message);
  return data as Record<string, unknown>;
}
