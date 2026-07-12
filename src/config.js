import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cleanSiteUrl(value) {
  return String(value || "http://localhost:3000").replace(/\/+$/, "");
}

export const paths = {
  rootDir,
  srcDir: path.join(rootDir, "src"),
  contentDir: path.join(rootDir, "content"),
  publicDir: path.join(rootDir, "public"),
  dataDir: path.join(rootDir, "data"),
  settingsFile: path.join(rootDir, "data", "site-settings.json"),
  submissionsDir: path.join(rootDir, "data", "submissions"),
  uploadsDir: path.join(rootDir, "public", "uploads")
};

export const config = {
  port: Number(process.env.PORT || 3000),
  siteUrl: cleanSiteUrl(process.env.SITE_URL),
  adminEmail: process.env.ADMIN_EMAIL || "admin@fabric-pro.com",
  adminPassword: process.env.ADMIN_PASSWORD || "change-me-now",
  sessionSecret: process.env.SESSION_SECRET || "local-development-secret-change-me",
  maxBodyBytes: 40 * 1024 * 1024,
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_VERIFICATION_CODE || "",
  bingSiteVerification: process.env.BING_SITE_VERIFICATION || process.env.BING_VERIFICATION_CODE || "",
  gaMeasurementId: process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  assetVersion: process.env.ASSET_VERSION || "20260712-final-article-polish",
  github: {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "",
    branch: process.env.GITHUB_BRANCH || "main",
    basePath: (process.env.GITHUB_CONTENT_BASE_PATH || "").replace(/^\/+|\/+$/g, "")
  }
};

export const contentTypes = {
  news: {
    key: "news",
    folder: "news",
    label: "News",
    singular: "News Article",
    plural: "News",
    path: "/news",
    schemaType: "NewsArticle"
  },
  blogs: {
    key: "blogs",
    folder: "blogs",
    label: "Blogs",
    singular: "Blog Post",
    plural: "Blogs",
    path: "/blogs",
    schemaType: "BlogPosting"
  },
  insights: {
    key: "insights",
    folder: "insights",
    label: "Insights",
    singular: "Insight",
    plural: "Insights",
    path: "/insights",
    schemaType: "Article"
  }
};

export const defaultHeaderNavigation = [
  { label: "Home", url: "/", order: 1, visible: true },
  { label: "News", url: "/news", order: 2, visible: true },
  { label: "Blogs", url: "/blogs", order: 3, visible: true },
  { label: "Insights", url: "/insights", order: 4, visible: true },
  { label: "Submit News", url: "/submit-news", order: 5, visible: true }
];
