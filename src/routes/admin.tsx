import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CMS Admin" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Content management for this publication." },
    ],
  }),
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
