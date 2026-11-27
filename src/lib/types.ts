export type ContentStatus = "draft" | "scheduled" | "published" | "archived";
export type AppRole = "administrator" | "editor" | "author";
export type MediaFolder = "branding" | "news" | "blogs" | "insights";

export interface SeoFields {
  title?: string;
  description?: string;
  canonical?: string;
  focusKeyword?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noindex?: boolean;
  nofollow?: boolean;
  /** Original source attribution (shown on Updates / news posts). */
  sourceName?: string;
  sourceUrl?: string;
  secondaryKeywords?: string;
  searchIntent?: string;
  /** Automated Updates workflow metadata. */
  automationState?: "draft" | "ready_for_review" | "published";
  automationMediaId?: string;
  automationArticleKey?: string;
  automationImageKey?: string;
  automationImageHash?: string;
  automationFinalizeKey?: string;
  automationReadyAt?: string;
  automationPublishedAt?: string;
  /** Readability analysis (editorial guidance, not SEO). */
  audience?: "general" | "business" | "technical" | undefined;
  readabilityIgnored?: string[];
  readability?: {
    total: number;
    rating: string;
    audience: string;
    components: Record<string, number>;
    analyzedAt: string;
  };
}

export interface ContentType {
  id: string;
  slug: string;
  name: string;
  plural_name: string;
  description: string | null;
  is_video: boolean;
  archive_path: string | null;
  position: number;
  enabled: boolean;
  seo: SeoFields;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  heading: string | null;
  seo: SeoFields;
  position: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo: SeoFields;
}

export interface Author {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  bio: string | null;
  job_title: string | null;
  photo_url: string | null;
  social_links: Record<string, string>;
  seo: SeoFields;
}

export interface MediaItem {
  id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  title: string | null;
  folder?: MediaFolder | null;
  created_at: string;
}

export interface NewsAutomationSettings {
  autoPublish: boolean;
}

export interface AutomationEvent {
  id: string;
  step: string;
  outcome: "success" | "error" | "reused";
  draft_id: string | null;
  media_id: string | null;
  title: string | null;
  source_url: string | null;
  result_state: string | null;
  result_url: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ContentItem {
  id: string;
  type_slug: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_html: string | null;
  body_markdown: string | null;
  editor_mode: "rich" | "markdown";
  featured_image_url: string | null;
  featured_image_alt: string | null;
  featured_image_caption: string | null;
  author_id: string | null;
  category_id: string | null;
  status: ContentStatus;
  is_featured: boolean;
  is_editors_pick: boolean;
  video_provider: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  reading_minutes: number | null;
  view_count: number;
  seo: SeoFields;
  related_ids: string[];
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<
    Author,
    "id" | "name" | "slug" | "photo_url" | "job_title" | "bio" | "social_links"
  > | null;
  category?: Pick<Category, "id" | "name" | "slug"> | null;
  tags?: Pick<Tag, "id" | "name" | "slug">[];
}

export type DeviceVisibility = {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
};

export interface SectionSettings extends DeviceVisibility {
  source?: "latest" | "featured" | "editors_pick" | "type" | "category" | "manual" | "popular";
  typeSlug?: string;
  categorySlug?: string;
  manualIds?: string[];
  sort?: "newest" | "oldest" | "popular";
  limit?: number;
  layout?: "card" | "list" | "compact" | "feature";
  columns?: 1 | 2 | 3 | 4;
  columnsTablet?: 1 | 2 | 3 | 4;
  columnsMobile?: 1 | 2;
  width?: "full" | "container" | "narrow";
  align?: "left" | "center" | "right";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  margin?: "none" | "sm" | "md" | "lg";
  background?: "page" | "muted" | "dark" | "accent" | "gradient";
  radius?: number;
  border?: boolean;
  textStyle?: "default" | "muted" | "large";
  // block-specific
  html?: string;
  text?: string;
  level?: "h1" | "h2" | "h3";
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  videoUrl?: string;
  height?: number;
  paginate?: boolean;
  sidebarTitle?: string;
  sidebarLimit?: number;
  showSearch?: boolean;

  [key: string]: JsonValue | undefined;
}

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface HomepageSection {
  id: string;
  block_type: string;
  title: string | null;
  subtitle: string | null;
  position: number;
  enabled: boolean;
  settings: SectionSettings;
}

export interface PageSection {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  settings: SectionSettings;
}

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  sections: PageSection[];
  seo: SeoFields;
  published_at: string | null;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  url: string;
  target: string;
  position: number;
  children?: MenuItem[];
}

export interface Redirect {
  id: string;
  source_path: string;
  destination_path: string;
  kind: "301" | "302";
  enabled: boolean;
}

// ------------------------- settings shapes ---------------------------

export interface GeneralSettings {
  siteName: string;
  tagline: string;
  siteUrl: string;
  timezone: string;
  dateFormat: string;
  postsPerPage: number;
  contactEmail: string;
  footerCopyright: string;
  rssEnabled: boolean;
  defaultAuthorId?: string;
  defaultCategoryId?: string;
  social: Record<string, string>;
  /** Which share icons are visible on articles. Keys: instagram, linkedin, email, x, facebook. */
  shareIcons?: Record<string, boolean>;
  analytics: { ga4: string; gtm: string; searchConsole: string };
}

export interface BrandingSettings {
  logoUrl: string;
  footerLogoUrl?: string;
  logoDarkUrl: string;
  logoMobileUrl: string;
  faviconUrl: string;
  defaultShareImage: string;
}

export interface ColorSettings {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  heading: string;
  link: string;
  pageBg: string;
  headerBg: string;
  /** Top logo/banner bar background for the two-row Magazine header. */
  headerTopBg?: string;
  /** Navigation / header link colour (independent from site link colour). */
  headerLink?: string;
  headerLinkHover?: string;
  footerBg: string;
  border: string;
  /** Article card surface + outline. */
  cardBg?: string;
  cardBorder?: string;
  /** Soft ambient gradient used behind the top of the homepage. */
  gradientEnabled?: boolean;
  gradientA?: string;
  gradientB?: string;
  gradientC?: string;
  /** 0-100: how strongly the gradient colors tint the page background. */
  gradientStrength?: number;
}

export interface MobileTypographySettings {
  baseSize: number;
  articleSize: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  lineHeight: number;
}

export interface TypographySettings {
  headingFont: string;
  bodyFont: string;
  navFont: string;
  navWeight?: number;
  navSize?: number;
  articleFont: string;
  baseSize: number;
  headingScale: number;
  headingWeight: number;
  bodyWeight: number;
  lineHeight: number;
  letterSpacing: number;
  mobile?: MobileTypographySettings;
}

export interface LayoutSettings {
  siteMaxWidth: number;
  articleWidth: number;
  sidebarWidth: number;
  headerStyle: "classic" | "centered" | "compact" | "magazine";
  headerHeight: number;
  stickyHeader: boolean;
  cardStyle: "bordered" | "plain" | "elevated";
  radius: number;
  shadow: "none" | "sm" | "md";
  sectionSpacing: number;
  gridGap: number;
}

export interface HeaderSettings {
  showTags?: boolean;
  tagSlugs?: string;
  bannerUrl?: string;
  bannerLink?: string;
  showSearch: boolean;
  showSocial: boolean;
  showCta: boolean;
  ctaLabel: string;
  ctaUrl: string;
  menuSlug: string;
  visible: boolean;
}

export interface FooterSettings {
  showLogo: boolean;
  description: string;
  showMenu: boolean;
  showSocial: boolean;
  showNewsletter: boolean;
  contactDetails: string;
  columns: { id: string; title: string; html: string }[];
}

export interface ArticleSettings {
  breadcrumbs: boolean;
  category: boolean;
  excerpt: boolean;
  author: boolean;
  publishedDate: boolean;
  updatedDate: boolean;
  readingTime: boolean;
  featuredImage: boolean;
  imageCaption: boolean;
  toc: boolean;
  tocMobile: boolean;
  tags: boolean;
  share: boolean;
  authorBox: boolean;
  related: boolean;
  prevNext: boolean;
  newsletter: boolean;
  sidebar: boolean;
}

export interface SeoSettings {
  defaultTitleTemplate: string;
  defaultDescription: string;
  defaultOgImage: string;
  indexSite: boolean;
  twitterHandle: string;
  organizationName: string;
  organizationLogo: string;
}

export interface AdSlot {
  enabled: boolean;
  code: string;
  desktop: boolean;
  mobile: boolean;
}

export type AdsSettings = Record<string, AdSlot>;

export interface NewsletterSettings {
  provider: string;
  endpoint: string;
  heading: string;
  description: string;
  buttonLabel: string;
}

export interface ContactSettings {
  heading: string;
  intro: string;
  successMessage: string;
}

export interface SiteSettings {
  general: GeneralSettings;
  branding: BrandingSettings;
  colors: ColorSettings;
  typography: TypographySettings;
  layout: LayoutSettings;
  header: HeaderSettings;
  footer: FooterSettings;
  article: ArticleSettings;
  seo: SeoSettings;
  ads: AdsSettings;
  newsletter: NewsletterSettings;
  contact: ContactSettings;
}

export interface SiteBootstrap {
  settings: SiteSettings;
  menus: Record<string, MenuItem[]>;
  contentTypes: ContentType[];
  categories: Category[];
  tags?: Tag[];
}
