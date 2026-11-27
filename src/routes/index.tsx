import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteShell } from "@/components/site/SiteShell";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { fetchHomepage } from "@/lib/public.functions";
import type { HomepageSection } from "@/lib/types";

export const Route = createFileRoute("/")({
  // Keep "/" canonical: only page 2+ carries a search param.
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const parsed = z.number().int().min(2).safeParse(Number(search["page"]));
    return parsed.success ? { page: parsed.data } : {};
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => fetchHomepage({ data: { page: deps.page } }),

  head: () => ({
    meta: [
      { title: "Fabric-Pro | Textile News, Fabric Blogs and Industry Insights" },
      {
        name: "description",
        content:
          "Latest textile industry news, fabric manufacturing updates, sustainable materials, textile machinery coverage, sourcing blogs, and expert insights.",
      },
      {
        property: "og:title",
        content: "Fabric-Pro | Textile News, Fabric Blogs and Industry Insights",
      },
      {
        property: "og:description",
        content:
          "Latest textile industry news, fabric manufacturing updates, sustainable materials, textile machinery coverage, sourcing blogs, and expert insights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
  errorComponent: () => <p className="site-container site-section">Homepage failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">Nothing here yet.</p>,
});

function HomePage() {
  const data = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  const sections = data.sections as HomepageSection[];
  const featuredIds = new Set(data.excludeIds ?? []);

  // Leading sections marked "gradient" share one continuous ambient backdrop.
  let gradientRun = 0;
  while (
    gradientRun < sections.length &&
    sections[gradientRun]?.settings?.["background"] === "gradient"
  ) {
    gradientRun += 1;
  }

  const renderSection = (section: HomepageSection) => {
    const paginated = section.settings?.["paginate"] === true;
    let items = data.itemsBySection[section.id] ?? [];
    if (
      section.block_type === "article_grid" &&
      section.settings?.["source"] !== "type" &&
      data.page === 1 &&
      featuredIds.size
    ) {
      items = items.filter((i) => !featuredIds.has(i.id));
    }

    return (
      <SectionRenderer
        key={section.id}
        section={{
          id: section.id,
          type: section.block_type,
          title: section.title,
          subtitle: section.subtitle,
          settings: section.settings,
        }}
        items={items}
        dateFormat={bootstrap.settings.general.dateFormat}
        {...(paginated
          ? {
              total: data.totalsBySection?.[section.id] ?? 0,
              page: data.page,
              pageHref: (p: number) => (p === 1 ? "/" : `/?page=${p}`),
            }
          : {})}
      />
    );
  };

  if (sections.length === 0) {
    return (
      <SiteShell bootstrap={bootstrap}>
        <div className="site-container site-section">
          <h1>Your site is live, but there is no content yet</h1>
          {data.dbConfigured ? (
            <p>
              The website is connected to your database, but the database is still empty. Open
              phpMyAdmin and run the two files from the project — first{" "}
              <code>db/mysql/0001_schema.sql</code>, then{" "}
              <code>db/mysql/0002_fabricpro_content.sql</code> — then refresh this page.
            </p>
          ) : (
            <p>
              Add your database details (host, name, user, password) in your hosting settings, then
              reload this page. Once connected, your articles and homepage sections appear here.
            </p>
          )}
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell bootstrap={bootstrap}>
      {gradientRun > 0 ? (
        <div className="site-gradient-wrap">
          {sections.slice(0, gradientRun).map(renderSection)}
        </div>
      ) : null}
      {sections.slice(gradientRun).map(renderSection)}
    </SiteShell>
  );
}
