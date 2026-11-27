import { Link, createFileRoute } from "@tanstack/react-router";

import { Btn, Empty, Panel, StatusPill, Table } from "@/components/admin/ui";
import { useRemove, useRows } from "@/lib/admin/api";
import type { SitePage } from "@/lib/types";

export const Route = createFileRoute("/admin/pages/")({
  component: PagesList,
});

function PagesList() {
  const { data: pages = [], isLoading } = useRows<SitePage>("pages", {
    select: "id, title, slug, status, updated_at",
    order: { column: "updated_at", ascending: false },
  });
  const remove = useRemove("pages");

  return (
    <Panel
      title="Pages"
      description="Static pages assembled with the section builder."
      actions={
        <Link
          to="/admin/pages/$id"
          params={{ id: "new" }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          New page
        </Link>
      }
    >
      {isLoading ? (
        <Empty text="Loading…" />
      ) : pages.length === 0 ? (
        <Empty text="No pages yet." />
      ) : (
        <Table head={["Title", "URL", "Status", ""]}>
          {pages.map((page) => (
            <tr key={page.id}>
              <td className="px-3 py-2">
                <Link
                  to="/admin/pages/$id"
                  params={{ id: page.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {page.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">/p/{page.slug}</td>
              <td className="px-3 py-2">
                <StatusPill status={page.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Btn
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete "${page.title}"?`)) remove.mutate(page.id);
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
