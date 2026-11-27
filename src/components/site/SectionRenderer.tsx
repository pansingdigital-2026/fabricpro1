import { Link } from "@tanstack/react-router";

import { videoEmbedUrl } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { ContentItem, SectionSettings } from "@/lib/types";

import { ArticleCard } from "./ArticleCard";
import { NewsletterForm } from "./NewsletterForm";

export interface RenderableSection {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  settings: SectionSettings;
}


function sectionStyle(
  s: SectionSettings,
  type?: string,
): React.CSSProperties {
  const scale = { none: 0, sm: 0.5, md: 0.75, lg: 1, xl: 1.35 }[s.padding ?? "md"];
  const halfSpace = scale === 0 ? 0 : `calc(var(--section-spacing, 36px) * ${scale * 0.5})`;
  const topPad =
    type === "featured_with_sidebar"
      ? scale === 0
        ? 0
        : "14px"
      : type === "page_title"
        ? scale === 0
          ? 0
          : `calc(var(--section-spacing, 36px) * ${scale * 0.35})`
        : halfSpace;
  return {
    paddingTop: topPad,
    paddingBottom: halfSpace,
    borderRadius: s.radius ? `${s.radius}px` : undefined,
  };
}

function backgroundClass(s: SectionSettings) {
  switch (s.background) {
    case "muted":
      return "site-section--muted";
    case "dark":
      return "site-section--dark";
    case "accent":
      return "site-section--accent";
    case "gradient":
      return "site-section--gradient";
    default:
      return "";
  }
}

function widthClass(s: SectionSettings) {
  if (s.width === "full") return "site-container-full";
  if (s.width === "narrow") return "site-container-narrow";
  return "site-container";
}

function visibilityClass(s: SectionSettings) {
  return [
    s.desktop === false ? "hide-desktop" : "",
    s.tablet === false ? "hide-tablet" : "",
    s.mobile === false ? "hide-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function SectionRenderer({
  section,
  items,
  dateFormat,
  total,
  page = 1,
  pageHref,
}: {
  section: RenderableSection;
  items: ContentItem[];
  dateFormat?: string | undefined;
  total?: number | undefined;
  page?: number | undefined;
  pageHref?: ((page: number) => string) | undefined;
}) {
  const s = section.settings ?? {};
  const columns = s.columns ?? 3;

  let inner: React.ReactNode = null;

  switch (section.type) {
    case "page_title": {
      inner = (
        <div className="site-title-band-inner">
          <h1 className="site-title-band-title">{section.title}</h1>
          {section.subtitle ? <p>{section.subtitle}</p> : null}
        </div>
      );
      break;
    }
    case "featured_with_sidebar": {
      const [lead, ...rest] = items;
      const sideLimit = Number(s['sidebarLimit'] ?? 5);
      inner = lead ? (
        <div className="site-feature-split">
          <div className="site-feature-main">
            <ArticleCard
              item={lead}
              layout="feature"
              badge={section.title || "Featured"}
              dateFormat={dateFormat}
            />
          </div>
          <div className="site-feature-side">
            <p className="site-side-title">{(s['sidebarTitle'] as string) || "Latest articles"}</p>
            <ul className="site-side-list">
              {rest.slice(0, sideLimit).map((item, i) => (
                <li key={item.id}>
                  <Link to="/$type/$slug" params={{ type: item.type_slug, slug: item.slug }}>
                    <span className="site-side-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="site-side-body">
                      <span className="site-side-cat">{item.category?.name ?? item.type_slug}</span>
                      <span className="site-side-title-text">{item.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>


          </div>
        </div>
      ) : null;
      break;
    }
    case "hero": {
      const lead = items[0];

      inner = (
        <div className="site-hero">
          {s.imageUrl || lead?.featured_image_url ? (
            <img
              className="site-hero-image"
              src={(s.imageUrl as string) || (lead?.featured_image_url as string)}
              alt={(s.imageAlt as string) || lead?.title || ""}
            />
          ) : null}
          <div className="site-hero-body">
            <h1>{section.title || lead?.title}</h1>
            {section.subtitle || lead?.excerpt ? <p>{section.subtitle || lead?.excerpt}</p> : null}
            {s.ctaLabel && s.ctaUrl ? (
              <a className="site-button" href={s.ctaUrl as string}>
                {s.ctaLabel as string}
              </a>
            ) : lead ? (
              <Link
                className="site-button"
                to="/$type/$slug"
                params={{ type: lead.type_slug, slug: lead.slug }}
              >
                Read the story
              </Link>
            ) : null}
          </div>
        </div>
      );
      break;
    }
    case "featured": {
      const [lead, ...rest] = items;
      inner = lead ? (
        <div className="site-featured">
          <ArticleCard item={lead} layout="feature" dateFormat={dateFormat} />
          <div className="site-featured-side">
            {rest.map((item) => (
              <ArticleCard key={item.id} item={item} layout="list" dateFormat={dateFormat} />
            ))}
          </div>
        </div>
      ) : null;
      break;
    }
    case "article_grid":
    case "video_grid":
    case "category_feed":
    case "related": {
      const perPage = Number(s.limit ?? 9);
      const pageCount = total && pageHref ? Math.ceil(total / Math.max(perPage, 1)) : 1;
      inner = (
        <>
          <div className="site-grid" style={{ "--cols": columns } as React.CSSProperties}>
            {items.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                layout={s.layout === "list" ? "list" : "card"}
                dateFormat={dateFormat}
              />
            ))}
          </div>
          {pageHref && pageCount > 1 ? (
            <nav className="site-pagination" aria-label="Pagination">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <a key={p} href={pageHref(p)} className={p === page ? "is-active" : ""}>
                  {p}
                </a>
              ))}
            </nav>
          ) : null}
        </>
      );
      break;
    }

    case "article_list": {
      inner = (
        <div className="site-list">
          {items.map((item) => (
            <ArticleCard key={item.id} item={item} layout="list" dateFormat={dateFormat} />
          ))}
        </div>
      );
      break;
    }
    case "rich_text":
      inner = (
        <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html as string) }} />
      );
      break;
    case "heading": {
      const Tag = (s.level ?? "h2") as "h1" | "h2" | "h3";
      inner = <Tag className="site-section-heading">{(s.text as string) || section.title}</Tag>;
      break;
    }
    case "text":
      inner = <p className="site-section-text">{(s.text as string) ?? ""}</p>;
      break;
    case "image":
      inner = s.imageUrl ? (
        <figure className="site-figure">
          <img src={s.imageUrl as string} alt={(s.imageAlt as string) ?? ""} loading="lazy" />
        </figure>
      ) : null;
      break;
    case "video": {
      const embed = videoEmbedUrl(s.videoUrl as string);
      inner = embed ? (
        <div className="site-embed">
          <iframe src={embed} title={section.title ?? "Video"} allowFullScreen loading="lazy" />
        </div>
      ) : null;
      break;
    }
    case "cta":
      inner = (
        <div className="site-cta">
          <div>
            <h2>{section.title}</h2>
            {section.subtitle ? <p>{section.subtitle}</p> : null}
          </div>
          {s.ctaLabel && s.ctaUrl ? (
            <a className="site-button" href={s.ctaUrl as string}>
              {s.ctaLabel as string}
            </a>
          ) : null}
        </div>
      );
      break;
    case "spacer":
      inner = <div style={{ height: Number(s.height ?? 48) }} />;
      break;
    case "newsletter":
      inner = (
        <div className="site-newsletter-block">
          <h2>{section.title}</h2>
          {section.subtitle ? <p>{section.subtitle}</p> : null}
          <NewsletterForm cta={(s.ctaLabel as string) || "Subscribe"} />
        </div>
      );
      break;
    case "divider":
      inner = <hr className="site-divider" />;
      break;
    case "html":
      inner = <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.html as string) }} />;
      break;
    default:
      inner = null;
  }

  if (!inner) return null;

  const showHeader =
    section.title &&
    !["hero", "heading", "cta", "spacer", "divider", "page_title", "featured_with_sidebar", "newsletter"].includes(
      section.type,
    );

  return (
    <section
      className={`site-section ${section.type === "page_title" ? "site-title-band" : ""} ${backgroundClass(s)} ${visibilityClass(s)}`}
      style={sectionStyle(s, section.type)}
    >

      <div className={widthClass(s)}>
        {showHeader ? (
          <header className="site-section-header">
            <h2>{section.title}</h2>
            {section.subtitle ? <p>{section.subtitle}</p> : null}
          </header>
        ) : null}
        {inner}
      </div>
    </section>
  );
}
