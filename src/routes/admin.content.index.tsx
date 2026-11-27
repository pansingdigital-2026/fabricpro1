import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Btn, Empty, Panel, SelectInput, StatusPill, Table, TextInput } from "@/components/admin/ui";
import { useRemove, useRows } from "@/lib/admin/api";
import { ratingFor } from "@/lib/analysis/readability";
import type { ContentItem, ContentType } from "@/lib/types";

export const Route = createFileRoute("/admin/content/")({
  component: ContentList,
});

function ContentList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [readability, setReadability] = useState("");

  const { data: types = [] } = useRows<ContentType>("content_types", {
    order: { column: "position" },
  });
  const { data: items = [], isLoading } = useRows<ContentItem>("content", {
    select: "id, title, slug, type_slug, status, is_featured, updated_at, published_at, seo",
    order: { column: "updated_at", ascending: false },
    eq: { ...(type ? { type_slug: type } : {}), ...(status ? { status } : {}) },
    ilike: search ? { column: "title", value: search } : null,
    limit: 200,
  });
  const remove = useRemove("content");

  const rows = items.filter((item) => {
    if (!readability) return true;
    const score = item.seo?.readability?.total;
    if (score == null) return false;
    if (readability === "lt60") return score < 60;
    if (readability === "lt75") return score < 75;
    if (readability === "gte75") return score >= 75;
    return score >= 85;
  });

  return (
    <Panel title="Content" description="Every article, update, insight and video.">
      <div className="mb-3 flex justify-center">
        <Link
          to="/admin/content/$id"
          params={{ id: "new" }}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          New content
        </Link>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <TextInput
          placeholder="Search titles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectInput value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.plural_name}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["draft", "scheduled", "published", "archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={readability} onChange={(e) => setReadability(e.target.value)}>
          <option value="">All readability</option>
          <option value="lt60">Below 60</option>
          <option value="lt75">Below 75</option>
          <option value="gte75">75+</option>
          <option value="gte85">85+</option>
        </SelectInput>
      </div>

      {isLoading ? (
        <Empty text="Loading…" />
      ) : rows.length === 0 ? (
        <Empty text="No content yet." />
      ) : (
        <Table head={["Title", "Type", "Status", "Readability", "Updated", ""]}>
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2">
                <Link
                  to="/admin/content/$id"
                  params={{ id: item.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                <span className="block text-[11px] text-muted-foreground">/{item.slug}</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{item.type_slug}</td>
              <td className="px-3 py-2">
                <StatusPill status={item.status} />
              </td>
              <td className="px-3 py-2">
                <ReadabilityBadge score={item.seo?.readability?.total} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(item.updated_at).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-right">
                <Btn
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete "${item.title}"?`)) remove.mutate(item.id);
                  }}
                >
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

function ReadabilityBadge({ score }: { score?: number | undefined }) {
  if (score == null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const { label, tone } = ratingFor(score);
  const cls =
    tone === "good"
      ? "bg-emerald-500/15 text-emerald-600"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-600"
        : "bg-red-500/15 text-red-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`} title={label}>
      {score}
    </span>
  );
}
