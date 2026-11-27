import { createFileRoute } from "@tanstack/react-router";

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { fetchBootstrap, listContent } = await import("@/lib/public.server");
        const { getPublicServerClient, isServerDatabaseConfigured } = await import(
          "@/lib/db.server"
        );

        const [bootstrap, { items }] = await Promise.all([
          fetchBootstrap(),
          listContent({ perPage: 60 }),
        ]);
        let pages: { slug: string; updated_at: string }[] = [];
        let cats: { slug: string }[] = bootstrap.categories.map((c) => ({ slug: c.slug }));
        if (isServerDatabaseConfigured()) {
          const db = getPublicServerClient();
          const [pagesRes, catsRes] = await Promise.all([
            db.from("pages").select("slug, updated_at").eq("status", "published"),
            db.from("categories").select("slug"),
          ]);
          pages = (pagesRes.data ?? []) as { slug: string; updated_at: string }[];
          cats = (catsRes.data ?? []) as { slug: string }[];
        } else {
          const { PREVIEW_PAGES } = await import("@/lib/preview-fallback");
          pages = PREVIEW_PAGES.map((p) => ({ slug: p.slug, updated_at: p.updated_at }));
        }

        const origin = bootstrap.settings.general.siteUrl || new URL(request.url).origin;
        const base = origin.replace(/\/$/, "");

        const urls: { loc: string; lastmod?: string }[] = [
          { loc: `${base}/` },
          { loc: `${base}/contact` },
          ...bootstrap.contentTypes.map((t) => ({ loc: `${base}/${t.slug}` })),
          ...((cats ?? []) as { slug: string }[]).map((c) => ({
            loc: `${base}/category/${c.slug}`,
          })),
          ...((pages ?? []) as { slug: string; updated_at: string }[]).map((p) => ({
            loc: `${base}/p/${p.slug}`,
            lastmod: p.updated_at,
          })),
          ...items.map((item) => ({
            loc: `${base}/${item.type_slug}/${item.slug}`,
            lastmod: item.updated_at,
          })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          },
        });
      },
    },
  },
});
