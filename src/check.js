import { getArticles, getPages } from "./content.js";

const requiredArticleFields = [
  "title",
  "metaTitle",
  "metaDescription",
  "slug",
  "category",
  "author",
  "publishedDate",
  "featuredImage",
  "altText",
  "tags",
  "excerpt"
];

let failed = false;
const articleKeys = new Set();

for (const article of getArticles({ includeHidden: true })) {
  const key = `${article.type}/${article.slug}`;
  if (articleKeys.has(key)) {
    console.error(`Duplicate article slug: ${key}`);
    failed = true;
  }
  articleKeys.add(key);
  for (const field of requiredArticleFields) {
    if (!article[field] || (Array.isArray(article[field]) && !article[field].length)) {
      console.error(`Missing ${field} in ${article.relativePath}`);
      failed = true;
    }
  }
}

const pageKeys = new Set();
for (const page of getPages({ includeHidden: true })) {
  if (pageKeys.has(page.slug)) {
    console.error(`Duplicate page slug: ${page.slug}`);
    failed = true;
  }
  pageKeys.add(page.slug);
}

if (failed) process.exit(1);
console.log(`Content check passed: ${articleKeys.size} articles, ${pageKeys.size} pages.`);
