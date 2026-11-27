import type { SiteSettings } from "./types";

export const DEFAULT_SETTINGS: SiteSettings = {
  general: {
    siteName: "Fabric-Pro",
    tagline: "Textile industry news, fabric innovation, sourcing updates, and practical insights.",
    siteUrl: "https://fabric-pro.com",
    timezone: "UTC",
    dateFormat: "d MMM yyyy",
    postsPerPage: 12,
    contactEmail: "",
    footerCopyright: "© 2026 Fabric-Pro. All rights reserved.",
    rssEnabled: true,
    social: {},
    shareIcons: { instagram: true, linkedin: true, email: true, x: false, facebook: false },
    analytics: {
      ga4: "G-PNG18HX9YY",
      gtm: "",
      searchConsole: "hnHOcdZLhM-oWq896ezz9OE9JYpgPPAAuD_pvrhJQRA",
    },
  },
  branding: {
    logoUrl: "/uploads/brand/fabric-pro-logo.webp",
    footerLogoUrl: "",
    logoDarkUrl: "",
    logoMobileUrl: "",
    faviconUrl: "/uploads/brand/fabric-pro-favicon.png",
    defaultShareImage: "/uploads/news/textile-machinery-news.jpg",
  },
  colors: {
    primary: "#0B3368",
    secondary: "#475467",
    accent: "#4BA82E",
    text: "#101828",
    heading: "#0B1F3A",
    link: "#0B3368",
    pageBg: "#FFFFFF",
    headerBg: "#FFFFFF",
    headerTopBg: "#FFFFFF",
    headerLink: "#0B1F3A",
    headerLinkHover: "#16756F",
    footerBg: "#0B1F3A",
    border: "#E2E8F0",
    cardBg: "#F9FBFD",
    cardBorder: "#E2E8F0",
    gradientEnabled: true,
    gradientA: "#CBEAD7",
    gradientB: "#C6DCF5",
    gradientC: "#E2F4EE",
    gradientStrength: 34,
  },
  typography: {
    headingFont: "Public Sans",
    bodyFont: "IBM Plex Sans",
    navFont: "DM Sans",
    articleFont: "IBM Plex Sans",
    baseSize: 16,
    headingScale: 1.3,
    headingWeight: 700,
    bodyWeight: 400,
    lineHeight: 1.65,
    letterSpacing: 0,
    mobile: {
      baseSize: 16,
      articleSize: 17,
      h1Size: 28,
      h2Size: 21,
      h3Size: 18,
      lineHeight: 1.6,
    },
  },

  layout: {
    siteMaxWidth: 1200,
    articleWidth: 720,
    sidebarWidth: 320,
    headerStyle: "classic",
    headerHeight: 84,
    stickyHeader: true,
    cardStyle: "plain",
    radius: 8,
    shadow: "sm",
    sectionSpacing: 36,
    gridGap: 32,
  },

  header: {
    showTags: true,
    tagSlugs: "",
    bannerUrl: "",
    bannerLink: "",
    showSearch: true,
    showSocial: true,
    showCta: false,
    ctaLabel: "Subscribe",
    ctaUrl: "/contact",
    menuSlug: "main",
    visible: true,
  },
  footer: {
    showLogo: true,
    description:
      "Fabric-Pro publishes clear, useful coverage for textile, fabric, apparel material, sourcing, machinery, and sustainability professionals.",
    showMenu: true,
    showSocial: true,
    showNewsletter: true,
    contactDetails: "",
    columns: [
      {
        id: "sections",
        title: "Sections",
        html: '<a href="/news">News</a><a href="/blogs">Blogs</a><a href="/insights">Insights</a>',
      },
      {
        id: "company",
        title: "Fabric-Pro",
        html: '<a href="/p/about">About</a><a href="/contact">Contact</a><a href="/search">Search</a><a href="/rss.xml">RSS feed</a>',
      },
    ],
  },
  article: {
    breadcrumbs: true,
    category: true,
    excerpt: true,
    author: true,
    publishedDate: true,
    updatedDate: true,
    readingTime: true,
    featuredImage: true,
    imageCaption: true,
    toc: true,
    tocMobile: true,
    tags: true,
    share: true,
    authorBox: true,
    related: true,
    prevNext: true,
    newsletter: true,
    sidebar: false,
  },
  seo: {
    defaultTitleTemplate: "%s — %site%",
    defaultDescription:
      "Latest textile industry news, fabric manufacturing updates, sustainable materials, textile machinery coverage, sourcing blogs, and expert insights.",
    defaultOgImage: "/uploads/news/textile-machinery-news.jpg",
    indexSite: true,
    twitterHandle: "",
    organizationName: "Fabric-Pro",
    organizationLogo: "/uploads/brand/fabric-pro-logo.webp",
  },
  ads: {
    header: { enabled: false, code: "", desktop: true, mobile: true },
    homepage: { enabled: false, code: "", desktop: true, mobile: true },
    articleBody: { enabled: false, code: "", desktop: true, mobile: true },
    articleSidebar: { enabled: false, code: "", desktop: true, mobile: true },
    belowArticle: { enabled: false, code: "", desktop: true, mobile: true },
    category: { enabled: false, code: "", desktop: true, mobile: true },
  },
  newsletter: {
    provider: "database",
    endpoint: "",
    heading: "Subscribe to Fabric-Pro",
    description: "Get textile industry news, sourcing blogs, and expert insights in your inbox.",
    buttonLabel: "Sign up",
  },
  contact: {
    heading: "Contact Fabric-Pro",
    intro:
      "Reach the Fabric-Pro editorial desk for news tips, company announcements, corrections, and partnerships.",
    successMessage: "Thanks — your message has been sent.",
  },
};

export const FONT_CHOICES = [
  "Newsreader",
  "Source Serif 4",
  "Lora",
  "Libre Baskerville",
  "Public Sans",
  "Work Sans",
  "IBM Plex Sans",
  "Manrope",
  "Space Grotesk",
  "JetBrains Mono",
] as const;

export function mergeSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of rows) {
    const base = out[row.key];
    if (base && typeof row.value === "object" && row.value) {
      out[row.key] = { ...base, ...(row.value as Record<string, unknown>) };
    } else if (row.value && typeof row.value === "object") {
      out[row.key] = row.value as Record<string, unknown>;
    }
  }
  return out as unknown as SiteSettings;
}
