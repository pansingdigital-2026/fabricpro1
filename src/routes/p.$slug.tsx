import { createFileRoute, notFound } from "@tanstack/react-router";

import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteShell } from "@/components/site/SiteShell";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { fetchPage } from "@/lib/public.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const result = await fetchPage({ data: { slug: params.slug } });
    if (!result.page) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => {
    const page = loaderData?.page;
    if (!page) return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    const title = page.seo?.title || page.title;
    const description = page.seo?.description || `${page.title} — read more.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(page.seo?.noindex ? [{ name: "robots", content: "noindex" }] : []),
        { property: "og:title", content: page.seo?.ogTitle || title },
        { property: "og:description", content: page.seo?.ogDescription || description },
        { property: "og:url", content: `/p/${params.slug}` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(page.seo?.ogImage?.startsWith("https://")
          ? [
              { property: "og:image", content: page.seo.ogImage },
              { name: "twitter:image", content: page.seo.ogImage },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: page.seo?.canonical || `/p/${params.slug}` }],
    };
  },
  component: CustomPage,
  errorComponent: () => <p className="site-container site-section">This page failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">Page not found.</p>,
});

function CustomPage() {
  const { page, itemsBySection } = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  if (!page) return null;

  return (
    <SiteShell bootstrap={bootstrap}>
      <div className="site-container site-section">
        <h1 className="site-page-title">{page.title}</h1>
      </div>
      {(page.sections ?? []).map((section) => (
        <SectionRenderer
          key={section.id}
          section={{
            id: section.id,
            type: section.type,
            title: section.title ?? null,
            subtitle: section.subtitle ?? null,
            settings: section.settings,
          }}
          items={itemsBySection[section.id] ?? []}
          dateFormat={bootstrap.settings.general.dateFormat}
        />
      ))}
    </SiteShell>
  );
}
