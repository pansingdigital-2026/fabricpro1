# Fabric-Pro

A fast Node.js news/article website for Fabric-Pro. It is built around Markdown content, server-rendered HTML, clean URLs, sitemap/RSS generation, technical SEO metadata, and a simple admin area.

## Run Locally

```bash
npm install
npm start
```

Open:

- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

Default local admin values come from `.env.example`. In production, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET`.

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

Each article supports these fields:

```yaml
title: "Your article title"
metaTitle: "SEO title"
metaDescription: "SEO meta description"
slug: "your-article-slug"
category: "Textile Machinery"
author: "Fabric-Pro Editorial Desk"
reviewedBy: "Fabric-Pro Review Desk"
publishedDate: "2026-06-11T00:00:00.000Z"
updatedDate: "2026-06-11T00:00:00.000Z"
featuredImage: "/uploads/your-image.webp"
altText: "Describe the image"
imageCaption: "Optional visible caption below the article image"
tags: ["tag one", "tag two"]
excerpt: "Short card summary."
canonicalUrl: "/news/your-article-slug"
status: "published"
```

Copy `content/templates/article-template.md` into the correct folder, rename it, update the fields, and push to GitHub. Latest articles appear first by `publishedDate`.

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
- RSS feed
- XML sitemap
- robots.txt

## Search Console, Bing, and GA4

Use environment variables in production:

```env
GOOGLE_SITE_VERIFICATION=your-google-code
BING_SITE_VERIFICATION=your-bing-code
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

You can also enter the same values in Admin > Settings. Environment variables take priority.

## GitHub Admin Publishing

If you want the admin panel to commit changes back to GitHub, set:

```env
GITHUB_TOKEN=github_pat_or_token
GITHUB_REPO=owner/repository
GITHUB_BRANCH=main
GITHUB_CONTENT_BASE_PATH=
```

The token needs repository contents read/write permission. When configured, saving an article, page, setting, image, navigation item, or ad widget in admin writes the file locally and commits it to GitHub. A GitHub-connected host can then rebuild and publish automatically.

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

6. Add production environment variables from `.env.example`.
7. Set `SITE_URL` to your final domain, for example:

```env
SITE_URL=https://fabric-pro.com
```

When new Markdown files and images are pushed to GitHub, the connected hosting deployment should rebuild or redeploy from the latest commit.
