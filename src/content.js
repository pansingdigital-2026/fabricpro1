import fs from "node:fs";
import path from "node:path";
import { config, contentTypes, defaultHeaderNavigation, paths } from "./config.js";
import { markdownToHtml } from "./markdown.js";
import {
  absoluteUrl,
  ensureDir,
  htmlDate,
  isoDate,
  normalizeTags,
  readingTime,
  slugify,
  stripHtml,
  toDate,
  truncate
} from "./utils.js";

const markdownExtensions = new Set([".md", ".mdx"]);

const defaultCategoryNames = [
  "Textile Industry",
  "Textile Machinery",
  "Sustainable Fabrics",
  "Textile Recycling",
  "Fabric Manufacturing",
  "Apparel Materials",
  "Technical Textiles",
  "Smart Textiles",
  "Dyeing and Finishing",
  "Supply Chain and Sourcing",
  "Textile Exports",
  "Policy and Regulations"
];

const defaultTagNames = [
  "textile industry",
  "textile machinery",
  "sustainable fabrics",
  "textile recycling",
  "fabric manufacturing",
  "apparel materials",
  "technical textiles",
  "smart textiles",
  "dyeing and finishing",
  "sourcing",
  "textile exports"
];

function defaultCategories() {
  return defaultCategoryNames.map((name, index) => ({
    name,
    slug: slugify(name),
    visible: true,
    order: index + 1
  }));
}

function defaultTags() {
  return defaultTagNames.map((name, index) => ({
    name,
    slug: slugify(name),
    visible: true,
    order: index + 1
  }));
}

function defaultTypography() {
  return {
    menu: { font: "global", size: 17, weight: 650 },
    homeLeadTitle: { font: "global", size: 32, weight: 700 },
    homeSectionTitle: { font: "global", size: 22, weight: 700 },
    cardTitle: { font: "global", size: 20, weight: 650 },
    articleTitle: { font: "global", size: 40, weight: 750 },
    pageTitle: { font: "global", size: 38, weight: 750 }
  };
}

export function defaultSettings() {
  return {
    siteName: "Fabric-Pro",
    tagline: "Textile industry news, fabric innovation, sourcing updates, and practical insights.",
    defaultMetaTitle: "Fabric-Pro | Textile News, Fabric Blogs and Industry Insights",
    defaultMetaDescription: "Latest textile industry news, fabric manufacturing updates, sustainable materials, textile machinery coverage, sourcing blogs, and expert insights.",
    defaultSocialImage: "/images/textile-machinery-news.jpg",
    logoText: "Fabric-Pro",
    logoImage: "",
    logoAlt: "Fabric-Pro",
    favicon: "",
    fontPreset: "gilroy",
    fontFamily: "Gilroy, 'Avenir Next', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    typography: defaultTypography(),
    colors: {
      background: "#ffffff",
      text: "#101214",
      muted: "#5b6268",
      accent: "#16756f",
      accentSoft: "#ecf7f5",
      border: "#dfe5e2",
      footerBackground: "#050505",
      footerText: "#ffffff"
    },
    googleSiteVerification: "",
    bingSiteVerification: "",
    gaMeasurementId: "",
    organization: {
      name: "Fabric-Pro",
      url: config.siteUrl,
      logo: "",
      sameAs: []
    },
    navigation: defaultHeaderNavigation,
    footer: {
      text: "Fabric-Pro publishes clear, useful coverage for textile, fabric, apparel material, sourcing, machinery, and sustainability professionals.",
      links: [
        { label: "About", url: "/about", visible: true, order: 1 },
        { label: "Contact", url: "/contact", visible: true, order: 2 },
        { label: "Submit News", url: "/submit-news", visible: true, order: 3 },
        { label: "RSS", url: "/rss.xml", visible: true, order: 4 }
      ]
    },
    homepageSections: [
      { type: "news", title: "Latest News", visible: true, limit: 9 },
      { type: "blogs", title: "Latest Blogs", visible: true, limit: 6 },
      { type: "insights", title: "Latest Insights", visible: true, limit: 6 }
    ],
    categories: defaultCategories(),
    tags: defaultTags(),
    adWidgets: []
  };
}

function mergeDeep(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== "object") return override ?? base;
  const output = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeDeep(base[key] || {}, value)
      : value;
  }
  return output;
}

export function loadSettings() {
  ensureDir(paths.dataDir);
  if (!fs.existsSync(paths.settingsFile)) return defaultSettings();
  try {
    return mergeDeep(defaultSettings(), JSON.parse(fs.readFileSync(paths.settingsFile, "utf8")));
  } catch {
    return defaultSettings();
  }
}

export function settingsSiteUrl(settings = loadSettings()) {
  return String(settings.organization?.url || config.siteUrl || "http://localhost:3000").replace(/\/+$/, "");
}

function parseScalar(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => parseScalar(item.trim())).filter(Boolean);
  }
  return trimmed;
}

export function parseFrontmatter(text = "") {
  const match = String(text).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    data[key] = parseScalar(value);
  }
  return { data, body: match[2] || "" };
}

function quoteFrontmatter(value) {
  if (Array.isArray(value)) return `[${value.map((item) => quoteFrontmatter(item)).join(", ")}]`;
  if (value === true || value === false) return String(value);
  const text = String(value ?? "");
  if (!text) return '""';
  return JSON.stringify(text);
}

export function serializeFrontmatter(data, body = "") {
  const lines = Object.entries(data).map(([key, value]) => `${key}: ${quoteFrontmatter(value)}`);
  return `---\n${lines.join("\n")}\n---\n\n${String(body).trim()}\n`;
}

function contentDirForType(type) {
  const meta = contentTypes[type];
  if (!meta) return "";
  return path.join(paths.contentDir, meta.folder);
}

function articleUrl(type, slug) {
  return `${contentTypes[type].path}/${slug}`;
}

function pageUrl(slug) {
  return slug === "home" ? "/" : `/${slug}`;
}

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => markdownExtensions.has(path.extname(file).toLowerCase()))
    .map((file) => path.join(dir, file));
}

function normalizeArticle(filePath, type, includeHidden = false) {
  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const { data, body } = parseFrontmatter(raw);
  const slug = slugify(data.slug || path.basename(filePath, path.extname(filePath)));
  const status = String(data.status || "published").toLowerCase();
  if (!includeHidden && status !== "published") return null;
  const html = markdownToHtml(body);
  const category = String(data.category || "Textile Industry").trim();
  const tags = normalizeTags(data.tags);
  const publishedDate = data.publishedDate || stat.birthtime.toISOString();
  const updatedDate = data.updatedDate || stat.mtime.toISOString();
  return {
    ...data,
    type,
    typeMeta: contentTypes[type],
    status,
    title: String(data.title || slug).trim(),
    metaTitle: String(data.metaTitle || data.title || slug).trim(),
    metaDescription: String(data.metaDescription || data.excerpt || truncate(stripHtml(html), 155)).trim(),
    slug,
    url: articleUrl(type, slug),
    canonicalUrl: data.canonicalUrl || articleUrl(type, slug),
    category,
    categorySlug: slugify(category),
    author: String(data.author || "Fabric-Pro Editorial Desk").trim(),
    reviewedBy: String(data.reviewedBy || "").trim(),
    publishedDate,
    updatedDate,
    lastmod: isoDate(updatedDate || publishedDate || stat.mtime),
    featuredImage: String(data.featuredImage || "").trim(),
    altText: String(data.altText || data.title || "").trim(),
    imageCaption: String(data.imageCaption || data.caption || "").trim(),
    tags,
    tagSlugs: tags.map((tag) => slugify(tag)),
    excerpt: String(data.excerpt || truncate(stripHtml(html), 180)).trim(),
    bodyMarkdown: body,
    html,
    readingMinutes: readingTime(body),
    filePath,
    relativePath: path.relative(paths.rootDir, filePath).replace(/\\/g, "/")
  };
}

export function getArticles(options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const articles = [];
  for (const type of Object.keys(contentTypes)) {
    for (const filePath of readMarkdownFiles(contentDirForType(type))) {
      const article = normalizeArticle(filePath, type, includeHidden);
      if (article) articles.push(article);
    }
  }
  return articles.sort((a, b) => (toDate(b.publishedDate)?.getTime() || 0) - (toDate(a.publishedDate)?.getTime() || 0));
}

export function getArticlesByType(type, options = {}) {
  return getArticles(options).filter((article) => article.type === type);
}

export function getArticle(type, slug, options = {}) {
  return getArticles({ includeHidden: Boolean(options.includeHidden) })
    .find((article) => article.type === type && article.slug === slug) || null;
}

export function getCategories(options = {}) {
  const settings = loadSettings();
  const categories = new Map();
  const includeHidden = Boolean(options.includeHidden);
  const settingsLastmod = fs.existsSync(paths.settingsFile)
    ? fs.statSync(paths.settingsFile).mtime.toISOString()
    : new Date().toISOString();

  if (includeHidden) {
    for (const category of settings.categories || []) {
      const name = String(category.name || "").trim();
      if (!name) continue;
      const visible = category.visible !== false && category.visible !== "false";
      const slug = slugify(category.slug || name);
      categories.set(slug, {
        name,
        slug,
        count: 0,
        lastmod: category.updatedDate || settingsLastmod,
        visible,
        order: Number(category.order || 0)
      });
    }
  }

  for (const article of getArticles(options)) {
    const existing = categories.get(article.categorySlug) || {
      name: article.category,
      slug: article.categorySlug,
      count: 0,
      lastmod: article.lastmod,
      visible: true,
      order: 999
    };
    existing.count += 1;
    if ((toDate(article.lastmod)?.getTime() || 0) > (toDate(existing.lastmod)?.getTime() || 0)) existing.lastmod = article.lastmod;
    categories.set(article.categorySlug, existing);
  }
  return [...categories.values()].sort((a, b) => (a.order || 999) - (b.order || 999) || a.name.localeCompare(b.name));
}

export function getTags(options = {}) {
  const settings = loadSettings();
  const tags = new Map();
  const includeHidden = Boolean(options.includeHidden);
  const settingsLastmod = fs.existsSync(paths.settingsFile)
    ? fs.statSync(paths.settingsFile).mtime.toISOString()
    : new Date().toISOString();

  if (includeHidden) {
    for (const tag of settings.tags || []) {
      const name = String(tag.name || "").trim();
      if (!name) continue;
      const visible = tag.visible !== false && tag.visible !== "false";
      const slug = slugify(tag.slug || name);
      tags.set(slug, {
        name,
        slug,
        count: 0,
        lastmod: tag.updatedDate || settingsLastmod,
        visible,
        order: Number(tag.order || 0)
      });
    }
  }

  for (const article of getArticles(options)) {
    article.tags.forEach((name) => {
      const slug = slugify(name);
      const existing = tags.get(slug) || {
        name,
        slug,
        count: 0,
        lastmod: article.lastmod,
        visible: true,
        order: 999
      };
      existing.count += 1;
      if ((toDate(article.lastmod)?.getTime() || 0) > (toDate(existing.lastmod)?.getTime() || 0)) existing.lastmod = article.lastmod;
      tags.set(slug, existing);
    });
  }

  return [...tags.values()].sort((a, b) => (a.order || 999) - (b.order || 999) || a.name.localeCompare(b.name));
}

function normalizePage(filePath, includeHidden = false) {
  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const { data, body } = parseFrontmatter(raw);
  const slug = slugify(data.slug || path.basename(filePath, path.extname(filePath)));
  const status = String(data.status || "published").toLowerCase();
  if (!includeHidden && status !== "published") return null;
  const html = markdownToHtml(body);
  const url = pageUrl(slug);
  return {
    ...data,
    status,
    slug,
    title: String(data.title || slug).trim(),
    metaTitle: String(data.metaTitle || data.title || slug).trim(),
    metaDescription: String(data.metaDescription || data.excerpt || truncate(stripHtml(html), 155)).trim(),
    canonicalUrl: data.canonicalUrl || url,
    featuredImage: String(data.featuredImage || "").trim(),
    altText: String(data.altText || data.title || "").trim(),
    updatedDate: data.updatedDate || stat.mtime.toISOString(),
    lastmod: isoDate(data.updatedDate || stat.mtime),
    bodyMarkdown: body,
    html,
    url,
    filePath,
    relativePath: path.relative(paths.rootDir, filePath).replace(/\\/g, "/")
  };
}

export function getPages(options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  return readMarkdownFiles(path.join(paths.contentDir, "pages"))
    .map((filePath) => normalizePage(filePath, includeHidden))
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getPage(slug, options = {}) {
  return getPages({ includeHidden: Boolean(options.includeHidden) }).find((page) => page.slug === slug) || null;
}

export function absoluteCanonical(pathOrUrl) {
  return absoluteUrl(pathOrUrl, settingsSiteUrl(loadSettings()));
}

export function formDateValue(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : htmlDate(new Date());
}
