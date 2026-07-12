import { config, contentTypes } from "./config.js";
import { defaultSettings, formDateValue, getCategories, getPages, getTags, loadSettings } from "./content.js";
import { fontHeadTags, fontOptions } from "./fonts.js";
import { escapeAttr, escapeHtml, formatDate } from "./utils.js";

function active(path, href) {
  return path === href || (href !== "/admin" && path.startsWith(href)) ? "active" : "";
}

function adminFaviconTag() {
  const settings = loadSettings();
  if (!settings.favicon) return "";
  const lower = settings.favicon.toLowerCase();
  const type = lower.endsWith(".ico") ? "image/x-icon" : lower.endsWith(".svg") ? "image/svg+xml" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return `<link rel="icon" href="${escapeAttr(settings.favicon)}" type="${escapeAttr(type)}">`;
}

export function adminLayout({ title = "Admin", path = "/admin", body = "", notice = "" }) {
  const nav = [
    ["Dashboard", "/admin"],
    ["Articles", "/admin/articles"],
    ["Pages", "/admin/pages"],
    ["Navigation", "/admin/navigation"],
    ["Settings", "/admin/settings"],
    ["Ads", "/admin/ads"],
    ["Submissions", "/admin/submissions"]
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} | Fabric-Pro Admin</title>
  ${adminFaviconTag()}
  ${fontHeadTags(loadSettings())}
  <link rel="stylesheet" href="/assets/styles.css?v=${escapeAttr(config.assetVersion)}">
  <script src="/assets/admin.js?v=${escapeAttr(config.assetVersion)}" defer></script>
</head>
<body class="admin-body">
  <a class="skip-link" href="#admin-main">Skip to admin content</a>
  <header class="admin-header">
    <div class="container admin-topbar">
      <a class="brand" href="/admin">Fabric-Pro Admin</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="admin-nav" data-nav-toggle>Menu</button>
      <nav class="admin-nav" id="admin-nav" data-nav-menu aria-label="Admin navigation">
        ${nav.map(([label, href]) => `<a class="${active(path, href)}" href="${href}">${escapeHtml(label)}</a>`).join("")}
      </nav>
      <a class="admin-logout" href="/admin/logout">Log out</a>
    </div>
  </header>
  <main id="admin-main" class="container admin-main">
    ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
    ${body}
  </main>
</body>
</html>`;
}

export function loginPage({ error = "" } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Admin Login | Fabric-Pro</title>
  ${adminFaviconTag()}
  ${fontHeadTags(loadSettings())}
  <link rel="stylesheet" href="/assets/styles.css?v=${escapeAttr(config.assetVersion)}">
</head>
<body class="admin-body login-screen">
  <main class="login-card">
    <a class="brand" href="/">Fabric-Pro</a>
    <h1>Admin Login</h1>
    <p>Manage Markdown articles, site settings, SEO, navigation, ad widgets, and submissions.</p>
    ${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}
    <form method="post" action="/admin/login" class="form-stack">
      <label>Email <input name="email" type="email" required autocomplete="username"></label>
      <label>Password <input name="password" type="password" required autocomplete="current-password"></label>
      <button class="button" type="submit">Log in</button>
    </form>
  </main>
</body>
</html>`;
}

export function dashboardPage({ stats }) {
  return adminLayout({
    title: "Dashboard",
    path: "/admin",
    body: `
      <div class="admin-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Publish through Markdown files and optional GitHub commits.</p>
        </div>
        <a class="button" href="/admin/articles/new">New Article</a>
      </div>
      <div class="stat-grid">
        <div><strong>${stats.news}</strong><span>News</span></div>
        <div><strong>${stats.blogs}</strong><span>Blogs</span></div>
        <div><strong>${stats.insights}</strong><span>Insights</span></div>
        <div><strong>${stats.submissions}</strong><span>Submissions</span></div>
      </div>
      <section class="admin-card">
        <h2>Publishing workflow</h2>
        <p>Articles live in <code>/content/news</code>, <code>/content/blogs</code>, and <code>/content/insights</code>. When GitHub sync is configured, saving in admin commits the Markdown and image files to GitHub so your connected host can rebuild.</p>
      </section>
    `
  });
}

function typeTabs(selectedType) {
  const tabs = [["all", "All"], ...Object.entries(contentTypes).map(([key, meta]) => [key, meta.plural])];
  return `<div class="admin-tabs">${tabs.map(([key, label]) => `<a class="${selectedType === key ? "active" : ""}" href="/admin/articles${key === "all" ? "" : `?type=${key}`}">${escapeHtml(label)}</a>`).join("")}</div>`;
}

export function articlesAdminPage({ articles, selectedType = "all", notice = "" }) {
  return adminLayout({
    title: "Articles",
    path: "/admin/articles",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Articles</h1>
          <p>Create and edit Markdown content. Latest published dates appear first on the public site.</p>
        </div>
        <a class="button" href="/admin/articles/new">New Article</a>
      </div>
      ${typeTabs(selectedType)}
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Type</th><th>Category</th><th>Status</th><th>Published</th><th></th></tr></thead>
          <tbody>
            ${articles.map((article) => `<tr>
              <td><strong>${escapeHtml(article.title)}</strong><br><small>${escapeHtml(article.relativePath)}</small></td>
              <td>${escapeHtml(contentTypes[article.type].plural)}</td>
              <td>${escapeHtml(article.category)}</td>
              <td>${escapeHtml(article.status)}</td>
              <td>${escapeHtml(formatDate(article.publishedDate))}</td>
              <td class="table-actions">
                <a href="/admin/articles/${article.type}/${article.slug}/edit">Edit</a>
                <form method="post" action="/admin/articles/delete" data-confirm="Delete this article file?">
                  <input type="hidden" name="type" value="${escapeAttr(article.type)}">
                  <input type="hidden" name="slug" value="${escapeAttr(article.slug)}">
                  <button type="submit">Delete</button>
                </form>
              </td>
            </tr>`).join("") || `<tr><td colspan="6">No articles yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `
  });
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function fontSelect(name, selected, options = {}) {
  return `<select name="${escapeAttr(name)}">${fontOptions(options).map((font) => option(font.key, font.label, selected)).join("")}</select>`;
}

function categorySelect(currentCategory = "") {
  const categories = getCategories({ includeHidden: true });
  const foundCurrent = categories.some((category) => category.name === currentCategory);
  const options = [
    `<option value="">Select category</option>`,
    ...categories.map((category) => option(category.name, `${category.name}${category.count ? ` (${category.count})` : ""}`, currentCategory)),
    currentCategory && !foundCurrent ? option(currentCategory, currentCategory, currentCategory) : ""
  ].join("");
  return `<select name="category" required>${options}</select>`;
}

function tagChecklist(currentTags = []) {
  const tags = getTags({ includeHidden: true });
  const selected = new Set(currentTags.map((tag) => String(tag).trim().toLowerCase()));
  return `<fieldset class="tag-picker">
    <legend>Tags</legend>
    <p class="admin-help">Select existing tags. Add new comma-separated tags below when needed.</p>
    <div class="tag-picker-grid">
      ${tags.map((tag) => `<label class="tag-option"><input name="selectedTags" type="checkbox" value="${escapeAttr(tag.name)}" ${selected.has(tag.name.toLowerCase()) ? "checked" : ""}> ${escapeHtml(tag.name)}${tag.count ? ` (${tag.count})` : ""}</label>`).join("") || `<span class="admin-help">No saved tags yet.</span>`}
    </div>
    <label>New tags <input name="newTags" placeholder="textile machinery, weaving, exports"></label>
  </fieldset>`;
}

function checked(value) {
  return value ? "checked" : "";
}

function contentFormatSelect(selected = "markdown") {
  const formats = [
    ["markdown", "Markdown"],
    ["html", "Rich HTML"],
    ["docx_imported", "DOCX imported HTML"]
  ];
  return `<select name="contentFormat" data-content-format>${formats.map(([value, label]) => option(value, label, selected)).join("")}</select>`;
}

function keyTakeawayText(article) {
  const takeaways = article?.keyTakeaways;
  return Array.isArray(takeaways) ? takeaways.join("\n") : String(takeaways || "");
}

function faqRows(faqs = []) {
  const rows = [...faqs, {}, {}, {}];
  return `<fieldset class="admin-fieldset">
    <legend>FAQs</legend>
    <p class="admin-help">Optional. Add questions and answers only when you want an FAQ section and FAQ schema.</p>
    <input type="hidden" name="faqCount" value="${rows.length}">
    <div class="structured-list">
      ${rows.map((item, index) => `<div class="structured-row">
        <label>Question <input name="faqQuestion-${index}" value="${escapeAttr(item.question || "")}"></label>
        <label>Answer <textarea name="faqAnswer-${index}" rows="2">${escapeHtml(item.answer || "")}</textarea></label>
      </div>`).join("")}
    </div>
  </fieldset>`;
}

function sourceRows(sources = []) {
  const rows = [...sources, {}, {}, {}];
  return `<fieldset class="admin-fieldset">
    <legend>Sources</legend>
    <p class="admin-help">Optional. Add a source name, source title, and URL for citation links near the bottom of the article.</p>
    <input type="hidden" name="sourceCount" value="${rows.length}">
    <div class="structured-list">
      ${rows.map((item, index) => `<div class="structured-row source-row">
        <label>Source name <input name="sourceName-${index}" value="${escapeAttr(item.name || "")}" placeholder="Company, report, publication"></label>
        <label>Title <input name="sourceTitle-${index}" value="${escapeAttr(item.title || "")}" placeholder="Source title"></label>
        <label>URL <input name="sourceUrl-${index}" type="url" value="${escapeAttr(item.url || "")}" placeholder="https://"></label>
      </div>`).join("")}
    </div>
  </fieldset>`;
}

export function articleFormPage({ article = null, notice = "" }) {
  const isEdit = Boolean(article);
  const type = article?.type || "news";
  const title = isEdit ? "Edit Article" : "New Article";
  const contentFormat = article?.contentFormat || "markdown";
  const markdownBody = article?.contentMarkdown || (contentFormat === "markdown" ? article?.bodyMarkdown : "") || articleTemplate(type);
  const htmlBody = article?.contentHtml || (contentFormat === "html" || contentFormat === "docx_imported" ? article?.bodyMarkdown : "") || "";
  const showAuthor = article ? article.showAuthor !== false : true;
  const showReviewer = article ? article.showReviewer === true : false;
  return adminLayout({
    title,
    path: "/admin/articles",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>${title}</h1>
          <p>Use Markdown, paste clean HTML, or import a DOCX file. Article content is rendered as crawlable HTML.</p>
        </div>
        <a class="button secondary" href="/admin/articles">Back to Articles</a>
      </div>
      <form method="post" action="/admin/articles/save" enctype="multipart/form-data" class="admin-form article-editor-form">
        <input type="hidden" name="originalType" value="${escapeAttr(article?.type || "")}">
        <input type="hidden" name="originalSlug" value="${escapeAttr(article?.slug || "")}">
        <div class="form-grid">
          <label>Type
            <select name="type">${Object.entries(contentTypes).map(([key, meta]) => option(key, meta.plural, type)).join("")}</select>
          </label>
          <label>Status
            <select name="status">${["published", "draft", "hidden"].map((item) => option(item, item, article?.status || "published")).join("")}</select>
          </label>
          <label>Title <input name="title" required value="${escapeAttr(article?.title || "")}"></label>
          <label>Slug <input name="slug" required value="${escapeAttr(article?.slug || "")}" placeholder="article-slug"></label>
          <label>Article type <input name="articleType" value="${escapeAttr(article?.articleType || type)}" placeholder="News, Blog, Insight, Analysis"></label>
          <label>Category ${categorySelect(article?.category || "")}</label>
          <label>New category <input name="newCategory" value="" placeholder="Only fill this to create/use a new category"></label>
          <label>Author name <input name="authorName" value="${escapeAttr(article?.authorName || article?.author || "Fabric-Pro Editorial Desk")}"></label>
          <label class="check-label"><input name="showAuthor" type="checkbox" value="true" ${checked(showAuthor)}> Show author on article page</label>
          <label>Reviewed by name <input name="reviewerName" value="${escapeAttr(article?.reviewerName || article?.reviewedBy || "")}"></label>
          <label class="check-label"><input name="showReviewer" type="checkbox" value="true" ${checked(showReviewer)}> Show reviewed by on article page</label>
          <label>Published date <input name="publishedDate" type="date" value="${escapeAttr(formDateValue(article?.publishedDate))}"></label>
          <label>Updated date <input name="updatedDate" type="date" value="${escapeAttr(formDateValue(article?.updatedDate))}"></label>
          <label>Estimated reading time <input name="estimatedReadingTime" type="number" min="1" value="${escapeAttr(article?.estimatedReadingTime || "")}" placeholder="Auto if blank"></label>
        </div>
        ${tagChecklist(article?.tags || [])}
        <div class="form-grid two">
          <label>SEO title <input name="metaTitle" required value="${escapeAttr(article?.metaTitle || "")}"></label>
          <label>Canonical URL <input name="canonicalUrl" value="${escapeAttr(article?.canonicalUrl || "")}" placeholder="/news/article-slug"></label>
        </div>
        <label>Meta description <textarea name="metaDescription" rows="3" required>${escapeHtml(article?.metaDescription || "")}</textarea></label>
        <div class="form-grid two">
          <label>Primary keyword <input name="primaryKeyword" value="${escapeAttr(article?.primaryKeyword || "")}"></label>
          <label>Secondary keywords <input name="secondaryKeywords" value="${escapeAttr((article?.secondaryKeywords || []).join(", "))}" placeholder="keyword one, keyword two"></label>
        </div>
        <label>Excerpt <textarea name="excerpt" rows="3" required>${escapeHtml(article?.excerpt || "")}</textarea></label>
        <div class="form-grid two">
          <label>Featured image path <input name="featuredImage" value="${escapeAttr(article?.featuredImage || "")}" placeholder="/uploads/image.webp"></label>
          <label>Upload featured image <input name="imageFile" type="file" accept="image/*"></label>
        </div>
        <label>Image alt text <input name="altText" value="${escapeAttr(article?.altText || "")}"></label>
        <label>Image caption <input name="imageCaption" value="${escapeAttr(article?.imageCaption || "")}" placeholder="Optional visible caption below the article image"></label>
        <div class="form-grid two">
          <label>Open Graph title <input name="ogTitle" value="${escapeAttr(article?.ogTitle || "")}" placeholder="Optional social sharing title"></label>
          <label>Open Graph image <input name="ogImage" value="${escapeAttr(article?.ogImage || "")}" placeholder="Defaults to featured image"></label>
        </div>
        <label>Open Graph description <textarea name="ogDescription" rows="2">${escapeHtml(article?.ogDescription || "")}</textarea></label>

        <section class="admin-card editor-tools">
          <h2>Article content</h2>
          <div class="form-grid two">
            <label>Content format ${contentFormatSelect(contentFormat)}</label>
            <label>Import DOCX file <input name="docxFile" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-docx-file></label>
          </div>
          <div class="button-row">
            <button class="button secondary" type="button" data-docx-import>Import DOCX to editable HTML</button>
            <span class="admin-help" data-docx-status></span>
          </div>
          <div class="editor-help">
            <strong>DOCX formatting guide:</strong> For best results, use Word styles: Title for document title, Heading 2 for main sections, Heading 3 for sub-sections, bullet lists for Key Takeaways, Word tables for tables, and normal inserted images. Avoid manually changing font size instead of using heading styles.
          </div>
          <div class="docx-preview" data-docx-preview hidden></div>

          <fieldset class="admin-fieldset inline-image-tool">
            <legend>Insert inline image</legend>
            <div class="form-grid three">
              <label>Upload image <input name="inlineImage" type="file" accept="image/*" data-inline-image></label>
              <label>Image alt text <input name="inlineImageAlt" data-inline-alt></label>
              <label>Caption <input name="inlineImageCaption" data-inline-caption placeholder="Optional"></label>
            </div>
            <button class="button secondary" type="button" data-inline-insert>Insert image into article body</button>
            <span class="admin-help" data-inline-status></span>
          </fieldset>

          <label data-format-panel="markdown">Markdown body
            <textarea name="contentMarkdown" rows="24" class="markdown-editor" data-content-editor="markdown">${escapeHtml(markdownBody)}</textarea>
          </label>
          <label data-format-panel="html">HTML body
            <textarea name="contentHtml" rows="24" class="markdown-editor code-editor" data-content-editor="html">${escapeHtml(htmlBody)}</textarea>
          </label>
        </section>
        <div class="editor-help">
          <strong>Markdown tips:</strong> Use <code>## Heading</code>, <code>**bold**</code>, bullet lists, links like <code>[label](https://example.com)</code>, and Markdown tables. If you include the article title again as the first heading, the site will remove the duplicate automatically.
        </div>
        <label>Key Takeaways
          <textarea name="keyTakeaways" rows="5" placeholder="One takeaway per line">${escapeHtml(keyTakeawayText(article))}</textarea>
        </label>
        ${faqRows(article?.faqs || [])}
        ${sourceRows(article?.sources || [])}
        <button class="button" type="submit">Save Article</button>
      </form>
    `
  });
}

function articleTemplate(type) {
  if (type === "blogs") {
    return `## Key takeaways\n\n- Add takeaway one.\n- Add takeaway two.\n- Add takeaway three.\n\n## Practical explanation\n\nWrite the article in clear, useful language for textile and fabric industry readers.\n\n## What companies should watch\n\nAdd practical advice, examples, and source links.\n`;
  }
  if (type === "insights") {
    return `## Executive summary\n\nSummarize the market signal, trend, or strategic issue.\n\n## Market context\n\nExplain the background and what changed.\n\n## Strategic takeaway\n\nClose with what manufacturers, suppliers, brands, or buyers should do next.\n`;
  }
  return `## What happened\n\nDescribe the company announcement or industry news clearly.\n\n## Why it matters\n\nExplain the impact on textile manufacturers, suppliers, brands, sourcing teams, or investors.\n\n## Source details\n\nAdd verified details, location, company background, and links where relevant.\n`;
}

export function settingsPage({ notice = "" } = {}) {
  const settings = loadSettings();
  const defaults = defaultSettings();
  const colors = { ...defaults.colors, ...(settings.colors || {}) };
  const org = settings.organization || {};
  const categories = [...(settings.categories || []), {}, {}, {}];
  const tags = [...(settings.tags || []), {}, {}, {}, {}];
  const typography = settings.typography || defaults.typography || {};
  const typographyRows = [
    { key: "menu", label: "Header menu text" },
    { key: "homeLeadTitle", label: "Homepage featured title" },
    { key: "homeSectionTitle", label: "Homepage section titles" },
    { key: "cardTitle", label: "Article card titles" },
    { key: "articleTitle", label: "Article page headline" },
    { key: "pageTitle", label: "Standard page headline" }
  ];
  const fontPreset = settings.fontPreset || "gilroy";
  const customFontFamily = fontPreset === "custom" ? settings.fontFamily || "" : "";
  const weightOptions = [300, 400, 500, 600, 650, 700, 750, 800, 900];
  return adminLayout({
    title: "Settings",
    path: "/admin/settings",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Settings</h1>
          <p>Control global font, colors, default SEO, verification tags, GA4, organization schema, and footer text.</p>
        </div>
      </div>
      <form method="post" action="/admin/settings" enctype="multipart/form-data" class="admin-form">
        <h2>Brand and SEO</h2>
        <div class="form-grid two">
          <label>Site name <input name="siteName" value="${escapeAttr(settings.siteName)}"></label>
          <label>Logo text <input name="logoText" value="${escapeAttr(settings.logoText)}"></label>
        </div>
        <div class="form-grid two">
          <label>Logo image path <input name="logoImage" value="${escapeAttr(settings.logoImage || "")}" placeholder="/uploads/logo.png"></label>
          <label>Upload logo <input name="logoFile" type="file" accept="image/*"></label>
          <label>Logo alt text <input name="logoAlt" value="${escapeAttr(settings.logoAlt || settings.siteName)}"></label>
          <label>Favicon path <input name="favicon" value="${escapeAttr(settings.favicon || "")}" placeholder="/uploads/favicon.png"></label>
          <label>Upload favicon <input name="faviconFile" type="file" accept="image/*,.ico"></label>
        </div>
        <label>Tagline <textarea name="tagline" rows="2">${escapeHtml(settings.tagline)}</textarea></label>
        <label>Default SEO title <input name="defaultMetaTitle" value="${escapeAttr(settings.defaultMetaTitle)}"></label>
        <label>Default meta description <textarea name="defaultMetaDescription" rows="3">${escapeHtml(settings.defaultMetaDescription)}</textarea></label>
        <label>Default social image <input name="defaultSocialImage" value="${escapeAttr(settings.defaultSocialImage || "")}" placeholder="/images/textile-machinery-news.jpg"></label>
        <div class="form-grid two">
          <label>Global font family ${fontSelect("fontPreset", fontPreset, { includeCustom: true })}</label>
          <label>Custom global font stack <input name="customFontFamily" value="${escapeAttr(customFontFamily)}" placeholder="Only used when Custom font stack is selected"></label>
        </div>

        <h2>Desktop typography</h2>
        <p class="admin-help">Each row controls the desktop site only, so the current mobile typography stays unchanged. Roboto families load only when selected; Segoe families use the visitor's installed font with a fallback.</p>
        <div class="admin-table-wrap">
          <table class="admin-table typography-table">
            <thead><tr><th>Text area</th><th>Font family</th><th>Size (px)</th><th>Weight</th></tr></thead>
            <tbody>
              ${typographyRows.map((row) => {
                const item = typography[row.key] || {};
                return `<tr>
                  <td><strong>${escapeHtml(row.label)}</strong></td>
                  <td>${fontSelect(`typeFont-${row.key}`, item.font || "global", { includeGlobal: true, includeCustom: false })}</td>
                  <td><input name="typeSize-${row.key}" type="number" min="12" max="72" value="${escapeAttr(item.size || "")}"></td>
                  <td><select name="typeWeight-${row.key}">${weightOptions.map((weight) => option(String(weight), String(weight), String(item.weight || "") )).join("")}</select></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>

        <h2>Homepage sections</h2>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Section</th><th>Title</th><th>Article limit</th><th>Visible</th></tr></thead>
            <tbody>
              ${["news", "blogs", "insights"].map((type, index) => {
                const section = (settings.homepageSections || []).find((item) => item.type === type) || {};
                return `<tr>
                  <td><strong>${escapeHtml(type)}</strong><input type="hidden" name="homeType-${index}" value="${escapeAttr(type)}"></td>
                  <td><input name="homeTitle-${index}" value="${escapeAttr(section.title || type)}"></td>
                  <td><input name="homeLimit-${index}" type="number" min="1" max="30" value="${escapeAttr(section.limit || 6)}"></td>
                  <td><label class="inline-check"><input name="homeVisible-${index}" type="checkbox" value="true" ${section.visible === false ? "" : "checked"}> Show</label></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <input type="hidden" name="homeCount" value="3">

        <h2>Categories</h2>
        <p class="admin-help">These categories appear in the article editor dropdown and power category pages and related articles. Empty rows are ignored.</p>
        <input type="hidden" name="categoryCount" value="${categories.length}">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Order</th><th>Visible</th></tr></thead>
            <tbody>
              ${categories.map((category, index) => `<tr>
                <td><input name="categoryName-${index}" value="${escapeAttr(category.name || "")}" placeholder="Textile Machinery"></td>
                <td><input name="categorySlug-${index}" value="${escapeAttr(category.slug || "")}" placeholder="textile-machinery"></td>
                <td><input name="categoryOrder-${index}" type="number" value="${escapeAttr(category.order ?? index + 1)}"></td>
                <td><label class="inline-check"><input name="categoryVisible-${index}" type="checkbox" value="true" ${category.visible === false ? "" : "checked"}> Show</label></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <h2>Tags</h2>
        <p class="admin-help">Add and manage reusable tags. They appear in the article editor and each used tag gets its own public article page.</p>
        <input type="hidden" name="tagCount" value="${tags.length}">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Order</th><th>Visible</th></tr></thead>
            <tbody>
              ${tags.map((tag, index) => `<tr>
                <td><input name="tagName-${index}" value="${escapeAttr(tag.name || "")}" placeholder="Textile machinery"></td>
                <td><input name="tagSlug-${index}" value="${escapeAttr(tag.slug || "")}" placeholder="textile-machinery"></td>
                <td><input name="tagOrder-${index}" type="number" value="${escapeAttr(tag.order ?? index + 1)}"></td>
                <td><label class="inline-check"><input name="tagVisible-${index}" type="checkbox" value="true" ${tag.visible === false ? "" : "checked"}> Show</label></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <h2>Colors</h2>
        <div class="color-grid">
          ${Object.entries(colors).map(([key, value]) => `<label>${escapeHtml(key)} <input name="color_${escapeAttr(key)}" type="color" value="${escapeAttr(value)}"></label>`).join("")}
        </div>

        <h2>Search and analytics</h2>
        <div class="form-grid two">
          <label>Google Search Console code <input name="googleSiteVerification" value="${escapeAttr(settings.googleSiteVerification || "")}"></label>
          <label>Bing verification code <input name="bingSiteVerification" value="${escapeAttr(settings.bingSiteVerification || "")}"></label>
          <label>GA4 Measurement ID <input name="gaMeasurementId" value="${escapeAttr(settings.gaMeasurementId || "")}" placeholder="G-XXXXXXXXXX"></label>
          <label>Organization URL <input name="organizationUrl" value="${escapeAttr(org.url || "")}" placeholder="https://fabric-pro.com"></label>
        </div>
        <div class="form-grid two">
          <label>Organization name <input name="organizationName" value="${escapeAttr(org.name || settings.siteName)}"></label>
          <label>Organization logo URL <input name="organizationLogo" value="${escapeAttr(org.logo || "")}" placeholder="/images/logo.png"></label>
        </div>
        <label>Organization social links <input name="organizationSameAs" value="${escapeAttr(Array.isArray(org.sameAs) ? org.sameAs.join(", ") : "")}" placeholder="https://linkedin.com/company/example, https://x.com/example"></label>

        <h2>Footer</h2>
        <label>Footer text <textarea name="footerText" rows="3">${escapeHtml(settings.footer?.text || "")}</textarea></label>
        <button class="button" type="submit">Save Settings</button>
      </form>
    `
  });
}

function rowInput(prefix, index, field, value = "", type = "text") {
  return `<input name="${prefix}${field}-${index}" type="${type}" value="${escapeAttr(value)}">`;
}

export function navigationPage({ notice = "" } = {}) {
  const settings = loadSettings();
  const header = [...(settings.navigation || []), {}, {}];
  const footer = [...(settings.footer?.links || []), {}, {}];
  const rows = (items, prefix) => items.map((item, index) => `<tr>
    <td>${rowInput(prefix, index, "Label", item.label || "")}</td>
    <td>${rowInput(prefix, index, "Url", item.url || "")}</td>
    <td>${rowInput(prefix, index, "Order", item.order ?? index + 1, "number")}</td>
    <td><label class="inline-check"><input name="${prefix}Visible-${index}" type="checkbox" value="true" ${item.visible === false ? "" : "checked"}> Show</label></td>
  </tr>`).join("");
  return adminLayout({
    title: "Navigation",
    path: "/admin/navigation",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Navigation</h1>
          <p>Add, remove, hide, and reorder header and footer links. Empty rows are ignored.</p>
        </div>
      </div>
      <form method="post" action="/admin/navigation" class="admin-form">
        <input type="hidden" name="headerCount" value="${header.length}">
        <input type="hidden" name="footerCount" value="${footer.length}">
        <h2>Header links</h2>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Label</th><th>URL</th><th>Order</th><th>Visible</th></tr></thead><tbody>${rows(header, "header")}</tbody></table></div>
        <h2>Footer links</h2>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Label</th><th>URL</th><th>Order</th><th>Visible</th></tr></thead><tbody>${rows(footer, "footer")}</tbody></table></div>
        <button class="button" type="submit">Save Navigation</button>
      </form>
    `
  });
}

export function adsPage({ notice = "" } = {}) {
  const settings = loadSettings();
  const positions = ["home-top", "sidebar", "listing-top", "article-top", "article-bottom", "article-sidebar"];
  const widgets = [...(settings.adWidgets || []), {}, {}];
  return adminLayout({
    title: "Ad Widgets",
    path: "/admin/ads",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Ad Widgets</h1>
          <p>Add or remove lightweight ad blocks. Paste ad network HTML only from providers you trust.</p>
        </div>
      </div>
      <form method="post" action="/admin/ads" class="admin-form">
        <input type="hidden" name="adCount" value="${widgets.length}">
        ${widgets.map((widget, index) => `<section class="admin-card">
          <div class="form-grid two">
            <input type="hidden" name="adId-${index}" value="${escapeAttr(widget.id || "")}">
            <label>Name <input name="adName-${index}" value="${escapeAttr(widget.name || "")}"></label>
            <label>Position <select name="adPosition-${index}">${positions.map((position) => option(position, position, widget.position || "sidebar")).join("")}</select></label>
          </div>
          <label class="inline-check"><input name="adVisible-${index}" type="checkbox" value="true" ${widget.visible === false ? "" : "checked"}> Visible</label>
          <label>Ad HTML <textarea name="adHtml-${index}" rows="5">${escapeHtml(widget.html || "")}</textarea></label>
        </section>`).join("")}
        <button class="button" type="submit">Save Ad Widgets</button>
      </form>
    `
  });
}

export function pagesAdminPage({ pages, notice = "" }) {
  return adminLayout({
    title: "Pages",
    path: "/admin/pages",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Pages</h1>
          <p>Edit About, Contact, and any custom static pages. Header/footer visibility is controlled under Navigation.</p>
        </div>
        <a class="button" href="/admin/pages/new">New Page</a>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
          <tbody>${pages.map((page) => `<tr>
            <td><strong>${escapeHtml(page.title)}</strong><br><small>${escapeHtml(page.relativePath)}</small></td>
            <td>/${escapeHtml(page.slug)}</td>
            <td>${escapeHtml(page.status)}</td>
            <td>${escapeHtml(formatDate(page.updatedDate))}</td>
            <td class="table-actions">
              <a href="/admin/pages/${page.slug}/edit">Edit</a>
              <form method="post" action="/admin/pages/delete" data-confirm="Delete this page file?">
                <input type="hidden" name="slug" value="${escapeAttr(page.slug)}">
                <button type="submit">Delete</button>
              </form>
            </td>
          </tr>`).join("") || `<tr><td colspan="5">No pages yet.</td></tr>`}</tbody>
        </table>
      </div>
    `
  });
}

export function pageFormPage({ page = null, notice = "" }) {
  const isEdit = Boolean(page);
  return adminLayout({
    title: isEdit ? "Edit Page" : "New Page",
    path: "/admin/pages",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>${isEdit ? "Edit Page" : "New Page"}</h1>
          <p>Static pages support the same SEO and social metadata fields as articles.</p>
        </div>
        <a class="button secondary" href="/admin/pages">Back to Pages</a>
      </div>
      <form method="post" action="/admin/pages/save" enctype="multipart/form-data" class="admin-form">
        <input type="hidden" name="originalSlug" value="${escapeAttr(page?.slug || "")}">
        <div class="form-grid two">
          <label>Title <input name="title" required value="${escapeAttr(page?.title || "")}"></label>
          <label>Slug <input name="slug" required value="${escapeAttr(page?.slug || "")}" placeholder="about"></label>
          <label>Status <select name="status">${["published", "draft", "hidden"].map((item) => option(item, item, page?.status || "published")).join("")}</select></label>
          <label>Updated date <input name="updatedDate" type="date" value="${escapeAttr(formDateValue(page?.updatedDate))}"></label>
        </div>
        <label>SEO title <input name="metaTitle" value="${escapeAttr(page?.metaTitle || "")}"></label>
        <label>Canonical URL <input name="canonicalUrl" value="${escapeAttr(page?.canonicalUrl || "")}" placeholder="/about"></label>
        <label>Meta description <textarea name="metaDescription" rows="3">${escapeHtml(page?.metaDescription || "")}</textarea></label>
        <label>Excerpt <textarea name="excerpt" rows="2">${escapeHtml(page?.excerpt || "")}</textarea></label>
        <div class="form-grid two">
          <label>Featured image path <input name="featuredImage" value="${escapeAttr(page?.featuredImage || "")}"></label>
          <label>Upload featured image <input name="imageFile" type="file" accept="image/*"></label>
        </div>
        <label>Image alt text <input name="altText" value="${escapeAttr(page?.altText || "")}"></label>
        <label>Page body (Markdown) <textarea name="body" rows="18" required>${escapeHtml(page?.bodyMarkdown || "")}</textarea></label>
        <button class="button" type="submit">Save Page</button>
      </form>
    `
  });
}

export function submissionsPage({ submissions, notice = "" }) {
  return adminLayout({
    title: "Submissions",
    path: "/admin/submissions",
    notice,
    body: `
      <div class="admin-heading">
        <div>
          <h1>Submissions</h1>
          <p>Review news and contact form messages submitted through the website.</p>
        </div>
      </div>
      <div class="submission-list">
        ${submissions.map((submission) => `<article class="admin-card submission-card">
          <div class="submission-top">
            <div>
              <p class="eyebrow">${escapeHtml(submission.type || "submission")} · ${escapeHtml(formatDate(submission.createdAt))}</p>
              <h2>${escapeHtml(submission.title || submission.company || submission.name || "Submission")}</h2>
            </div>
            <form method="post" action="/admin/submissions/delete" data-confirm="Delete this submission?">
              <input type="hidden" name="id" value="${escapeAttr(submission.id)}">
              <button type="submit">Delete</button>
            </form>
          </div>
          <p><strong>Name:</strong> ${escapeHtml(submission.name || "")} · <strong>Email:</strong> ${escapeHtml(submission.email || "")}</p>
          ${submission.company ? `<p><strong>Company:</strong> ${escapeHtml(submission.company)}</p>` : ""}
          ${submission.sourceLink ? `<p><strong>Source:</strong> <a href="${escapeAttr(submission.sourceLink)}">${escapeHtml(submission.sourceLink)}</a></p>` : ""}
          ${submission.imageLink ? `<p><strong>Image:</strong> <a href="${escapeAttr(submission.imageLink)}">${escapeHtml(submission.imageLink)}</a></p>` : ""}
          <pre>${escapeHtml(submission.summary || submission.message || "")}</pre>
        </article>`).join("") || `<div class="empty-state">No submissions yet.</div>`}
      </div>
    `
  });
}
