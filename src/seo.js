import { getArticles, getCategories, getPages, getTags, loadSettings, settingsSiteUrl } from "./content.js";
import { sitemapEntries } from "./render.js";
import { absoluteUrl, escapeHtml, escapeXml, formatDate, stripHtml } from "./utils.js";

function normalizeSitemapLoc(url, siteUrl) {
  const loc = absoluteUrl(url, siteUrl);
  return loc.startsWith(siteUrl) ? loc : "";
}

export function robotsTxt() {
  const siteUrl = settingsSiteUrl(loadSettings());
  return `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`;
}

export function sitemapXml() {
  const siteUrl = settingsSiteUrl(loadSettings());
  const articles = getArticles();
  const categories = getCategories();
  const tags = getTags();
  const pages = getPages();
  const seen = new Set();
  const urls = sitemapEntries({ articles, categories, tags, pages })
    .map((entry) => ({
      loc: normalizeSitemapLoc(entry.url, siteUrl),
      lastmod: entry.lastmod || new Date().toISOString()
    }))
    .filter((entry) => entry.loc && !seen.has(entry.loc) && seen.add(entry.loc));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>
  </url>`).join("\n")}
</urlset>`;
}

function cdata(value = "") {
  return `<![CDATA[${String(value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function rssXml() {
  const settings = loadSettings();
  const siteUrl = settingsSiteUrl(settings);
  const articles = getArticles().slice(0, 50);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.siteName || "Fabric-Pro")}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(settings.defaultMetaDescription || settings.tagline || "")}</description>
    <language>en</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
    ${articles.map((article) => `<item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(absoluteUrl(article.url, siteUrl))}</link>
      <guid isPermaLink="true">${escapeXml(absoluteUrl(article.url, siteUrl))}</guid>
      <pubDate>${escapeXml(new Date(article.publishedDate).toUTCString())}</pubDate>
      <category>${escapeXml(article.category)}</category>
      <description>${cdata(article.excerpt || stripHtml(article.html))}</description>
      ${article.featuredImage ? `<enclosure url="${escapeXml(absoluteUrl(article.featuredImage, siteUrl))}" type="${escapeXml(imageMime(article.featuredImage))}" />` : ""}
    </item>`).join("\n    ")}
  </channel>
</rss>`;
}

function imageMime(src = "") {
  const ext = src.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

export function atomUpdated() {
  const newest = getArticles()[0];
  return newest ? formatDate(newest.updatedDate || newest.publishedDate) : formatDate(new Date());
}
