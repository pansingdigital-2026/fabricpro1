import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionBuilder, type BuilderSection } from "@/components/admin/SectionBuilder";
import { Btn, Panel } from "@/components/admin/ui";
import { db as supabase } from "@/lib/db/client";
import { useRows } from "@/lib/admin/api";
import type { Category, ContentType, HomepageSection } from "@/lib/types";

export const Route = createFileRoute("/admin/homepage")({
  component: HomepageManager,
});

function HomepageManager() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useRows<HomepageSection>("homepage_sections", {
    order: { column: "position" },
  });
  const { data: types = [] } = useRows<ContentType>("content_types", {
    order: { column: "position" },
  });
  const { data: categories = [] } = useRows<Category>("categories", {
    order: { column: "position" },
  });

  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSections(
      rows.map((r) => ({
        id: r.id,
        type: r.block_type,
        title: r.title ?? "",
        subtitle: r.subtitle ?? "",
        enabled: r.enabled,
        settings: r.settings ?? {},
      })),
    );
  }, [rows]);

  async function save() {
    setSaving(true);
    try {
      const existingIds = rows.map((r) => r.id);
      const keptIds = sections.map((s) => s.id);
      const removed = existingIds.filter((id) => !keptIds.includes(id));
      if (removed.length) {
        const { error } = await supabase.from("homepage_sections").delete().in("id", removed);
        if (error) throw new Error(error.message);
      }
      const payload = sections.map((s, index) => ({
        id: s.id,
        block_type: s.type,
        title: s.title || null,
        subtitle: s.subtitle || null,
        position: index + 1,
        enabled: s.enabled,
        settings: s.settings,
      }));
      if (payload.length) {
        const { error } = await supabase.from("homepage_sections").upsert(payload);
        if (error) throw new Error(error.message);
      }
      void qc.invalidateQueries({ queryKey: ["admin", "homepage_sections"] });
      toast.success("Homepage saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Homepage sections"
      description="Drag to reorder. Each section pulls live content from your CMS."
      actions={
        <Btn disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save homepage"}
        </Btn>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <SectionBuilder
          sections={sections}
          onChange={setSections}
          types={types}
          categories={categories}
        />
      )}
    </Panel>
  );
}
