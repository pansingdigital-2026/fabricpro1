import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Category, ContentType, JsonValue, SectionSettings } from "@/lib/types";

import { MediaPicker } from "./MediaPicker";
import { Btn, Field, SelectInput, TextArea, TextInput, Toggle } from "./ui";

export interface BuilderSection {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  settings: SectionSettings;
}

export const BLOCK_TYPES: { value: string; label: string; group: string }[] = [
  { value: "page_title", label: "Page title band", group: "Content" },
  { value: "hero", label: "Hero", group: "Content" },
  { value: "featured", label: "Featured (lead + list)", group: "Content" },
  { value: "featured_with_sidebar", label: "Featured + sidebar list", group: "Content" },
  { value: "article_grid", label: "Article grid", group: "Content" },
  { value: "article_list", label: "Article list", group: "Content" },
  { value: "video_grid", label: "Video grid", group: "Content" },
  { value: "category_feed", label: "Category feed", group: "Content" },
  { value: "heading", label: "Heading", group: "Layout" },
  { value: "text", label: "Text", group: "Layout" },
  { value: "rich_text", label: "Rich text / HTML", group: "Layout" },
  { value: "image", label: "Image", group: "Layout" },
  { value: "video", label: "Video embed", group: "Layout" },
  { value: "cta", label: "Call to action", group: "Layout" },
  { value: "spacer", label: "Spacer", group: "Layout" },
  { value: "divider", label: "Divider", group: "Layout" },
  { value: "html", label: "Custom HTML", group: "Layout" },
];

const CONTENT_BLOCKS = [
  "hero",
  "featured",
  "featured_with_sidebar",
  "article_grid",
  "article_list",
  "video_grid",
  "category_feed",
];


export function newSection(type: string): BuilderSection {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    subtitle: "",
    enabled: true,
    settings: {
      source: "latest",
      limit: 6,
      columns: 3,
      width: "container",
      padding: "md",
      background: "page",
      layout: "card",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  };
}

function SortableRow({
  section,
  index,
  onChange,
  onRemove,
  types,
  categories,
}: {
  section: BuilderSection;
  index: number;
  onChange: (s: BuilderSection) => void;
  onRemove: () => void;
  types: ContentType[];
  categories: Category[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [open, setOpen] = useState(false);
  const s = section.settings;
  const set = (patch: Record<string, JsonValue | undefined>) =>
    onChange({ ...section, settings: { ...s, ...patch } as SectionSettings });

  const isContent = CONTENT_BLOCKS.includes(section.type);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-border bg-card ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="text-[11px] font-mono text-muted-foreground">{index + 1}</span>
        <span className="text-sm font-semibold text-foreground">
          {BLOCK_TYPES.find((b) => b.value === section.type)?.label ?? section.type}
        </span>
        {section.title ? (
          <span className="truncate text-xs text-muted-foreground">— {section.title}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={(e) => onChange({ ...section, enabled: e.target.checked })}
            />
            Enabled
          </label>
          <Btn variant="ghost" onClick={() => setOpen((o) => !o)}>
            <ChevronDown size={14} className={open ? "rotate-180" : ""} />
          </Btn>
          <Btn variant="ghost" onClick={onRemove}>
            <Trash2 size={14} />
          </Btn>
        </div>
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          <Field label="Section title">
            <TextInput
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
            />
          </Field>
          <Field label="Subtitle">
            <TextInput
              value={section.subtitle}
              onChange={(e) => onChange({ ...section, subtitle: e.target.value })}
            />
          </Field>

          {isContent ? (
            <>
              <Field label="Content source">
                <SelectInput
                  value={s.source ?? "latest"}
                  onChange={(e) => set({ source: e.target.value as SectionSettings["source"] })}
                >
                  <option value="latest">Latest</option>
                  <option value="featured">Featured</option>
                  <option value="editors_pick">Editor&apos;s picks</option>
                  <option value="popular">Most viewed</option>
                  <option value="type">By content type</option>
                  <option value="category">By category</option>
                </SelectInput>
              </Field>
              <Field label="Items">
                <TextInput
                  type="number"
                  value={s.limit ?? 6}
                  onChange={(e) => set({ limit: Number(e.target.value) })}
                />
              </Field>
              <Field label="Content type">
                <SelectInput
                  value={s.typeSlug ?? ""}
                  onChange={(e) => set({ typeSlug: e.target.value })}
                >
                  <option value="">Any</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.plural_name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Category">
                <SelectInput
                  value={s.categorySlug ?? ""}
                  onChange={(e) => set({ categorySlug: e.target.value })}
                >
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Card layout">
                <SelectInput
                  value={s.layout ?? "card"}
                  onChange={(e) => set({ layout: e.target.value as SectionSettings["layout"] })}
                >
                  <option value="card">Cards</option>
                  <option value="list">List</option>
                  <option value="compact">Compact</option>
                  <option value="feature">Feature</option>
                </SelectInput>
              </Field>
              <Field label="Columns (desktop)">
                <SelectInput
                  value={String(s.columns ?? 3)}
                  onChange={(e) => set({ columns: Number(e.target.value) as 1 | 2 | 3 | 4 })}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Sort">
                <SelectInput
                  value={s.sort ?? "newest"}
                  onChange={(e) => set({ sort: e.target.value as SectionSettings["sort"] })}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="popular">Most viewed</option>
                </SelectInput>
              </Field>
            </>
          ) : null}

          {section.type === "featured_with_sidebar" ? (
            <>
              <Field label="Sidebar heading">
                <TextInput
                  value={s.sidebarTitle ?? ""}
                  placeholder="Latest articles"
                  onChange={(e) => set({ sidebarTitle: e.target.value })}
                />
              </Field>
              <Field label="Sidebar links">
                <TextInput
                  type="number"
                  value={s.sidebarLimit ?? 5}
                  onChange={(e) => set({ sidebarLimit: Number(e.target.value) })}
                />
              </Field>
            </>
          ) : null}

          {section.type === "article_grid" ? (
            <Toggle
              label="Paginate this grid"
              checked={s.paginate === true}
              onChange={(v) => set({ paginate: v })}
            />
          ) : null}


          {section.type === "heading" ? (
            <>
              <Field label="Heading text">
                <TextInput value={s.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
              </Field>
              <Field label="Level">
                <SelectInput
                  value={s.level ?? "h2"}
                  onChange={(e) => set({ level: e.target.value as SectionSettings["level"] })}
                >
                  <option value="h1">H1</option>
                  <option value="h2">H2</option>
                  <option value="h3">H3</option>
                </SelectInput>
              </Field>
            </>
          ) : null}

          {section.type === "text" ? (
            <Field label="Text" className="sm:col-span-2">
              <TextArea value={s.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
            </Field>
          ) : null}

          {section.type === "rich_text" || section.type === "html" ? (
            <Field label="HTML" className="sm:col-span-2">
              <TextArea
                value={s.html ?? ""}
                onChange={(e) => set({ html: e.target.value })}
                className="font-mono"
              />
            </Field>
          ) : null}

          {section.type === "image" || section.type === "hero" ? (
            <div className="sm:col-span-2">
              <MediaPicker value={s.imageUrl ?? ""} onChange={(url) => set({ imageUrl: url })} />
            </div>
          ) : null}

          {section.type === "video" ? (
            <Field label="Video URL (YouTube / Vimeo)" className="sm:col-span-2">
              <TextInput
                value={s.videoUrl ?? ""}
                onChange={(e) => set({ videoUrl: e.target.value })}
              />
            </Field>
          ) : null}

          {section.type === "cta" || section.type === "hero" ? (
            <>
              <Field label="Button label">
                <TextInput
                  value={s.ctaLabel ?? ""}
                  onChange={(e) => set({ ctaLabel: e.target.value })}
                />
              </Field>
              <Field label="Button URL">
                <TextInput
                  value={s.ctaUrl ?? ""}
                  onChange={(e) => set({ ctaUrl: e.target.value })}
                />
              </Field>
            </>
          ) : null}

          {section.type === "spacer" ? (
            <Field label="Height (px)">
              <TextInput
                type="number"
                value={s.height ?? 48}
                onChange={(e) => set({ height: Number(e.target.value) })}
              />
            </Field>
          ) : null}

          <Field label="Width">
            <SelectInput
              value={s.width ?? "container"}
              onChange={(e) => set({ width: e.target.value as SectionSettings["width"] })}
            >
              <option value="container">Container</option>
              <option value="narrow">Narrow</option>
              <option value="full">Full width</option>
            </SelectInput>
          </Field>
          <Field label="Background">
            <SelectInput
              value={s.background ?? "page"}
              onChange={(e) => set({ background: e.target.value as SectionSettings["background"] })}
            >
              <option value="page">Page</option>
              <option value="muted">Muted</option>
              <option value="dark">Dark</option>
              <option value="accent">Accent</option>
              <option value="gradient">Ambient gradient</option>
            </SelectInput>
          </Field>
          <Field label="Padding">
            <SelectInput
              value={s.padding ?? "md"}
              onChange={(e) => set({ padding: e.target.value as SectionSettings["padding"] })}
            >
              {["none", "sm", "md", "lg", "xl"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Corner radius (px)">
            <TextInput
              type="number"
              value={s.radius ?? 0}
              onChange={(e) => set({ radius: Number(e.target.value) })}
            />
          </Field>

          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
            <Toggle
              label="Show on desktop"
              checked={s.desktop !== false}
              onChange={(v) => set({ desktop: v })}
            />
            <Toggle
              label="Show on tablet"
              checked={s.tablet !== false}
              onChange={(v) => set({ tablet: v })}
            />
            <Toggle
              label="Show on mobile"
              checked={s.mobile !== false}
              onChange={(v) => set({ mobile: v })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SectionBuilder({
  sections,
  onChange,
  types,
  categories,
}: {
  sections: BuilderSection[];
  onChange: (s: BuilderSection[]) => void;
  types: ContentType[];
  categories: Category[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [adding, setAdding] = useState("article_grid");

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    onChange(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sections.map((section, index) => (
              <SortableRow
                key={section.id}
                section={section}
                index={index}
                types={types}
                categories={categories}
                onChange={(next) =>
                  onChange(sections.map((s) => (s.id === section.id ? next : s)))
                }
                onRemove={() => onChange(sections.filter((s) => s.id !== section.id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3">
        <SelectInput
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          className="max-w-64"
        >
          {BLOCK_TYPES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.group} — {b.label}
            </option>
          ))}
        </SelectInput>
        <Btn onClick={() => onChange([...sections, newSection(adding)])}>Add section</Btn>
      </div>
    </div>
  );
}
