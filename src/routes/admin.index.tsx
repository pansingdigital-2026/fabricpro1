import { Link, createFileRoute } from "@tanstack/react-router";

import { Panel, StatusPill, Table } from "@/components/admin/ui";
import { useRows } from "@/lib/admin/api";
import type { ContentItem } from "@/lib/types";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { data: content = [] } = useRows<ContentItem>("content", {
    select: "id, title, slug, type_slug, status, updated_at",
    order: { column: "updated_at", ascending: false },
    limit: 200,
  });
  const { data: pages = [] } = useRows("pages", { select: "id" });
  const { data: media = [] } = useRows("media", { select: "id" });
  const { data: submissions = [] } = useRows("contact_submissions", { select: "id" });

  const published = content.filter((c) => c.status === "published").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Content items" value={content.length} />
        <Stat label="Published" value={published} />
        <Stat label="Pages" value={pages.length} />
        <Stat label="Media files" value={media.length} />
        <Stat label="Messages" value={submissions.length} />
      </div>

      <Panel
        title="Recently edited"
        actions={
          <Link
            to="/admin/content/$id"
            params={{ id: "new" }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            New content
          </Link>
        }
      >
        <Table head={["Title", "Type", "Status", "Updated"]}>
          {content.slice(0, 10).map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2">
                <Link
                  to="/admin/content/$id"
                  params={{ id: item.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{item.type_slug}</td>
              <td className="px-3 py-2">
                <StatusPill status={item.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(item.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
