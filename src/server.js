import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { config, contentTypes, paths } from "./config.js";
import { importDocxToHtml } from "./docxImportService.js";
import {
  defaultSettings,
  formDateValue,
  getArticle,
  getArticles,
  getArticlesByType,
  getCategories,
  getPage,
  getPages,
  getTags,
  loadSettings,
  serializeFrontmatter
} from "./content.js";
import { deleteSyncedFile, syncBinaryFile, syncTextFile } from "./github.js";
import { fontPresets, fontStackFor, safeFontStack } from "./fonts.js";
import { renderInlineFigure } from "./articleRenderer.js";
import { parseRequestBody, fieldArray, fieldValue } from "./request.js";
import {
  adsPage,
  articleFormPage,
  articlesAdminPage,
  dashboardPage,
  loginPage,
  navigationPage,
  pageFormPage,
  pagesAdminPage,
  settingsPage,
  submissionsPage
} from "./adminRender.js";
import {
  articlePage,
  categoryPage,
  contactPage,
  errorPage,
  homePage,
  listingPage,
  pageView,
  searchPage,
  submitNewsPage,
  tagPage
} from "./render.js";
import { robotsTxt, rssXml, sitemapXml } from "./seo.js";
import {
  cleanPath,
  ensureDir,
  escapeHtml,
  makeSession,
  parseCookies,
  redirect,
  safeJoin,
  sanitizeFileName,
  send,
  sendText,
  setCookie,
  slugify,
  normalizeTags,
  uniqueId,
  verifySession
} from "./utils.js";

ensureDir(paths.dataDir);
ensureDir(paths.submissionsDir);
ensureDir(paths.uploadsDir);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "HEAD") {
      res._headOnly = true;
      req.method = "GET";
    }
    const url = new URL(req.url || "/", config.siteUrl);
    let pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");

    if (pathname.length > 1 && pathname.endsWith("/")) {
      return redirect(res, `${pathname.replace(/\/+$/, "")}${url.search}`, 301);
    }

    if (req.method === "GET" && isStaticPath(pathname)) return serveStatic(res, pathname);
    if (req.method === "GET" && pathname === "/robots.txt") return sendText(res, 200, robotsTxt());
    if (req.method === "GET" && pathname === "/sitemap.xml") return sendText(res, 200, sitemapXml(), "application/xml; charset=utf-8");
    if (req.method === "GET" && (pathname === "/rss.xml" || pathname === "/feed.xml")) return sendText(res, 200, rssXml(), "application/rss+xml; charset=utf-8");

    if (pathname.startsWith("/admin")) return await adminRouter(req, res, url, pathname);
    return await publicRouter(req, res, url, pathname);
  } catch (error) {
    console.error(error);
    send(res, 500, errorPage(500, "Something went wrong", "The server hit an unexpected issue."));
  }
});

server.listen(config.port, () => {
  console.log(`Fabric-Pro running at http://localhost:${config.port}`);
});

function isStaticPath(pathname) {
  return pathname.startsWith("/assets/") || pathname.startsWith("/images/") || pathname.startsWith("/uploads/");
}

function serveStatic(res, pathname) {
  const filePath = safeJoin(paths.publicDir, pathname.replace(/^\//, ""));
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, errorPage(404));
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".ico": "image/x-icon"
  };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=2592000"
  });
  if (res._headOnly) return res.end();
  fs.createReadStream(filePath).pipe(res);
}

async function publicRouter(req, res, url, pathname) {
  if (req.method === "GET" && pathname === "/") {
    return send(res, 200, homePage({
      news: getArticlesByType("news"),
      blogs: getArticlesByType("blogs"),
      insights: getArticlesByType("insights")
    }));
  }

  if (req.method === "GET" && pathname === "/search") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const articles = query
      ? getArticles().filter((article) => [article.title, article.excerpt, article.category, article.tags.join(" ")].join(" ").toLowerCase().includes(query))
      : [];
    return send(res, 200, searchPage({ query, articles }));
  }

  for (const [type, meta] of Object.entries(contentTypes)) {
    if (req.method === "GET" && pathname === meta.path) {
      return send(res, 200, listingPage({ type, articles: getArticlesByType(type) }));
    }
    if (req.method === "GET" && pathname.startsWith(`${meta.path}/`)) {
      const slug = pathname.replace(`${meta.path}/`, "");
      const article = getArticle(type, slug);
      if (!article) return send(res, 404, errorPage(404));
      const related = getArticles()
        .filter((item) => item.url !== article.url && item.categorySlug === article.categorySlug)
        .slice(0, 6);
      const sidebarArticles = nearbyArticlesForSidebar(article, getArticlesByType(type), 6);
      return send(res, 200, articlePage({ article, related, sidebarArticles }));
    }
  }

  if (req.method === "GET" && pathname.startsWith("/category/")) {
    const slug = pathname.replace("/category/", "");
    const category = getCategories().find((item) => item.slug === slug);
    if (!category) return send(res, 404, errorPage(404));
    const articles = getArticles().filter((article) => article.categorySlug === slug);
    return send(res, 200, categoryPage({ category, articles }));
  }

  if (req.method === "GET" && pathname.startsWith("/tag/")) {
    const slug = pathname.replace("/tag/", "");
    const tag = getTags().find((item) => item.slug === slug);
    if (!tag) return send(res, 404, errorPage(404));
    const articles = getArticles().filter((article) => article.tagSlugs.includes(slug));
    return send(res, 200, tagPage({ tag, articles }));
  }

  if (pathname === "/submit-news") {
    if (req.method === "GET") return send(res, 200, submitNewsPage({ submitted: url.searchParams.get("submitted") === "1" }));
    if (req.method === "POST") return await handleSubmitNews(req, res);
  }

  if (pathname === "/contact") {
    if (req.method === "GET") return send(res, 200, contactPage({ submitted: url.searchParams.get("submitted") === "1" }));
    if (req.method === "POST") return await handleContact(req, res);
  }

  if (req.method === "GET") {
    const slug = pathname.replace(/^\//, "");
    if (slug && !slug.includes("/")) {
      const page = getPage(slug);
      if (page) return send(res, 200, pageView(page));
    }
  }

  return send(res, 404, errorPage(404));
}

async function adminRouter(req, res, url, pathname) {
  if (pathname === "/admin/login") {
    if (req.method === "GET") return send(res, 200, loginPage());
    if (req.method === "POST") return await handleLogin(req, res);
  }

  if (pathname === "/admin/logout") {
    setCookie(res, "fp_admin", "", { maxAge: 0 });
    return redirect(res, "/admin/login");
  }

  const admin = currentAdmin(req);
  if (!admin) return redirect(res, "/admin/login");

  if (req.method === "GET" && pathname === "/admin") {
    const articles = getArticles({ includeHidden: true });
    return send(res, 200, dashboardPage({
      stats: {
        news: articles.filter((article) => article.type === "news").length,
        blogs: articles.filter((article) => article.type === "blogs").length,
        insights: articles.filter((article) => article.type === "insights").length,
        submissions: readSubmissions().length
      }
    }));
  }

  if (req.method === "GET" && pathname === "/admin/articles") {
    const selectedType = url.searchParams.get("type") || "all";
    const articles = getArticles({ includeHidden: true }).filter((article) => selectedType === "all" || article.type === selectedType);
    return send(res, 200, articlesAdminPage({ articles, selectedType, notice: noticeFromUrl(url) }));
  }

  if (req.method === "GET" && pathname === "/admin/articles/new") {
    return send(res, 200, articleFormPage({ notice: noticeFromUrl(url) }));
  }

  {
    const match = pathname.match(/^\/admin\/articles\/(news|blogs|insights)\/([^/]+)\/edit$/);
    if (req.method === "GET" && match) {
      const article = getArticle(match[1], match[2], { includeHidden: true });
      if (!article) return send(res, 404, errorPage(404));
      return send(res, 200, articleFormPage({ article, notice: noticeFromUrl(url) }));
    }
  }

  if (req.method === "POST" && pathname === "/admin/articles/save") return await saveArticle(req, res);
  if (req.method === "POST" && pathname === "/admin/articles/import-docx") return await importDocxArticle(req, res);
  if (req.method === "POST" && pathname === "/admin/articles/upload-inline-image") return await uploadInlineArticleImage(req, res);
  if (req.method === "POST" && pathname === "/admin/articles/delete") return await deleteArticle(req, res);

  if (pathname === "/admin/settings") {
    if (req.method === "GET") return send(res, 200, settingsPage({ notice: noticeFromUrl(url) }));
    if (req.method === "POST") return await saveSettings(req, res);
  }

  if (pathname === "/admin/navigation") {
    if (req.method === "GET") return send(res, 200, navigationPage({ notice: noticeFromUrl(url) }));
    if (req.method === "POST") return await saveNavigation(req, res);
  }

  if (pathname === "/admin/ads") {
    if (req.method === "GET") return send(res, 200, adsPage({ notice: noticeFromUrl(url) }));
    if (req.method === "POST") return await saveAds(req, res);
  }

  if (req.method === "GET" && pathname === "/admin/pages") {
    return send(res, 200, pagesAdminPage({ pages: getPages({ includeHidden: true }), notice: noticeFromUrl(url) }));
  }

  if (req.method === "GET" && pathname === "/admin/pages/new") return send(res, 200, pageFormPage({ notice: noticeFromUrl(url) }));

  {
    const match = pathname.match(/^\/admin\/pages\/([^/]+)\/edit$/);
    if (req.method === "GET" && match) {
      const page = getPage(match[1], { includeHidden: true });
      if (!page) return send(res, 404, errorPage(404));
      return send(res, 200, pageFormPage({ page, notice: noticeFromUrl(url) }));
    }
  }

  if (req.method === "POST" && pathname === "/admin/pages/save") return await savePage(req, res);
  if (req.method === "POST" && pathname === "/admin/pages/delete") return await deletePage(req, res);

  if (req.method === "GET" && pathname === "/admin/submissions") {
    return send(res, 200, submissionsPage({ submissions: readSubmissions(), notice: noticeFromUrl(url) }));
  }
  if (req.method === "POST" && pathname === "/admin/submissions/delete") return await deleteSubmission(req, res);

  return send(res, 404, errorPage(404));
}

function currentAdmin(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const session = verifySession(cookies.fp_admin || "");
  if (!session || session.email.toLowerCase() !== config.adminEmail.toLowerCase()) return null;
  return session;
}

async function handleLogin(req, res) {
  const { fields } = await parseRequestBody(req);
  const email = fieldValue(fields, "email").trim().toLowerCase();
  const password = fieldValue(fields, "password");
  if (email !== config.adminEmail.toLowerCase() || password !== config.adminPassword) {
    return send(res, 401, loginPage({ error: "Invalid email or password." }));
  }
  setCookie(res, "fp_admin", makeSession(email), {
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production"
  });
  return redirect(res, "/admin");
}

function noticeFromUrl(url) {
  const saved = url.searchParams.get("saved");
  if (saved === "github") return "Saved locally and committed to GitHub.";
  if (saved === "local") return "Saved locally. Add GitHub environment variables to commit admin changes to GitHub automatically.";
  if (url.searchParams.get("deleted")) return "Deleted successfully.";
  return "";
}

function redirectAfterSave(res, path, result) {
  return redirect(res, `${path}?saved=${result.github ? "github" : "local"}`);
}

function offsetArticles(currentArticle, articles = [], limit = 6) {
  const pool = articles.filter((item) => item.url !== currentArticle.url);
  const currentIndex = articles.findIndex((item) => item.url === currentArticle.url);
  if (currentIndex <= 0) return pool.slice(0, limit);
  const before = articles.slice(0, currentIndex).reverse();
  const after = articles.slice(currentIndex + 1);
  return [...before, ...after].filter((item) => item.url !== currentArticle.url).slice(0, limit);
}

function nearbyArticlesForSidebar(article, sameTypeArticles = [], limit = 6) {
  const sameCategory = sameTypeArticles.filter((item) => item.categorySlug === article.categorySlug);
  const categoryMatches = offsetArticles(article, sameCategory, limit);
  if (categoryMatches.length >= limit) return categoryMatches;

  const seen = new Set(categoryMatches.map((item) => item.url));
  const sameTypeMatches = offsetArticles(article, sameTypeArticles, limit)
    .filter((item) => !seen.has(item.url));
  return [...categoryMatches, ...sameTypeMatches].slice(0, limit);
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  if (res._headOnly) return res.end();
  res.end(JSON.stringify(data));
}

function dateFromField(value) {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function saveTypographySettings(fields, defaults) {
  const keys = ["menu", "homeLeadTitle", "homeSectionTitle", "cardTitle", "articleTitle", "pageTitle"];
  const typography = {};
  for (const key of keys) {
    const fallback = defaults[key];
    const requestedFont = fieldValue(fields, `typeFont-${key}`);
    typography[key] = {
      font: requestedFont === "global" || fontPresets[requestedFont] && requestedFont !== "custom"
        ? requestedFont
        : fallback.font,
      size: boundedNumber(fieldValue(fields, `typeSize-${key}`), fallback.size, 12, 72),
      weight: boundedNumber(fieldValue(fields, `typeWeight-${key}`), fallback.weight, 300, 900)
    };
  }
  return typography;
}

function datedUploadFolder(style = "month-dash") {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return style === "year-month" ? `${year}/${month}` : `${year}-${month}`;
}

async function maybeSaveImage(file, slug, options = {}) {
  if (!file || !file.filename || !file.buffer?.length) return "";
  if (!file.contentType.startsWith("image/")) throw new Error("Uploaded file must be an image.");
  const folder = options.folder || datedUploadFolder(options.folderStyle);
  const fileName = sanitizeFileName(`${slug}${path.extname(file.filename) || ".png"}`);
  const relativePath = `${options.baseDir || "public/uploads"}/${folder}/${fileName}`;
  await syncBinaryFile(relativePath, file.buffer, `Upload ${fileName}`);
  return `/${relativePath.replace(/^public\//, "").replace(/\\/g, "/")}`;
}

function linesToArray(value = "") {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
}

function parseFaqRows(fields) {
  const rows = [];
  const count = Number(fieldValue(fields, "faqCount", 0));
  for (let index = 0; index < count; index += 1) {
    const question = fieldValue(fields, `faqQuestion-${index}`).trim();
    const answer = fieldValue(fields, `faqAnswer-${index}`).trim();
    if (question && answer) rows.push({ question, answer });
  }
  return rows;
}

function parseSourceRows(fields) {
  const rows = [];
  const count = Number(fieldValue(fields, "sourceCount", 0));
  for (let index = 0; index < count; index += 1) {
    const name = fieldValue(fields, `sourceName-${index}`).trim();
    const title = fieldValue(fields, `sourceTitle-${index}`).trim();
    const url = fieldValue(fields, `sourceUrl-${index}`).trim();
    if (name || title || url) rows.push({ name, title, url });
  }
  return rows;
}

function contentBodyForFormat(fields, contentFormat) {
  if (contentFormat === "html" || contentFormat === "docx_imported") {
    return fieldValue(fields, "contentHtml") || fieldValue(fields, "body");
  }
  return fieldValue(fields, "contentMarkdown") || fieldValue(fields, "body");
}

async function saveArticle(req, res) {
  const { fields, files } = await parseRequestBody(req);
  const type = contentTypes[fieldValue(fields, "type")] ? fieldValue(fields, "type") : "news";
  const slug = slugify(fieldValue(fields, "slug") || fieldValue(fields, "title"));
  const uploadedImage = await maybeSaveImage(files.imageFile, slug);
  const featuredImage = uploadedImage || fieldValue(fields, "featuredImage");
  const contentFormat = ["markdown", "html", "docx_imported"].includes(fieldValue(fields, "contentFormat"))
    ? fieldValue(fields, "contentFormat")
    : "markdown";
  const body = contentBodyForFormat(fields, contentFormat);
  const category = fieldValue(fields, "newCategory").trim() || fieldValue(fields, "category");
  const selectedTags = fieldArray(fields, "selectedTags");
  const newTags = normalizeTags(fieldValue(fields, "newTags"));
  const tags = [...new Map([...selectedTags, ...newTags]
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => [slugify(tag), tag])).values()];
  const data = {
    title: fieldValue(fields, "title"),
    meta_title: fieldValue(fields, "metaTitle") || fieldValue(fields, "title"),
    meta_description: fieldValue(fields, "metaDescription"),
    slug,
    article_type: fieldValue(fields, "articleType") || type,
    category,
    author_name: fieldValue(fields, "authorName") || "Fabric-Pro Editorial Desk",
    show_author: fieldValue(fields, "showAuthor") === "true",
    reviewer_name: fieldValue(fields, "reviewerName"),
    show_reviewer: fieldValue(fields, "showReviewer") === "true",
    published_date: dateFromField(fieldValue(fields, "publishedDate")),
    last_updated_date: dateFromField(fieldValue(fields, "updatedDate")),
    estimated_reading_time: fieldValue(fields, "estimatedReadingTime"),
    featured_image: featuredImage,
    featured_image_alt: fieldValue(fields, "altText") || fieldValue(fields, "title"),
    image_caption: fieldValue(fields, "imageCaption"),
    tags,
    primary_keyword: fieldValue(fields, "primaryKeyword"),
    secondary_keywords: normalizeTags(fieldValue(fields, "secondaryKeywords")),
    excerpt: fieldValue(fields, "excerpt"),
    content_format: contentFormat,
    key_takeaways: linesToArray(fieldValue(fields, "keyTakeaways")),
    sources: parseSourceRows(fields),
    faqs: parseFaqRows(fields),
    canonical_url: fieldValue(fields, "canonicalUrl") || `${contentTypes[type].path}/${slug}`,
    og_title: fieldValue(fields, "ogTitle"),
    og_description: fieldValue(fields, "ogDescription"),
    og_image: fieldValue(fields, "ogImage") || featuredImage,
    status: fieldValue(fields, "status") || "published"
  };
  const relativePath = `content/${type}/${slug}.md`;
  const result = await syncTextFile(relativePath, serializeFrontmatter(data, body), `Save ${type} article: ${data.title}`);

  const originalType = fieldValue(fields, "originalType");
  const originalSlug = fieldValue(fields, "originalSlug");
  if (originalType && originalSlug && (originalType !== type || originalSlug !== slug)) {
    await deleteSyncedFile(`content/${originalType}/${originalSlug}.md`, `Remove old article path: ${originalType}/${originalSlug}`);
  }
  return redirectAfterSave(res, `/admin/articles/${type}/${slug}/edit`, result);
}

async function importDocxArticle(req, res) {
  try {
    const { fields, files } = await parseRequestBody(req);
    const result = await importDocxToHtml(files.docxFile, {
      slug: fieldValue(fields, "slug") || fieldValue(fields, "title") || "article"
    });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message || "DOCX import failed." });
  }
}

async function uploadInlineArticleImage(req, res) {
  try {
    const { fields, files } = await parseRequestBody(req);
    const slug = slugify(fieldValue(fields, "slug") || fieldValue(fields, "title") || "inline-image");
    const src = await maybeSaveImage(files.inlineImage, slug, {
      baseDir: "public/uploads/articles",
      folderStyle: "year-month"
    });
    const alt = fieldValue(fields, "inlineImageAlt");
    const caption = fieldValue(fields, "inlineImageCaption");
    return sendJson(res, 200, {
      ok: true,
      src,
      figure: renderInlineFigure({ src, alt, caption })
    });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message || "Image upload failed." });
  }
}

async function deleteArticle(req, res) {
  const { fields } = await parseRequestBody(req);
  const type = fieldValue(fields, "type");
  const slug = fieldValue(fields, "slug");
  if (contentTypes[type] && slug) await deleteSyncedFile(`content/${type}/${slug}.md`, `Delete article: ${type}/${slug}`);
  return redirect(res, "/admin/articles?deleted=1");
}

async function saveSettings(req, res) {
  const { fields, files } = await parseRequestBody(req);
  const settings = loadSettings();
  const uploadedLogo = await maybeSaveImage(files.logoFile, "site-logo");
  const uploadedFavicon = await maybeSaveImage(files.faviconFile, "site-favicon");
  settings.siteName = fieldValue(fields, "siteName");
  settings.logoText = fieldValue(fields, "logoText");
  settings.logoImage = uploadedLogo || fieldValue(fields, "logoImage");
  settings.logoAlt = fieldValue(fields, "logoAlt") || settings.siteName;
  settings.favicon = uploadedFavicon || fieldValue(fields, "favicon");
  settings.tagline = fieldValue(fields, "tagline");
  settings.defaultMetaTitle = fieldValue(fields, "defaultMetaTitle");
  settings.defaultMetaDescription = fieldValue(fields, "defaultMetaDescription");
  settings.defaultSocialImage = fieldValue(fields, "defaultSocialImage");
  const fontPreset = fieldValue(fields, "fontPreset");
  settings.fontPreset = fontPresets[fontPreset] ? fontPreset : "gilroy";
  const customFontFamily = safeFontStack(fieldValue(fields, "customFontFamily"));
  settings.fontFamily = settings.fontPreset === "custom"
    ? customFontFamily || defaultSettings().fontFamily
    : fontStackFor(settings.fontPreset, customFontFamily);
  settings.typography = saveTypographySettings(fields, defaultSettings().typography);
  settings.homepageSections = [];
  const homeCount = Number(fieldValue(fields, "homeCount", 0));
  for (let index = 0; index < homeCount; index += 1) {
    const type = fieldValue(fields, `homeType-${index}`);
    if (!["news", "blogs", "insights"].includes(type)) continue;
    settings.homepageSections.push({
      type,
      title: fieldValue(fields, `homeTitle-${index}`) || type,
      limit: Number(fieldValue(fields, `homeLimit-${index}`, 6)),
      visible: fieldValue(fields, `homeVisible-${index}`) === "true"
    });
  }
  settings.categories = [];
  const categoryCount = Number(fieldValue(fields, "categoryCount", 0));
  for (let index = 0; index < categoryCount; index += 1) {
    const name = fieldValue(fields, `categoryName-${index}`).trim();
    if (!name) continue;
    settings.categories.push({
      name,
      slug: slugify(fieldValue(fields, `categorySlug-${index}`) || name),
      order: Number(fieldValue(fields, `categoryOrder-${index}`, index + 1)),
      visible: fieldValue(fields, `categoryVisible-${index}`) === "true",
      updatedDate: new Date().toISOString()
    });
  }
  settings.tags = [];
  const tagCount = Number(fieldValue(fields, "tagCount", 0));
  for (let index = 0; index < tagCount; index += 1) {
    const name = fieldValue(fields, `tagName-${index}`).trim();
    if (!name) continue;
    settings.tags.push({
      name,
      slug: slugify(fieldValue(fields, `tagSlug-${index}`) || name),
      order: Number(fieldValue(fields, `tagOrder-${index}`, index + 1)),
      visible: fieldValue(fields, `tagVisible-${index}`) === "true",
      updatedDate: new Date().toISOString()
    });
  }
  settings.googleSiteVerification = fieldValue(fields, "googleSiteVerification");
  settings.bingSiteVerification = fieldValue(fields, "bingSiteVerification");
  settings.gaMeasurementId = fieldValue(fields, "gaMeasurementId");
  settings.footer = settings.footer || {};
  settings.footer.text = fieldValue(fields, "footerText");
  settings.colors = settings.colors || {};
  for (const key of Object.keys(settings.colors)) {
    const value = fieldValue(fields, `color_${key}`);
    if (value) settings.colors[key] = value;
  }
  const organizationLogo = fieldValue(fields, "organizationLogo") || settings.logoImage;
  settings.organization = {
    name: fieldValue(fields, "organizationName") || settings.siteName,
    url: fieldValue(fields, "organizationUrl") || config.siteUrl,
    logo: organizationLogo,
    sameAs: normalizeTags(fieldValue(fields, "organizationSameAs"))
  };
  const result = await syncTextFile("data/site-settings.json", `${JSON.stringify(settings, null, 2)}\n`, "Update site settings");
  return redirectAfterSave(res, "/admin/settings", result);
}

function parseLinkRows(fields, prefix, count) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const label = fieldValue(fields, `${prefix}Label-${index}`).trim();
    const rawUrl = fieldValue(fields, `${prefix}Url-${index}`).trim() || "/";
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl.replace(/\/+$/, "") : cleanPath(rawUrl);
    if (!label) continue;
    rows.push({
      label,
      url,
      order: Number(fieldValue(fields, `${prefix}Order-${index}`, index + 1)),
      visible: fieldValue(fields, `${prefix}Visible-${index}`) === "true"
    });
  }
  return rows;
}

async function saveNavigation(req, res) {
  const { fields } = await parseRequestBody(req);
  const settings = loadSettings();
  settings.navigation = parseLinkRows(fields, "header", Number(fieldValue(fields, "headerCount", 0)));
  settings.footer = settings.footer || {};
  settings.footer.links = parseLinkRows(fields, "footer", Number(fieldValue(fields, "footerCount", 0)));
  const result = await syncTextFile("data/site-settings.json", `${JSON.stringify(settings, null, 2)}\n`, "Update navigation");
  return redirectAfterSave(res, "/admin/navigation", result);
}

async function saveAds(req, res) {
  const { fields } = await parseRequestBody(req);
  const settings = loadSettings();
  const widgets = [];
  const count = Number(fieldValue(fields, "adCount", 0));
  for (let index = 0; index < count; index += 1) {
    const name = fieldValue(fields, `adName-${index}`).trim();
    const html = fieldValue(fields, `adHtml-${index}`).trim();
    if (!name && !html) continue;
    widgets.push({
      id: fieldValue(fields, `adId-${index}`) || uniqueId("ad"),
      name: name || "Ad widget",
      position: fieldValue(fields, `adPosition-${index}`, "sidebar"),
      visible: fieldValue(fields, `adVisible-${index}`) === "true",
      html
    });
  }
  settings.adWidgets = widgets;
  const result = await syncTextFile("data/site-settings.json", `${JSON.stringify(settings, null, 2)}\n`, "Update ad widgets");
  return redirectAfterSave(res, "/admin/ads", result);
}

async function savePage(req, res) {
  const { fields, files } = await parseRequestBody(req);
  const slug = slugify(fieldValue(fields, "slug") || fieldValue(fields, "title"));
  const uploadedImage = await maybeSaveImage(files.imageFile, slug);
  const featuredImage = uploadedImage || fieldValue(fields, "featuredImage");
  const title = fieldValue(fields, "title");
  const data = {
    title,
    metaTitle: fieldValue(fields, "metaTitle") || title,
    metaDescription: fieldValue(fields, "metaDescription"),
    slug,
    status: fieldValue(fields, "status") || "published",
    updatedDate: dateFromField(fieldValue(fields, "updatedDate")),
    featuredImage,
    altText: fieldValue(fields, "altText") || title,
    excerpt: fieldValue(fields, "excerpt"),
    canonicalUrl: fieldValue(fields, "canonicalUrl") || `/${slug}`
  };
  const result = await syncTextFile(`content/pages/${slug}.md`, serializeFrontmatter(data, fieldValue(fields, "body")), `Save page: ${title}`);
  const originalSlug = fieldValue(fields, "originalSlug");
  if (originalSlug && originalSlug !== slug) await deleteSyncedFile(`content/pages/${originalSlug}.md`, `Remove old page path: ${originalSlug}`);
  return redirectAfterSave(res, `/admin/pages/${slug}/edit`, result);
}

async function deletePage(req, res) {
  const { fields } = await parseRequestBody(req);
  const slug = slugify(fieldValue(fields, "slug"));
  if (slug) await deleteSyncedFile(`content/pages/${slug}.md`, `Delete page: ${slug}`);
  return redirect(res, "/admin/pages?deleted=1");
}

function readSubmissions() {
  ensureDir(paths.submissionsDir);
  return fs.readdirSync(paths.submissionsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(paths.submissionsDir, file), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function saveSubmission(data) {
  ensureDir(paths.submissionsDir);
  const id = uniqueId("submission");
  const submission = { id, createdAt: new Date().toISOString(), ...data };
  fs.writeFileSync(path.join(paths.submissionsDir, `${id}.json`), `${JSON.stringify(submission, null, 2)}\n`, "utf8");
}

async function handleSubmitNews(req, res) {
  const { fields } = await parseRequestBody(req);
  saveSubmission({
    type: "submit_news",
    name: fieldValue(fields, "name"),
    company: fieldValue(fields, "company"),
    email: fieldValue(fields, "email"),
    title: fieldValue(fields, "title"),
    sourceLink: fieldValue(fields, "sourceLink"),
    imageLink: fieldValue(fields, "imageLink"),
    summary: fieldValue(fields, "summary"),
    consent: fieldValue(fields, "consent") === "yes"
  });
  return redirect(res, "/submit-news?submitted=1");
}

async function handleContact(req, res) {
  const { fields } = await parseRequestBody(req);
  saveSubmission({
    type: "contact",
    name: fieldValue(fields, "name"),
    company: fieldValue(fields, "company"),
    email: fieldValue(fields, "email"),
    message: fieldValue(fields, "message")
  });
  return redirect(res, "/contact?submitted=1");
}

async function deleteSubmission(req, res) {
  const { fields } = await parseRequestBody(req);
  const id = fieldValue(fields, "id");
  const filePath = safeJoin(paths.submissionsDir, `${id}.json`);
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return redirect(res, "/admin/submissions?deleted=1");
}
