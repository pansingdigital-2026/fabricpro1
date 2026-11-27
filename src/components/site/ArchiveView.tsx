import { Link } from "@tanstack/react-router";

import type { ContentItem, SiteBootstrap } from "@/lib/types";

import { ArticleCard } from "./ArticleCard";
import { SiteShell } from "./SiteShell";

export function ArchiveView({
  bootstrap,
  title,
  description,
  items,
  total,
  page,
  perPage,
  buildHref,
  taxonomy,
  activeSlug,
}: {
  bootstrap: SiteBootstrap;
  title: string;
  description?: string | null;
  items: ContentItem[];
  total: number;
  page: number;
  perPage: number;
  buildHref: (page: number) => string;
  taxonomy?: "category" | "tag" | undefined;
  activeSlug?: string | undefined;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const categories = bootstrap.categories ?? [];
  const tags = bootstrap.tags ?? [];
  const showFilters = Boolean(taxonomy) && (categories.length > 0 || tags.length > 0);

  return (
    <SiteShell bootstrap={bootstrap}>
      <div className="site-container site-section">
        <header className="site-archive-header">
          <h1 className="site-page-title">{title}</h1>
          {description ? <p className="site-archive-description">{description}</p> : null}
        </header>

        {showFilters ? (
          <nav className="site-taxonomy-bar" aria-label="Browse by topic">
            {categories.length ? (
              <div className="site-taxonomy-row">
                <span className="site-taxonomy-label">Categories</span>
                <div className="site-taxonomy-chips">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      search={{ page: 1 }}
                      className={
                        taxonomy === "category" && c.slug === activeSlug
                          ? "site-chip is-active"
                          : "site-chip"
                      }
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {tags.length ? (
              <div className="site-taxonomy-row">
                <span className="site-taxonomy-label">Tags</span>
                <div className="site-taxonomy-chips">
                  {tags.map((t) => (
                    <Link
                      key={t.id}
                      to="/tag/$slug"
                      params={{ slug: t.slug }}
                      search={{ page: 1 }}
                      className={
                        taxonomy === "tag" && t.slug === activeSlug
                          ? "site-chip is-active"
                          : "site-chip"
                      }
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        ) : null}

        {items.length === 0 ? (
          <p className="site-empty">No stories published here yet.</p>
        ) : (
          <div className="site-grid" style={{ "--cols": 3 } as React.CSSProperties}>
            {items.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                dateFormat={bootstrap.settings.general.dateFormat}
              />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav className="site-pagination" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                to={buildHref(n)}
                className={n === page ? "is-active" : ""}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </SiteShell>
  );
}
