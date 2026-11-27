import { createFileRoute } from "@tanstack/react-router";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { fetchBootstrap, listContent } = await import("@/lib/public.server");
        const [bootstrap, { items }] = await Promise.all([
          fetchBootstrap(),
          listContent({ perPage: 30 }),
        ]);
        const origin = bootstrap.settings.general.siteUrl || new URL(request.url).origin;
        const base = origin.replace(/\/$/, "");

        const entries = items
          .map((item) => {
            const link = `${base}/${item.type_slug}/${item.slug}`;
            return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(item.published_at ?? item.created_at).toUTCString()}</pubDate>
      <description>${escapeXml(item.excerpt ?? "")}</description>
    </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>${escapeXml(bootstrap.settings.general.siteName)}</title>
    <link>${escapeXml(base)}</link>
    <description>${escapeXml(bootstrap.settings.general.tagline)}</description>
${entries}
</channel></rss>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          },
        });
      },
    },
  },
});
