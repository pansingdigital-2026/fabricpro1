import { config, contentTypes } from "./config.js";
import { getCategories, getPage, getPages, getTags, loadSettings, settingsSiteUrl } from "./content.js";
import { fontHeadTags, fontStackFor } from "./fonts.js";
import {
  absoluteUrl,
  escapeAttr,
  escapeHtml,
  formatDate,
  htmlDate,
  slugify,
  stripHtml,
  truncate
} from "./utils.js";

function sortedVisible(items = []) {
  return [...items]
    .filter((item) => item.visible !== false && item.visible !== "false")
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function cssVars(settings) {
  const colors = settings.colors || {};
  const typography = settings.typography || {};
  const globalFont = fontStackFor(settings.fontPreset || "gilroy", settings.fontFamily);
  const typeSetting = (key, fallback) => ({ ...fallback, ...(typography[key] || {}) });
  const numeric = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const typeVars = (key, fallback) => {
    const setting = typeSetting(key, fallback);
    const family = setting.font && setting.font !== "global"
      ? fontStackFor(setting.font, settings.fontFamily)
      : globalFont;
    return {
      family,
      size: numeric(setting.size, fallback.size, 12, 72),
      weight: numeric(setting.weight, fallback.weight, 300, 900)
    };
  };
  const menu = typeVars("menu", { size: 17, weight: 650 });
  const homeLeadTitle = typeVars("homeLeadTitle", { size: 32, weight: 700 });
  const homeSectionTitle = typeVars("homeSectionTitle", { size: 22, weight: 700 });
  const cardTitle = typeVars("cardTitle", { size: 20, weight: 650 });
  const articleTitle = typeVars("articleTitle", { size: 40, weight: 750 });
  const pageTitle = typeVars("pageTitle", { size: 38, weight: 750 });
  return `
    :root {
      --bg: ${colors.background || "#ffffff"};
      --text: ${colors.text || "#101214"};
      --muted: ${colors.muted || "#5b6268"};
      --accent: ${colors.accent || "#16756f"};
      --accent-soft: ${colors.accentSoft || "#ecf7f5"};
      --border: ${colors.border || "#dfe5e2"};
      --footer-bg: ${colors.footerBackground || "#050505"};
      --footer-text: ${colors.footerText || "#ffffff"};
      --font-main: ${globalFont};
      --type-menu-font: ${menu.family};
      --type-menu-size: ${menu.size}px;
      --type-menu-weight: ${menu.weight};
      --type-home-lead-font: ${homeLeadTitle.family};
      --type-home-lead-size: ${homeLeadTitle.size}px;
      --type-home-lead-weight: ${homeLeadTitle.weight};
      --type-home-section-font: ${homeSectionTitle.family};
      --type-home-section-size: ${homeSectionTitle.size}px;
      --type-home-section-weight: ${homeSectionTitle.weight};
      --type-card-font: ${cardTitle.family};
      --type-card-size: ${cardTitle.size}px;
      --type-card-weight: ${cardTitle.weight};
      --type-article-font: ${articleTitle.family};
      --type-article-size: ${articleTitle.size}px;
      --type-article-weight: ${articleTitle.weight};
      --type-page-font: ${pageTitle.family};
      --type-page-size: ${pageTitle.size}px;
      --type-page-weight: ${pageTitle.weight};
    }
  `;
}

function verificationTags(settings) {
  const google = config.googleSiteVerification || settings.googleSiteVerification || "";
  const bing = config.bingSiteVerification || settings.bingSiteVerification || "";
  return [
    google ? `<meta name="google-site-verification" content="${escapeAttr(google)}">` : "",
    bing ? `<meta name="msvalidate.01" content="${escapeAttr(bing)}">` : ""
  ].filter(Boolean).join("\n  ");
}

function analyticsTag(settings) {
  const id = config.gaMeasurementId || settings.gaMeasurementId || "";
  if (!id) return "";
  return `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(id)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${escapeAttr(id)}');
  </script>`;
}

function organizationSchema(settings, siteUrl) {
  const org = settings.organization || {};
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name || settings.siteName || "Fabric-Pro",
    url: siteUrl,
    ...(org.logo ? { logo: absoluteUrl(org.logo, siteUrl) } : {}),
    ...(Array.isArray(org.sameAs) && org.sameAs.length ? { sameAs: org.sameAs } : {})
  };
}

function websiteSchema(settings, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName || "Fabric-Pro",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function breadcrumbSchema(items, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.url || "/", siteUrl)
    }))
  };
}

export function articleSchema(article, siteUrl) {
  const schema = {
    "@context": "https://schema.org",
    "@type": contentTypes[article.type]?.schemaType || "Article",
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    image: article.ogImage || article.featuredImage ? [absoluteUrl(article.ogImage || article.featuredImage, siteUrl)] : undefined,
    datePublished: article.publishedDate,
    dateModified: article.updatedDate || article.publishedDate,
    publisher: {
      "@type": "Organization",
      name: "Fabric-Pro"
    },
    mainEntityOfPage: absoluteUrl(article.url, siteUrl),
    articleSection: article.category,
    keywords: article.tags?.join(", ") || undefined
  };
  if (article.showAuthor && article.authorName) {
    schema.author = {
      "@type": "Person",
      name: article.authorName
    };
  }
  if (article.showReviewer && article.reviewerName) {
    schema.reviewedBy = {
      "@type": "Person",
      name: article.reviewerName
    };
  }
  return schema;
}

function faqSchema(article, siteUrl) {
  const faqs = article.faqs || [];
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntityOfPage: absoluteUrl(article.url, siteUrl),
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(item.answer)
      }
    }))
  };
}

function jsonLd(schema = []) {
  return schema.filter(Boolean).map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join("\n  ");
}

function isActive(path, url) {
  if (url === "/") return path === "/";
  return path === url || path.startsWith(`${url}/`);
}

function navHtml(settings, path) {
  return sortedVisible(settings.navigation).map((item) => {
    const active = isActive(path, item.url);
    return `<a href="${escapeAttr(item.url)}" class="${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
  }).join("");
}

function footerLinks(settings) {
  return sortedVisible(settings.footer?.links || []).map((item) => `<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a>`).join("");
}

function brandLink(settings, siteName, className = "brand") {
  const label = settings.logoText || siteName;
  const isFooter = className.includes("footer");
  const logo = settings.logoImage
    ? `<img class="brand-logo" src="${escapeAttr(settings.logoImage)}" alt="${escapeAttr(settings.logoAlt || label)}" width="280" height="140" loading="${isFooter ? "lazy" : "eager"}" decoding="async" fetchpriority="${isFooter ? "low" : "high"}">`
    : "";
  const text = logo ? `<span class="visually-hidden">${escapeHtml(label)}</span>` : `<span>${escapeHtml(label)}</span>`;
  return `<a class="${className} ${logo ? "has-logo" : ""}" href="/" aria-label="${escapeAttr(siteName)} home">${logo}${text}</a>`;
}

function faviconTags(settings, siteUrl) {
  if (!settings.favicon) return "";
  const href = absoluteUrl(settings.favicon, siteUrl);
  const lower = settings.favicon.toLowerCase();
  const type = lower.endsWith(".ico") ? "image/x-icon" : lower.endsWith(".svg") ? "image/svg+xml" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return `<link rel="icon" href="${escapeAttr(href)}" type="${escapeAttr(type)}">
  <link rel="apple-touch-icon" href="${escapeAttr(href)}">`;
}

export function renderAd(position) {
  const settings = loadSettings();
  const widgets = (settings.adWidgets || []).filter((widget) => widget.visible !== false && widget.position === position && widget.html);
  if (!widgets.length) return "";
  return widgets.map((widget) => `<aside class="ad-widget ad-${escapeAttr(position)}" aria-label="${escapeAttr(widget.name || "Advertisement")}">${widget.html}</aside>`).join("");
}

export function publicLayout({
  path = "/",
  title = "",
  description = "",
  canonical = "",
  ogTitle = "",
  ogDescription = "",
  ogImage = "",
  ogType = "website",
  image = "",
  imageAlt = "",
  breadcrumbs = [],
  schema = [],
  body = "",
  robots = "index, follow"
}) {
  const settings = loadSettings();
  const siteUrl = settingsSiteUrl(settings);
  const siteName = settings.siteName || "Fabric-Pro";
  const pageTitle = title || settings.defaultMetaTitle || siteName;
  const pageDescription = description || settings.defaultMetaDescription || settings.tagline || "";
  const socialTitle = ogTitle || pageTitle;
  const socialDescription = ogDescription || pageDescription;
  const canonicalUrl = absoluteUrl(canonical || path, siteUrl);
  const fullImage = ogImage || image || settings.defaultSocialImage ? absoluteUrl(ogImage || image || settings.defaultSocialImage, siteUrl) : "";
  const socialImageAlt = imageAlt || `${siteName} article image`;
  const schemas = [
    organizationSchema(settings, siteUrl),
    websiteSchema(settings, siteUrl),
    ...(breadcrumbs.length ? [breadcrumbSchema(breadcrumbs, siteUrl)] : []),
    ...schema
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeAttr(pageDescription)}">
  <meta name="robots" content="${escapeAttr(robots)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeAttr(siteName)} RSS Feed" href="${escapeAttr(absoluteUrl("/rss.xml", siteUrl))}">
  <meta property="og:type" content="${escapeAttr(ogType)}">
  <meta property="og:site_name" content="${escapeAttr(siteName)}">
  <meta property="og:title" content="${escapeAttr(socialTitle)}">
  <meta property="og:description" content="${escapeAttr(socialDescription)}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  ${fullImage ? `<meta property="og:image" content="${escapeAttr(fullImage)}">` : ""}
  ${fullImage ? `<meta property="og:image:alt" content="${escapeAttr(socialImageAlt)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(socialTitle)}">
  <meta name="twitter:description" content="${escapeAttr(socialDescription)}">
  ${fullImage ? `<meta name="twitter:image" content="${escapeAttr(fullImage)}">` : ""}
  ${faviconTags(settings, siteUrl)}
  ${verificationTags(settings)}
  ${fontHeadTags(settings)}
  <style>${cssVars(settings)}</style>
  <link rel="stylesheet" href="/assets/styles.css?v=${escapeAttr(config.assetVersion)}">
  <script src="/assets/site.js?v=${escapeAttr(config.assetVersion)}" defer></script>
  ${jsonLd(schemas)}
  ${analyticsTag(settings)}
</head>
<body id="top">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      ${brandLink(settings, siteName)}
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>Menu</button>
      <nav class="site-nav" id="primary-nav" aria-label="Primary navigation" data-nav-menu>
        ${navHtml(settings, path)}
      </nav>
    </div>
  </header>
  <main id="main">
    ${body}
  </main>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        ${brandLink(settings, siteName, "footer-brand")}
        <p>${escapeHtml(settings.footer?.text || settings.tagline || "")}</p>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">${footerLinks(settings)}</nav>
    </div>
    <div class="container footer-small">© ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.</div>
  </footer>
  <a class="to-top-button" href="#top" aria-label="Go to top" title="Go to top">&#8593;</a>
</body>
</html>`;
}

function imageSizes(className) {
  if (className === "lead-image") return "(min-width: 980px) 560px, 100vw";
  if (className === "row-image") return "(min-width: 720px) 260px, 100vw";
  if (className === "card-image") return "(min-width: 720px) 33vw, 50vw";
  return "100vw";
}

function imageHtml(article, className = "card-image", loading = "lazy") {
  if (!article.featuredImage) return `<div class="${className} image-empty" aria-hidden="true"></div>`;
  const fetchPriority = loading === "eager" ? "high" : "low";
  return `<img class="${className}" src="${escapeAttr(article.featuredImage)}" alt="${escapeAttr(article.altText || article.title)}" width="1200" height="675" sizes="${escapeAttr(imageSizes(className))}" loading="${escapeAttr(loading)}" decoding="async" fetchpriority="${fetchPriority}">`;
}

function articleMeta(article) {
  return `<div class="article-meta">
    <a href="/category/${escapeAttr(article.categorySlug)}">${escapeHtml(article.category)}</a>
    <span>${escapeHtml(formatDate(article.publishedDate))}</span>
    <span>${escapeHtml(article.readingMinutes)} min read</span>
  </div>`;
}

export function articleCard(article, options = {}) {
  const loading = options.eager ? "eager" : "lazy";
  return `<article class="article-card">
    <a class="article-card-image" href="${escapeAttr(article.url)}">${imageHtml(article, "card-image", loading)}</a>
    <div class="article-card-body">
      ${articleMeta(article)}
      <h3><a href="${escapeAttr(article.url)}">${escapeHtml(article.title)}</a></h3>
      <p>${escapeHtml(article.excerpt)}</p>
    </div>
  </article>`;
}

export function articleListItem(article, options = {}) {
  return `<article class="article-row">
    <a class="article-row-image" href="${escapeAttr(article.url)}">${imageHtml(article, "row-image", options.eager ? "eager" : "lazy")}</a>
    <div class="article-row-body">
      ${articleMeta(article)}
      <h2><a href="${escapeAttr(article.url)}">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.excerpt)}</p>
      ${article.showAuthor && article.authorName ? `<div class="byline">By ${escapeHtml(article.authorName)}</div>` : ""}
    </div>
  </article>`;
}

function sidebarList(title, articles) {
  return `<section class="sidebar-block">
    <h2>${escapeHtml(title)}</h2>
    <div class="compact-list">
      ${articles.map((article) => `<a href="${escapeAttr(article.url)}"><span>${escapeHtml(article.title)}</span><small>${escapeHtml(formatDate(article.publishedDate))}</small></a>`).join("")}
    </div>
  </section>`;
}

function sectionHeader(title, href) {
  return `<div class="section-header"><h2>${escapeHtml(title)}</h2><a href="${escapeAttr(href)}">View all</a></div>`;
}

function mobileHomeSection(title, href, articles, prioritizeFirst = false) {
  return `<section class="mobile-home-section">
    ${sectionHeader(title, href)}
    <div class="mobile-card-row">${articles.slice(0, 2).map((article, index) => articleCard(article, { eager: prioritizeFirst && index === 0 })).join("") || emptyState("No articles yet.")}</div>
  </section>`;
}

function relatedArticlesSection(related, text = {}) {
  const title = text.relatedTitle || "Related Reading";
  const emptyText = text.emptyRelatedText || "No related articles found.";
  return `<section class="related-articles" aria-labelledby="related-articles-title">
    <div class="section-header">
      <h2 id="related-articles-title">${escapeHtml(title)}</h2>
    </div>
    <div class="card-grid related-grid">
      ${related.length ? related.slice(0, 3).map((article) => articleCard(article)).join("") : emptyState(emptyText)}
    </div>
  </section>`;
}

function sidebarLatestTitle(articleType, text = {}) {
  if (articleType === "news") return text.newsSidebarLatestTitle || "Latest Insights";
  if (articleType === "blogs") return text.blogsSidebarLatestTitle || "Latest Insights";
  return text.insightsSidebarLatestTitle || "Latest News";
}

function sidebarTinyImage(article) {
  if (!article.featuredImage) return "";
  return `<img src="${escapeAttr(article.featuredImage)}" alt="${escapeAttr(article.altText || article.title)}" width="96" height="72" loading="lazy" decoding="async">`;
}

function articleSidebarSection(article, latestArticles = [], text = {}) {
  const categories = getCategories().filter((category) => category.visible !== false).slice(0, 10);
  const latestTitle = sidebarLatestTitle(article.type, text);
  return `<div class="article-sidebar-stack">
    <section class="article-sidebar-block article-sidebar-search" aria-labelledby="article-sidebar-search-title">
      <h2 id="article-sidebar-search-title" class="visually-hidden">Search</h2>
      <form action="/search" method="get" role="search">
        <label class="visually-hidden" for="article-sidebar-search-input">Search Fabric-Pro</label>
        <input id="article-sidebar-search-input" name="q" type="search" placeholder="${escapeAttr(text.searchPlaceholder || "Search Fabric-Pro")}" autocomplete="off">
        <button type="submit">Search</button>
      </form>
    </section>

    <section class="article-sidebar-block" aria-labelledby="article-sidebar-categories-title">
      <h2 id="article-sidebar-categories-title">${escapeHtml(text.popularCategoriesTitle || "Popular Categories")}</h2>
      <div class="article-sidebar-categories">
        ${categories.length ? categories.map((category) => `<a href="/category/${escapeAttr(category.slug)}">
          <span>${escapeHtml(category.name)}</span>
          ${Number(category.count) ? `<small>${escapeHtml(category.count)}</small>` : ""}
        </a>`).join("") : emptyState("No categories available.")}
      </div>
    </section>

    <section class="article-sidebar-block" aria-labelledby="article-sidebar-latest-title">
      <h2 id="article-sidebar-latest-title">${escapeHtml(latestTitle)}</h2>
      <div class="article-sidebar-items">
        ${latestArticles.length ? latestArticles.map((item) => `<a class="article-sidebar-item ${item.featuredImage ? "has-thumb" : ""}" href="${escapeAttr(item.url)}">
          ${sidebarTinyImage(item)}
          <span>${escapeHtml(formatDate(item.publishedDate))}</span>
          <strong>${escapeHtml(item.title)}</strong>
        </a>`).join("") : emptyState(text.emptySidebarLatestText || "No articles available.")}
      </div>
    </section>
  </div>`;
}

export function homePage({ news, blogs, insights }) {
  const settings = loadSettings();
  const sectionConfig = (type, title, limit) => {
    const found = (settings.homepageSections || []).find((section) => section.type === type);
    return {
      title: found?.title || title,
      limit: Number(found?.limit || limit),
      visible: found?.visible !== false
    };
  };
  const newsConfig = sectionConfig("news", "Latest News", 9);
  const blogConfig = sectionConfig("blogs", "Latest Blogs", 6);
  const insightConfig = sectionConfig("insights", "Latest Insights", 6);
  const newsItems = newsConfig.visible ? news.slice(0, newsConfig.limit) : [];
  const blogItems = blogConfig.visible ? blogs.slice(0, blogConfig.limit) : [];
  const insightItems = insightConfig.visible ? insights.slice(0, insightConfig.limit) : [];
  const lead = newsItems[0];
  const restNews = newsItems.slice(1);
  const body = `
    ${renderAd("home-top")}
    <section class="container mobile-home-stack">
      <h1 class="visually-hidden">${escapeHtml(settings.siteName)} latest textile industry articles</h1>
      ${newsConfig.visible ? mobileHomeSection(newsConfig.title, "/news", newsItems, true) : ""}
      ${blogConfig.visible ? mobileHomeSection(blogConfig.title, "/blogs", blogItems) : ""}
      ${insightConfig.visible ? mobileHomeSection(insightConfig.title, "/insights", insightItems) : ""}
    </section>
    <div class="desktop-home">
      <section class="container home-news">
        <h1 class="visually-hidden">${escapeHtml(settings.siteName)} latest textile industry articles</h1>
        <div class="main-stream">
          ${sectionHeader(newsConfig.title, "/news")}
          ${lead ? `<article class="lead-story">
            <a href="${escapeAttr(lead.url)}">${imageHtml(lead, "lead-image")}</a>
            <div class="lead-copy">
              ${articleMeta(lead)}
              <h2><a href="${escapeAttr(lead.url)}">${escapeHtml(lead.title)}</a></h2>
              <p>${escapeHtml(lead.excerpt)}</p>
            </div>
          </article>` : emptyState("No news articles have been published yet.")}
          <div class="news-list">
            ${restNews.map((article) => articleListItem(article)).join("")}
          </div>
        </div>
        <aside class="home-sidebar">
          ${renderAd("sidebar")}
          ${blogConfig.visible ? sidebarList(blogConfig.title, blogItems.slice(0, 5)) : ""}
          ${insightConfig.visible ? sidebarList(insightConfig.title, insightItems.slice(0, 5)) : ""}
        </aside>
      </section>
      ${blogConfig.visible ? `<section class="container content-section">
        ${sectionHeader(blogConfig.title, "/blogs")}
        <div class="card-grid">${blogItems.map((article) => articleCard(article)).join("") || emptyState("No blog posts yet.")}</div>
      </section>` : ""}
      ${insightConfig.visible ? `<section class="container content-section">
        ${sectionHeader(insightConfig.title, "/insights")}
        <div class="card-grid">${insightItems.map((article) => articleCard(article)).join("") || emptyState("No insights yet.")}</div>
      </section>` : ""}
    </div>
    <section class="submit-band">
      <div class="container submit-band-inner">
        <div>
          <p class="eyebrow">Have company news?</p>
          <h2>Send product launches, investments, partnerships, reports, and textile industry updates.</h2>
        </div>
        <a class="button" href="/submit-news">Submit News</a>
      </div>
    </section>
  `;
  return publicLayout({
    path: "/",
    title: settings.defaultMetaTitle,
    description: settings.defaultMetaDescription,
    body
  });
}

export function listingPage({ type, articles, selectedCategory = null }) {
  const meta = contentTypes[type];
  const settings = loadSettings();
  const title = selectedCategory ? `${selectedCategory.name} ${meta.plural} | ${settings.siteName}` : `${meta.plural} | ${settings.siteName}`;
  const description = selectedCategory
    ? `Latest ${selectedCategory.name.toLowerCase()} articles from ${settings.siteName}.`
    : `Latest ${meta.plural.toLowerCase()} from ${settings.siteName}.`;
  const categories = getCategories();
  const body = `
    <section class="container page-heading">
      ${breadcrumbsHtml([{ label: "Home", url: "/" }, { label: meta.plural, url: meta.path }])}
      <h1>${escapeHtml(selectedCategory ? selectedCategory.name : meta.plural)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="container chip-row" aria-label="Browse by category">
      <a class="chip ${!selectedCategory ? "active" : ""}" href="${escapeAttr(meta.path)}">All</a>
      ${categories.map((category) => `<a class="chip ${selectedCategory?.slug === category.slug ? "active" : ""}" href="/category/${escapeAttr(category.slug)}">${escapeHtml(category.name)}</a>`).join("")}
    </section>
    ${renderAd("listing-top")}
    <section class="container listing-stack">
      ${articles.map((article, index) => articleListItem(article, { eager: index === 0 })).join("") || emptyState("No published articles found.")}
    </section>
  `;
  return publicLayout({
    path: selectedCategory ? `/category/${selectedCategory.slug}` : meta.path,
    title,
    description,
    breadcrumbs: [{ label: "Home", url: "/" }, { label: meta.plural, url: meta.path }],
    body
  });
}

export function categoryPage({ category, articles }) {
  const settings = loadSettings();
  const categories = getCategories();
  const body = `
    <section class="container page-heading">
      ${breadcrumbsHtml([{ label: "Home", url: "/" }, { label: category.name, url: `/category/${category.slug}` }])}
      <h1>${escapeHtml(category.name)}</h1>
      <p>${escapeHtml(`Latest news, blogs, and insights about ${category.name.toLowerCase()} from ${settings.siteName}.`)}</p>
    </section>
    <section class="container chip-row" aria-label="Browse by category">
      ${categories.map((item) => `<a class="chip ${item.slug === category.slug ? "active" : ""}" href="/category/${escapeAttr(item.slug)}">${escapeHtml(item.name)}</a>`).join("")}
    </section>
    ${renderAd("listing-top")}
    <section class="container listing-stack">
      ${articles.map((article, index) => articleListItem(article, { eager: index === 0 })).join("") || emptyState("No published articles found in this category.")}
    </section>
  `;
  return publicLayout({
    path: `/category/${category.slug}`,
    title: `${category.name} | ${settings.siteName}`,
    description: `Latest news, blogs, and insights about ${category.name.toLowerCase()} from ${settings.siteName}.`,
    breadcrumbs: [{ label: "Home", url: "/" }, { label: category.name, url: `/category/${category.slug}` }],
    body
  });
}

export function tagPage({ tag, articles }) {
  const settings = loadSettings();
  const tags = getTags();
  const body = `
    <section class="container page-heading">
      ${breadcrumbsHtml([{ label: "Home", url: "/" }, { label: tag.name, url: `/tag/${tag.slug}` }])}
      <p class="eyebrow">Tag</p>
      <h1>${escapeHtml(tag.name)}</h1>
      <p>${escapeHtml(`Latest Fabric-Pro articles tagged ${tag.name}.`)}</p>
    </section>
    <section class="container chip-row" aria-label="Browse by tag">
      ${tags.map((item) => `<a class="chip ${item.slug === tag.slug ? "active" : ""}" href="/tag/${escapeAttr(item.slug)}">${escapeHtml(item.name)}</a>`).join("")}
    </section>
    ${renderAd("listing-top")}
    <section class="container listing-stack">
      ${articles.map((article, index) => articleListItem(article, { eager: index === 0 })).join("") || emptyState("No published articles found with this tag.")}
    </section>
  `;
  return publicLayout({
    path: `/tag/${tag.slug}`,
    title: `${tag.name} Articles | ${settings.siteName}`,
    description: `Latest Fabric-Pro news, blogs, and insights tagged ${tag.name}.`,
    breadcrumbs: [{ label: "Home", url: "/" }, { label: tag.name, url: `/tag/${tag.slug}` }],
    body
  });
}

export function articlePage({ article, related = [], sidebarLatestArticles = [] }) {
  const settings = loadSettings();
  const siteUrl = settingsSiteUrl(settings);
  const articleText = settings.articlePageText || {};
  const sectionCrumb = { label: contentTypes[article.type].plural, url: contentTypes[article.type].path };
  const breadcrumbs = [
    { label: "Home", url: "/" },
    sectionCrumb,
    ...(article.category ? [{ label: article.category, url: `/category/${article.categorySlug}` }] : [])
  ];
  const bylineParts = [
    article.showAuthor && article.authorName ? `By ${escapeHtml(article.authorName)}` : "",
    article.showReviewer && article.reviewerName ? `Reviewed by ${escapeHtml(article.reviewerName)}` : ""
  ].filter(Boolean);
  const body = `
    <article class="article-shell">
      <div class="container article-layout">
        <div class="article-hero">
          <header class="article-header">
            ${breadcrumbsHtml(breadcrumbs)}
            ${articleMeta(article)}
            <h1>${escapeHtml(article.title)}</h1>
            <p class="dek">${escapeHtml(article.excerpt)}</p>
            ${bylineParts.length ? `<div class="author-line">${bylineParts.join(" · ")}</div>` : ""}
          </header>
          ${article.featuredImage ? `<figure class="featured-figure"><img src="${escapeAttr(article.featuredImage)}" alt="${escapeAttr(article.altText || article.title)}" width="1200" height="675" sizes="(min-width: 980px) 420px, 100vw" loading="eager" decoding="async" fetchpriority="high">${article.imageCaption ? `<figcaption>${escapeHtml(article.imageCaption)}</figcaption>` : ""}</figure>` : ""}
        </div>
        ${renderAd("article-top")}
        <div class="article-main">
          <div class="article-content">
            ${article.html}
            ${article.tags?.length ? `<div class="tag-list" aria-label="Article tags">${article.tags.map((tag) => `<a href="/tag/${escapeAttr(slugify(tag))}">${escapeHtml(tag)}</a>`).join("")}</div>` : ""}
            <div class="article-dates">Published ${escapeHtml(formatDate(article.publishedDate))}${article.updatedDate ? ` · Updated ${escapeHtml(formatDate(article.updatedDate))}` : ""}</div>
            ${renderAd("article-bottom")}
          </div>
          <aside class="article-aside">
            ${articleSidebarSection(article, sidebarLatestArticles, articleText)}
            ${renderAd("article-sidebar")}
          </aside>
        </div>
        ${relatedArticlesSection(related, articleText)}
      </div>
    </article>
  `;
  return publicLayout({
    path: article.url,
    title: article.metaTitle,
    description: article.metaDescription,
    canonical: article.canonicalUrl || article.url,
    ogTitle: article.ogTitle,
    ogDescription: article.ogDescription,
    ogImage: article.ogImage,
    ogType: "article",
    image: article.ogImage || article.featuredImage,
    imageAlt: article.altText,
    breadcrumbs,
    schema: [articleSchema(article, siteUrl), faqSchema(article, siteUrl)],
    body
  });
}

export function pageView(page) {
  const breadcrumbs = [{ label: "Home", url: "/" }, { label: page.title, url: page.url }];
  const body = `
    <section class="container page-heading narrow-page">
      ${breadcrumbsHtml(breadcrumbs)}
      <h1>${escapeHtml(page.title)}</h1>
      ${page.excerpt ? `<p>${escapeHtml(page.excerpt)}</p>` : ""}
    </section>
    <section class="container page-content narrow-page">
      ${page.featuredImage ? `<img class="page-featured-image" src="${escapeAttr(page.featuredImage)}" alt="${escapeAttr(page.altText || page.title)}" width="1200" height="675" sizes="(min-width: 780px) 780px, 100vw" loading="eager" decoding="async" fetchpriority="high">` : ""}
      ${page.html}
    </section>
  `;
  return publicLayout({
    path: page.url,
    title: page.metaTitle,
    description: page.metaDescription,
    canonical: page.canonicalUrl || page.url,
    image: page.featuredImage,
    imageAlt: page.altText,
    breadcrumbs,
    body
  });
}

export function submitNewsPage({ submitted = false } = {}) {
  const body = `
    <section class="container page-heading narrow-page">
      ${breadcrumbsHtml([{ label: "Home", url: "/" }, { label: "Submit News", url: "/submit-news" }])}
      <h1>Submit News</h1>
      <p>Share company announcements, product launches, investments, reports, appointments, partnerships, events, and textile industry updates for editorial review.</p>
    </section>
    <section class="container form-section narrow-page">
      ${submitted ? `<div class="success-box">Thank you. Your submission has been received for editorial review.</div>` : ""}
      <form method="post" action="/submit-news" class="form-stack">
        <label>Your name <input name="name" required autocomplete="name"></label>
        <label>Company <input name="company" required></label>
        <label>Email <input name="email" type="email" required autocomplete="email"></label>
        <label>News title <input name="title" required></label>
        <label>Source or press release link <input name="sourceLink" type="url" placeholder="https://"></label>
        <label>Summary <textarea name="summary" rows="8" required></textarea></label>
        <label>Image link <input name="imageLink" type="url" placeholder="https://"></label>
        <label class="checkbox-row"><input name="consent" type="checkbox" value="yes" required> I confirm I have permission to submit this news for editorial review.</label>
        <button class="button" type="submit">Send Submission</button>
      </form>
    </section>
  `;
  return publicLayout({
    path: "/submit-news",
    title: "Submit News | Fabric-Pro",
    description: "Submit textile, fabric, apparel material, machinery, sourcing, sustainability, and industry news to Fabric-Pro for editorial review.",
    breadcrumbs: [{ label: "Home", url: "/" }, { label: "Submit News", url: "/submit-news" }],
    body
  });
}

export function contactPage({ submitted = false } = {}) {
  const page = getPage("contact");
  const body = `
    <section class="container page-heading narrow-page">
      ${breadcrumbsHtml([{ label: "Home", url: "/" }, { label: "Contact", url: "/contact" }])}
      <h1>${escapeHtml(page?.title || "Contact")}</h1>
      <p>${escapeHtml(page?.excerpt || "Contact the Fabric-Pro editorial team.")}</p>
    </section>
    <section class="container page-content narrow-page">${page?.html || ""}</section>
    <section class="container form-section narrow-page">
      ${submitted ? `<div class="success-box">Thanks. Your message has been received.</div>` : ""}
      <form method="post" action="/contact" class="form-stack">
        <label>Your name <input name="name" required autocomplete="name"></label>
        <label>Email <input name="email" type="email" required autocomplete="email"></label>
        <label>Company <input name="company"></label>
        <label>Message <textarea name="message" rows="7" required></textarea></label>
        <button class="button" type="submit">Send Message</button>
      </form>
    </section>
  `;
  return publicLayout({
    path: "/contact",
    title: page?.metaTitle || "Contact | Fabric-Pro",
    description: page?.metaDescription || "Contact Fabric-Pro.",
    breadcrumbs: [{ label: "Home", url: "/" }, { label: "Contact", url: "/contact" }],
    body
  });
}

export function searchPage({ query, articles }) {
  const body = `
    <section class="container page-heading">
      <h1>Search</h1>
      <form class="search-form" action="/search" method="get">
        <input name="q" value="${escapeAttr(query)}" placeholder="Search articles">
        <button class="button" type="submit">Search</button>
      </form>
    </section>
    <section class="container listing-stack">
      ${articles.map(articleListItem).join("") || emptyState(query ? "No matching articles found." : "Enter a search term.")}
    </section>
  `;
  return publicLayout({
    path: "/search",
    title: query ? `Search results for ${query} | Fabric-Pro` : "Search | Fabric-Pro",
    description: "Search Fabric-Pro articles.",
    robots: "noindex, follow",
    body
  });
}

export function errorPage(status = 404, title = "Page not found", message = "The page you requested could not be found.") {
  const body = `
    <section class="container page-heading narrow-page error-page">
      <p class="eyebrow">${status}</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="button" href="/">Go Home</a>
    </section>
  `;
  return publicLayout({
    path: "/404",
    title: `${status} ${title} | Fabric-Pro`,
    description: message,
    robots: "noindex, follow",
    body
  });
}

export function breadcrumbsHtml(items = []) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => {
    const last = index === items.length - 1;
    return last ? `<span>${escapeHtml(item.label)}</span>` : `<a href="${escapeAttr(item.url)}">${escapeHtml(item.label)}</a>`;
  }).join("<span aria-hidden=\"true\">/</span>")}</nav>`;
}

export function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

export function sitemapEntries({ articles, categories, tags = [], pages }) {
  const now = new Date().toISOString();
  const builtInPages = [
    { url: "/", lastmod: now },
    { url: "/news", lastmod: articles.find((item) => item.type === "news")?.lastmod || now },
    { url: "/blogs", lastmod: articles.find((item) => item.type === "blogs")?.lastmod || now },
    { url: "/insights", lastmod: articles.find((item) => item.type === "insights")?.lastmod || now },
    { url: "/about", lastmod: getPage("about")?.lastmod || now },
    { url: "/contact", lastmod: getPage("contact")?.lastmod || now },
    { url: "/submit-news", lastmod: now }
  ];
  const customPages = pages
    .filter((page) => !["about", "contact", "home"].includes(page.slug))
    .map((page) => ({ url: page.canonicalUrl || page.url, lastmod: page.lastmod }));
  const categoryPages = categories.map((category) => ({ url: `/category/${category.slug}`, lastmod: category.lastmod || now }));
  const tagPages = tags.map((tag) => ({ url: `/tag/${tag.slug}`, lastmod: tag.lastmod || now }));
  const articlePages = articles.map((article) => ({ url: article.canonicalUrl || article.url, lastmod: article.lastmod || article.updatedDate || article.publishedDate }));
  return [...builtInPages, ...customPages, ...categoryPages, ...tagPages, ...articlePages];
}
