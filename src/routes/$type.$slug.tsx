import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { Linkedin } from "lucide-react";

import { ImageLightbox } from "@/components/site/ImageLightbox";
import { getAuthorLinkedIn, resolveAuthor } from "@/lib/authors";
import { enhanceBodyImages, srcSetFor } from "@/lib/images";
import { ArticleCard } from "@/components/site/ArticleCard";
import { ArticleToc } from "@/components/site/ArticleToc";
import { ShareRail } from "@/components/site/ShareRail";
import { SiteSearchBox } from "@/components/site/SiteSearchBox";
import { SiteShell } from "@/components/site/SiteShell";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import {
  excerptFrom,
  formatDate,
  readingTime,
  stripLeadingDuplicateExcerpt,
  videoEmbedUrl,
} from "@/lib/format";
import { isUpdatesType, shouldShowArticleToc, withHeadingIds } from "@/lib/toc";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { fetchArticle } from "@/lib/public.functions";

export const Route = createFileRoute("/$type/$slug")({
  loader: async ({ params }) => {
    const result = await fetchArticle({ data: { slug: params.slug } });
    if (!result.item || result.item.type_slug !== params.type) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => {
    const item = loaderData?.item;
    if (!item) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = item.seo?.title || item.title;
    const description = item.seo?.description || item.excerpt || excerptFrom(item.body_html);
    const image = item.seo?.ogImage || item.featured_image_url || undefined;
    const author = resolveAuthor(item.author);
    const path = `/${params.type}/${params.slug}`;
    const robots = [item.seo?.noindex ? "noindex" : "", item.seo?.nofollow ? "nofollow" : ""]
      .filter(Boolean)
      .join(", ");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(robots ? [{ name: "robots", content: robots }] : []),
        { property: "og:title", content: item.seo?.ogTitle || title },
        { property: "og:description", content: item.seo?.ogDescription || description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: path },
        ...(image?.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: item.seo?.canonical || path }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: item.title,
            description,
            image: image ? [image] : undefined,
            datePublished: item.published_at ?? undefined,
            dateModified: item.updated_at,
            author: { "@type": "Person", name: author.name, url: `/author/${author.slug}` },
          }),
        },
      ],
    };
  },
  component: ArticlePage,
  errorComponent: () => <p className="site-container site-section">This story failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">That story doesn’t exist.</p>,
});

function ArticlePage() {
  const { item, related, recentUpdates } = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  if (!item) return null;

  const dateFormat = bootstrap.settings.general.dateFormat;
  const embed = videoEmbedUrl(item.video_url);
  const dedupedBodyHtml = stripLeadingDuplicateExcerpt(item.body_html, item.excerpt);
  const { html: tocHtml, toc } = withHeadingIds(dedupedBodyHtml);
  const bodyHtml = sanitizeHtml(enhanceBodyImages(tocHtml));
  const showToc = shouldShowArticleToc(item.type_slug, bootstrap.settings.article?.toc !== false);
  const showRecentUpdates = isUpdatesType(item.type_slug) && recentUpdates.length > 0;
  const author = resolveAuthor(item.author);
  const authorLinkedIn = getAuthorLinkedIn(author);
  const showAuthor = bootstrap.settings.article?.authorBox !== false;
  const hasSource = Boolean(item.seo?.sourceName || item.seo?.sourceUrl);

  return (
    <SiteShell bootstrap={bootstrap}>
      <article className="site-article">
        {/* Header: text left, featured image right */}
        <div className="site-article-hero-band">
          <div className="site-container site-article-hero-grid">
            <div className="site-article-hero-copy">
              <nav className="site-breadcrumbs" aria-label="Breadcrumb">
                <span>Categories</span>
                <span>/</span>
                <Link to="/$type" params={{ type: item.type_slug }} search={{ page: 1 }}>
                  {bootstrap.contentTypes.find((t) => t.slug === item.type_slug)?.plural_name ??
                    item.type_slug.replace(/-/g, " ")}
                </Link>
              </nav>

              {item.category ? (
                <Link
                  to="/category/$slug"
                  params={{ slug: item.category.slug }}
                  search={{ page: 1 }}
                  className="article-kicker"
                >
                  {item.category.name}
                </Link>
              ) : null}
              <h1>{item.title}</h1>
              {item.excerpt ? <p className="site-article-standfirst">{item.excerpt}</p> : null}
              <p className="article-meta">
                <Link to="/author/$slug" params={{ slug: author.slug }} search={{ page: 1 }}>
                  {author.name}
                </Link>
                <span>{formatDate(item.published_at, dateFormat)}</span>
                <span>{readingTime(item.body_html, item.reading_minutes)} min read</span>
              </p>
            </div>

            <div className="site-article-hero-media">
              {embed ? (
                <div className="site-embed">
                  <iframe src={embed} title={item.title} allowFullScreen loading="lazy" />
                </div>
              ) : item.featured_image_url ? (
                <figure>
                  <img
                    src={item.featured_image_url}
                    alt={item.featured_image_alt ?? item.title}
                    srcSet={srcSetFor(item.featured_image_url)}
                    sizes="(max-width: 899px) 100vw, 50vw"
                    loading="eager"
                    fetchPriority="high"
                  />
                  {item.featured_image_caption ? (
                    <figcaption>{item.featured_image_caption}</figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>
          </div>
        </div>

        {/* Body: share rail / article / TOC */}
        <div className="site-container site-article-layout">
          <ShareRail
            title={item.title}
            social={bootstrap.settings.general.social}
            visibility={bootstrap.settings.general.shareIcons}
          />

          <div className="site-article-main">
            <div
              className="prose site-article-body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            <ImageLightbox containerSelector=".site-article-body" />

            {hasSource && item.seo ? (
              <p className="site-article-source">
                <span>Source</span>
                {item.seo.sourceUrl ? (
                  <a href={item.seo.sourceUrl} target="_blank" rel="noreferrer noopener">
                    {item.seo.sourceName || item.seo.sourceUrl}
                  </a>
                ) : (
                  <span className="site-article-source-name">{item.seo.sourceName}</span>
                )}
              </p>
            ) : null}

            {item.tags?.length ? (
              <ul className="site-tags">
                {item.tags.map((tag) => (
                  <li key={tag.id}>
                    <Link to="/tag/$slug" params={{ slug: tag.slug }} search={{ page: 1 }}>
                      #{tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {showAuthor ? (
              <section
                aria-labelledby="author-heading"
                className="site-author-box"
              >
                <h2 id="author-heading" className="site-author-heading">
                  Author
                </h2>
                <Link
                  to="/author/$slug"
                  params={{ slug: author.slug }}
                  search={{ page: 1 }}
                  className="site-author-name"
                >
                  {author.name}
                </Link>
                {author.job_title ? (
                  <p className="site-author-role">{author.job_title}</p>
                ) : null}
                {author.bio ? <p className="site-author-bio">{author.bio}</p> : null}
                {authorLinkedIn ? (
                  <a
                    href={authorLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-author-linkedin"
                  >
                    <Linkedin size={16} aria-hidden="true" />
                    <span>LinkedIn</span>
                  </a>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="site-article-aside">
            <div className="site-article-aside-sticky">
              <SiteSearchBox placeholder="Search articles" />
              {showToc ? <ArticleToc entries={toc} /> : null}
              {showRecentUpdates ? (
                <nav className="site-recent-updates" aria-label="Recent Updates">
                  <p className="site-toc-title">Recent Updates</p>
                  <ul>
                    {recentUpdates.map((update) => (
                      <li key={update.id}>
                        <Link
                          to="/$type/$slug"
                          params={{ type: update.type_slug, slug: update.slug }}
                        >
                          {update.category ? (
                            <span className="site-side-cat">{update.category.name}</span>
                          ) : null}
                          <span className="site-recent-update-title">{update.title}</span>
                          {update.published_at ? (
                            <span className="site-recent-update-date">
                              {formatDate(update.published_at, dateFormat)}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </div>
        </div>

        {related.length ? (
          <section className="site-section site-section--muted site-related">
            <div className="site-container">
              <header className="site-section-header">
                <h2>Related Articles</h2>
              </header>
              <div className="site-grid" style={{ "--cols": 3 } as React.CSSProperties}>
                {related.map((r) => (
                  <ArticleCard key={r.id} item={r} dateFormat={dateFormat} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </article>
    </SiteShell>
  );
}
