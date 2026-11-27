import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ArticleCard } from "@/components/site/ArticleCard";
import { SiteShell } from "@/components/site/SiteShell";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { fetchArchive } from "@/lib/public.functions";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"].slice(0, 120) : "",
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, page: search.page }),
  loader: ({ deps }) =>
    deps.q
      ? fetchArchive({ data: { kind: "search", query: deps.q, page: deps.page, perPage: 12 } })
      : Promise.resolve({ items: [], total: 0, meta: null }),
  head: () => ({
    meta: [
      { title: "Search | Fabric-Pro" },
      { name: "description", content: "Search Fabric-Pro textile news, blogs, and insights." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Search | Fabric-Pro" },
      { property: "og:description", content: "Search Fabric-Pro textile news, blogs, and insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/search" }],
  }),
  component: SearchPage,
  errorComponent: () => <p className="site-container site-section">Search is unavailable.</p>,
  notFoundComponent: () => <p className="site-container site-section">No results.</p>,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const data = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  const navigate = useNavigate({ from: "/search" });

  return (
    <SiteShell bootstrap={bootstrap}>
      <div className="site-container site-section">
        <h1 className="site-page-title">Search</h1>
        <form
          className="site-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("q") ?? "");
            navigate({ search: { q: value, page: 1 } });
          }}
        >
          <input name="q" defaultValue={q} placeholder="Search articles…" aria-label="Search" />
          <button type="submit" className="site-button">
            Search
          </button>
        </form>

        {q ? (
          <p className="site-result-count">
            {data.total} result{data.total === 1 ? "" : "s"} for “{q}”
          </p>
        ) : null}

        <div className="site-list">
          {data.items.map((item) => (
            <ArticleCard
              key={item.id}
              item={item}
              layout="list"
              dateFormat={bootstrap.settings.general.dateFormat}
            />
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
