import { Link } from "@tanstack/react-router";

import { excerptFrom, formatDate, readingTime } from "@/lib/format";
import { srcSetFor } from "@/lib/images";
import type { ContentItem } from "@/lib/types";

const SIZES = {
  card: "(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 400px",
  feature: "(max-width: 999px) 100vw, 60vw",
  list: "220px",
  compact: "220px",
} as const;

export function ArticleCard({
  item,
  layout = "card",
  dateFormat,
  badge,
}: {
  item: ContentItem;
  layout?: "card" | "list" | "compact" | "feature";
  dateFormat?: string | undefined;
  badge?: string | undefined;
}) {
  const href = { to: "/$type/$slug", params: { type: item.type_slug, slug: item.slug } } as const;
  const showImage = layout !== "compact" && item.featured_image_url;
  const badgeLabel = badge ?? (layout === "feature" ? "Featured" : undefined);

  return (
    <article className={`article-card article-card--${layout}`}>
      {showImage ? (
        <Link {...href} className="article-card-media">
          <img
            src={item.featured_image_url as string}
            alt={item.featured_image_alt ?? item.title}
            srcSet={srcSetFor(item.featured_image_url)}
            sizes={SIZES[layout]}
            loading={layout === "feature" ? "eager" : "lazy"}
            decoding="async"
            {...(layout === "feature" ? { fetchPriority: "high" as const } : {})}
          />
          {badgeLabel ? <span className="article-card-badge">{badgeLabel}</span> : null}
        </Link>
      ) : null}
      <div className="article-card-body">
        {item.category?.name ? (
          <Link
            to="/category/$slug"
            params={{ slug: item.category.slug }}
            search={{ page: 1 }}
            className="article-kicker"
          >
            {item.category.name}
          </Link>
        ) : null}
        <h3 className="article-card-title">
          <Link {...href}>{item.title}</Link>
        </h3>
        {layout !== "compact" ? (
          <p className="article-card-excerpt">
            {item.excerpt || excerptFrom(item.body_html, 150)}
          </p>
        ) : null}
        <p className="article-meta">
          {item.author?.name ? <span>{item.author.name}</span> : null}
          <span>{formatDate(item.published_at, dateFormat)}</span>
          <span>{readingTime(item.body_html, item.reading_minutes)} min read</span>
        </p>
      </div>
    </article>
  );
}
