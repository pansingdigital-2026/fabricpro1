import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { escapeAttr, escapeHtml, slugify, stripHtml } from "./utils.js";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false
});

const allowedTags = [
  "address", "article", "aside", "b", "blockquote", "br", "caption", "cite", "code",
  "col", "colgroup", "dd", "div", "dl", "dt", "em", "figcaption", "figure", "h1",
  "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "mark", "ol", "p", "pre",
  "q", "s", "section", "small", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul", "a"
];

const allowedAttributes = {
  "*": ["class", "id", "title"],
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "alt", "loading", "decoding", "width", "height", "class", "title"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"]
};

function forceSafeLinks(tagName, attribs = {}) {
  if (tagName !== "a") return { tagName, attribs };
  const next = { ...attribs };
  if (next.target === "_blank") next.rel = "noopener noreferrer";
  return { tagName, attribs: next };
}

export function sanitizeArticleHtml(html = "") {
  return sanitizeHtml(String(html || ""), {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"]
    },
    allowProtocolRelative: false,
    transformTags: {
      a: forceSafeLinks
    }
  });
}

function headingMatchesTitle(headingHtml = "", title = "") {
  return slugify(stripHtml(headingHtml)) === slugify(title);
}

function removeDuplicateTitle(html = "", title = "") {
  if (!title) return html;
  const match = String(html).match(/^\s*<(h1|h2|p)[^>]*>([\s\S]*?)<\/\1>\s*/i);
  if (!match) return html;
  return headingMatchesTitle(match[2], title) ? html.slice(match[0].length) : html;
}

function addClassToTag(tag = "", className = "") {
  if (!className) return tag;
  if (/\sclass=(["'])(.*?)\1/i.test(tag)) {
    return tag.replace(/\sclass=(["'])(.*?)\1/i, (full, quote, classes) => {
      const list = String(classes).split(/\s+/).filter(Boolean);
      if (!list.includes(className)) list.push(className);
      return ` class=${quote}${escapeAttr(list.join(" "))}${quote}`;
    });
  }
  return tag.replace(/>$/, ` class="${escapeAttr(className)}">`);
}

function addImageDefaults(tag = "") {
  const selfClosing = /\/>\s*$/.test(tag);
  let output = tag.replace(/\s*\/?>\s*$/, "");
  if (!/\sloading=/i.test(output)) output += ' loading="lazy"';
  if (!/\sdecoding=/i.test(output)) output += ' decoding="async"';
  return `${output}${selfClosing ? " />" : ">"}`;
}

function normalizeFigures(html = "") {
  return String(html)
    .replace(/<img\b[^>]*>/gi, (img) => addImageDefaults(img))
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/gi, '<figure class="article-image">$1</figure>')
    .replace(/<figure\b[^>]*>/gi, (figure) => addClassToTag(figure, "article-image"));
}

function wrapTables(html = "") {
  return String(html).replace(/<table\b[\s\S]*?<\/table>/gi, (table, offset, full) => {
    const before = full.slice(Math.max(0, offset - 100), offset);
    if (/article-table-wrap[^>]*>\s*$/i.test(before)) return table;
    return `<div class="article-table-wrap">${table}</div>`;
  });
}

export function cleanArticleHtml(html = "") {
  return wrapTables(normalizeFigures(sanitizeArticleHtml(html)));
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") return item.text || item.title || item.value || "";
        return item;
      })
      .map((item) => stripHtml(item))
      .filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split(/\n|,/)
    .map((item) => stripHtml(item.replace(/^\s*[-*]\s+/, "")))
    .filter(Boolean);
}

function extractListItems(html = "") {
  const items = [];
  String(html).replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => {
    const text = stripHtml(item);
    if (text) items.push(text);
    return "";
  });
  if (items.length) return items;

  String(html).replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, item) => {
    const text = stripHtml(item);
    if (text) items.push(text);
    return "";
  });
  return items;
}

function extractKeyTakeaways(html = "") {
  const headingRegex = /<(h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingRegex.exec(html))) {
    const headingText = slugify(stripHtml(match[2]));
    if (headingText !== "key-takeaways" && headingText !== "key-takeaway") continue;

    const sectionStart = match.index + match[0].length;
    const rest = html.slice(sectionStart);
    const nextHeading = rest.search(match[1].toLowerCase() === "h2" ? /<h2\b/i : /<h[23]\b/i);
    const sectionEnd = nextHeading === -1 ? html.length : sectionStart + nextHeading;
    const section = html.slice(sectionStart, sectionEnd);

    return {
      found: true,
      takeaways: extractListItems(section),
      html: `${html.slice(0, match.index)}${html.slice(sectionEnd)}`
    };
  }
  return { found: false, takeaways: [], html };
}

function renderKeyTakeawaysBox(takeaways = [], takeawayHtml = "") {
  const items = normalizeTextArray(takeaways);
  const body = takeawayHtml
    ? sanitizeArticleHtml(takeawayHtml)
    : items.length
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
  if (!body) return "";
  return `<section class="article-key-takeaways" aria-labelledby="key-takeaways-title">
    <h2 id="key-takeaways-title">Key Takeaways</h2>
    ${body}
  </section>`;
}

export function normalizeFaqs(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          const [question, ...answerParts] = item.split("|");
          return { question: question?.trim(), answer: answerParts.join("|").trim() };
        }
        return {
          question: String(item?.question || item?.q || "").trim(),
          answer: String(item?.answer || item?.a || "").trim()
        };
      })
      .filter((item) => item.question && item.answer);
  }
  return String(value)
    .split(/\n+/)
    .map((line) => {
      const [question, ...answerParts] = line.split("|");
      return { question: question?.trim(), answer: answerParts.join("|").trim() };
    })
    .filter((item) => item.question && item.answer);
}

export function normalizeSources(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          const [name, title, url] = item.split("|");
          return { name: name?.trim(), title: title?.trim(), url: url?.trim() };
        }
        return {
          name: String(item?.name || item?.source || "").trim(),
          title: String(item?.title || "").trim(),
          url: String(item?.url || item?.href || "").trim()
        };
      })
      .filter((item) => item.name || item.title || item.url);
  }
  return String(value)
    .split(/\n+/)
    .map((line) => {
      const [name, title, url] = line.split("|");
      return { name: name?.trim(), title: title?.trim(), url: url?.trim() };
    })
    .filter((item) => item.name || item.title || item.url);
}

function renderFaqSection(faqs = []) {
  const rows = normalizeFaqs(faqs);
  if (!rows.length) return "";
  return `<section class="article-faq" aria-labelledby="article-faq-title">
    <h2 id="article-faq-title">FAQs</h2>
    ${rows.map((item) => `<details>
      <summary>${escapeHtml(item.question)}</summary>
      <div>${cleanArticleHtml(markdown.render(item.answer))}</div>
    </details>`).join("")}
  </section>`;
}

function renderSourcesSection(sources = []) {
  const rows = normalizeSources(sources);
  if (!rows.length) return "";
  return `<section class="article-sources" aria-labelledby="article-sources-title">
    <h2 id="article-sources-title">Sources</h2>
    <ol>
      ${rows.map((item) => {
        const label = item.title || item.name || item.url;
        const prefix = item.name && item.title ? `${escapeHtml(item.name)}: ` : "";
        return `<li>${prefix}${item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label)}</li>`;
      }).join("")}
    </ol>
  </section>`;
}

export function renderInlineFigure({ src = "", alt = "", caption = "" } = {}) {
  if (!src) return "";
  return `<figure class="article-image">
  <img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">
  ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
</figure>`;
}

export function renderArticleContent(article = {}) {
  const format = String(article.contentFormat || article.content_format || "markdown").toLowerCase();
  const markdownBody = article.contentMarkdown || article.content_markdown || article.bodyMarkdown || article.body || "";
  const htmlBody = article.contentHtml || article.content_html || "";
  const rawHtml = format === "html" || format === "docx_imported"
    ? htmlBody || markdownBody
    : markdown.render(markdownBody);

  let html = removeDuplicateTitle(cleanArticleHtml(rawHtml), article.title);
  const extracted = extractKeyTakeaways(html);
  if (extracted.found) html = extracted.html;

  const explicitTakeaways = normalizeTextArray(article.keyTakeaways || article.key_takeaways);
  const takeaways = explicitTakeaways.length ? explicitTakeaways : extracted.takeaways;
  const takeawayHtml = article.keyTakeawaysHtml || article.key_takeaways_html || "";

  return {
    html: [
      renderKeyTakeawaysBox(takeaways, takeawayHtml),
      cleanArticleHtml(html),
      renderFaqSection(article.faqs),
      renderSourcesSection(article.sources)
    ].filter(Boolean).join("\n"),
    keyTakeaways: takeaways,
    faqs: normalizeFaqs(article.faqs),
    sources: normalizeSources(article.sources)
  };
}
