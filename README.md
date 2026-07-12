# Fabric-Pro

A fast Node.js news/article website for Fabric-Pro. It is built around Markdown, rich HTML, DOCX-imported article content, server-rendered HTML, clean URLs, sitemap/RSS generation, technical SEO metadata, and a simple admin area.

## Run Locally

```bash
npm install
npm start
```

Open:

- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

The localhost URLs above are only for running the project on your own computer. In production, enter the variables from `.env.example` in Hostinger's Environment Variables screen.

## Production Configuration

This site does not use a conventional database. That is intentional: articles, images, categories, tags, and site settings live in your GitHub repository as Markdown/JSON files. With the GitHub variables configured, each admin save commits the change to GitHub, and the GitHub-connected Hostinger deployment publishes it.

Set these values in Hostinger for a complete production setup:

```env
NODE_ENV=production
SITE_URL=https://fabric-pro.com
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-unique-long-password
SESSION_SECRET=your-unique-random-secret-at-least-32-characters-long
GOOGLE_SITE_VERIFICATION=google-verification-code-only
BING_SITE_VERIFICATION=bing-verification-code-only
GA_MEASUREMENT_ID=G-XXXXXXXXXX
GITHUB_TOKEN=github_pat_your_token_here
GITHUB_REPO=your-github-username/your-fabric-pro-repository
GITHUB_BRANCH=main
GITHUB_CONTENT_BASE_PATH=
ASSET_VERSION=20260712-sticky-sidebar
```

Do not create a `DATABASE_URL`; this code does not use one. Do not add `PORT` unless Hostinger asks you to, because its Node.js runtime normally provides the port itself.

## Content Folders

Articles are Markdown or MDX files in:

- `content/news`
- `content/blogs`
- `content/insights`

Static pages are in:

- `content/pages`

Images can be placed in:

- `public/uploads`
- `public/images`

## Article Frontmatter

Each article supports these fields. Existing older camelCase fields still work, but new articles should use these names:

```yaml
title: "Your article title"
meta_title: "SEO title"
meta_description: "SEO meta description"
slug: "your-article-slug"
category: "Textile Machinery"
article_type: "Insight"
author_name: "Fabric-Pro Editorial Desk"
show_author: true
reviewer_name: ""
show_reviewer: false
published_date: "2026-06-11T00:00:00.000Z"
last_updated_date: "2026-06-11T00:00:00.000Z"
estimated_reading_time: ""
featured_image: "/uploads/your-image.webp"
featured_image_alt: "Describe the image"
image_caption: "Optional visible caption below the article image"
tags: ["tag one", "tag two"]
primary_keyword: "main keyword"
secondary_keywords: ["keyword two", "keyword three"]
excerpt: "Short card summary."
content_format: "markdown"
key_takeaways: ["First takeaway", "Second takeaway"]
sources: []
faqs: []
canonical_url: "/news/your-article-slug"
og_title: ""
og_description: ""
og_image: ""
status: "published"
```

Copy `content/templates/article-template.md` into the correct folder, rename it, update the fields, and push to GitHub. Latest articles appear first by `published_date`.

## Article Content Formats

Use `content_format: "markdown"` for normal Markdown body content.

Use `content_format: "html"` when the article body is clean HTML.

Use `content_format: "docx_imported"` when the admin DOCX importer converts a Word file into editable article HTML.

The article body lives below the frontmatter. This keeps long Markdown or HTML out of the frontmatter and makes files easier to edit.

The admin editor also supports:

- DOCX upload/import using Word styles.
- Inline image upload and insertion as a `<figure>` block.
- Optional Key Takeaways, FAQ, and Sources sections.
- Optional Author and Reviewed by display toggles.

For best DOCX import results, use Word styles: Title for the document title, Heading 2 for main sections, Heading 3 for sub-sections, real bullet lists, Word tables, and normally inserted images.

## SEO URLs

- Sitemap: `/sitemap.xml`
- Robots: `/robots.txt`
- RSS: `/rss.xml`
- News articles: `/news/article-slug`
- Blog articles: `/blogs/article-slug`
- Insight articles: `/insights/article-slug`
- Categories: `/category/category-slug`
- Tags: `/tag/tag-slug`

The sitemap updates automatically from the Markdown files.

## Technical SEO

The site renders article content as HTML on the server. It includes:

- Canonical tags
- SEO title and meta description
- Open Graph tags
- Twitter Card tags
- Organization JSON-LD
- WebSite JSON-LD
- BreadcrumbList JSON-LD
- Article, BlogPosting, or NewsArticle JSON-LD
- FAQPage JSON-LD when article FAQs exist
- RSS feed
- XML sitemap
- robots.txt

## Search Console, Bing, and GA4

Use these production variables for the verification codes and GA4:

```env
GOOGLE_SITE_VERIFICATION=your-google-code
BING_SITE_VERIFICATION=your-bing-code
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Paste only the verification code, not the complete meta tag. You can also enter the same values in Admin > Settings. Environment variables take priority.

## GitHub Admin Publishing

If you want the admin panel to commit changes back to GitHub, set:

```env
GITHUB_TOKEN=github_pat_or_token
GITHUB_REPO=owner/repository
GITHUB_BRANCH=main
GITHUB_CONTENT_BASE_PATH=
```

Create a fine-grained GitHub token restricted to this repository and grant it **Contents: Read and write** permission. When configured, saving an article, page, setting, image, navigation item, or ad widget in admin writes the file locally and commits it to GitHub. A GitHub-connected host can then rebuild and publish automatically. Keep `GITHUB_CONTENT_BASE_PATH` blank when this project is at the repository root.

## Hostinger Deployment

1. Push this project to a GitHub repository.
2. In Hostinger, create a Node.js app or GitHub-connected deployment from the repository.
3. Use Node.js 20 or newer.
4. Set the build/install command:

```bash
npm install
```

5. Set the start command:

```bash
npm start
```

6. Add all values from `.env.example` to Hostinger's Environment Variables screen, replacing every placeholder with your own value.
7. Set `SITE_URL` to your final domain, for example `https://fabric-pro.com`.

When new Markdown files and images are pushed to GitHub, the connected hosting deployment should rebuild or redeploy from the latest commit.
