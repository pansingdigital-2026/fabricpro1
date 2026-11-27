import type { SiteSettings } from "./types";

const SAFE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SAFE_FUNC_COLOR = /^(?:rgba?|hsla?)\(\s*[0-9.%\s,/+-]+\s*\)$/i;

/** Allow only validated CSS color values; reject anything that could break out of CSS. */
function safeColor(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed === "transparent" || SAFE_HEX.test(trimmed) || SAFE_FUNC_COLOR.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/** Allow only valid font family names (letters, digits, spaces, hyphens); reject anything else. */
function safeFont(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9 -]{0,63}$/.test(trimmed) ? trimmed : fallback;
}

/** Clamp numeric CSS settings to finite bounds. */
function safeNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Convert #rrggbb to an "r g b" triple for CSS color-mix friendly vars. */
function hexToRgb(hex: string): string {
  const safe = safeColor(hex, "#000000");
  if (!SAFE_HEX.test(safe)) return "0 0 0";
  const clean = safe.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const num = Number.parseInt(full || "000000", 16);
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/**
 * Builds the CSS custom properties that drive the whole public site from
 * Appearance settings. Injected once in the site layout.
 */
export function themeCss(settings: SiteSettings): string {
  const { colors: c, typography: t, layout: l } = settings;
  const m = t.mobile ?? {
    baseSize: 16,
    articleSize: 17,
    h1Size: 28,
    h2Size: 21,
    h3Size: 18,
    lineHeight: 1.6,
  };

  const shadow =
    l.shadow === "none"
      ? "none"
      : l.shadow === "sm"
        ? "0 1px 2px rgb(0 0 0 / 0.06)"
        : "0 6px 20px rgb(0 0 0 / 0.10)";

  const primary = safeColor(c.primary, "#0F1E3A");
  const secondary = safeColor(c.secondary, "#1E3A5F");
  const accent = safeColor(c.accent, "#C9963B");
  const text = safeColor(c.text, "#1E293B");
  const heading = safeColor(c.heading, "#0F1E3A");
  const link = safeColor(c.link, "#1E3A5F");
  const pageBg = safeColor(c.pageBg, "#FFFFFF");
  const headerBg = safeColor(c.headerBg, "#FFFFFF");
  const headerTopBg = safeColor(c.headerTopBg, pageBg);
  const headerLink = safeColor(c.headerLink, text);
  const headerLinkHover = safeColor(c.headerLinkHover, link);
  const footerBg = safeColor(c.footerBg, "#0F1E3A");
  const border = safeColor(c.border, "#E2E8F0");
  const cardBg = safeColor(c.cardBg, pageBg);
  const cardBorder = safeColor(c.cardBorder, border);
  const gradientA = safeColor(c.gradientA, "#FFE9A8");
  const gradientB = safeColor(c.gradientB, "#BFD9FF");
  const gradientC = safeColor(c.gradientC, "#FFC9E4");

  const headingFont = safeFont(t.headingFont, "Plus Jakarta Sans");
  const bodyFont = safeFont(t.bodyFont, "Source Sans 3");
  const navFont = safeFont(t.navFont, bodyFont);
  const articleFont = safeFont(t.articleFont, bodyFont);

  const strength = safeNum(c.gradientStrength, 22, 0, 100);
  const tint = (hex: string) => `color-mix(in srgb, ${hex} ${strength}%, ${pageBg})`;
  const gradient =
    c.gradientEnabled === false
      ? pageBg
      : [
          `radial-gradient(120% 90% at 0% 0%, ${tint(gradientA)} 0%, transparent 62%)`,
          `radial-gradient(110% 90% at 100% 0%, ${tint(gradientB)} 0%, transparent 60%)`,
          `radial-gradient(120% 80% at 70% 100%, ${tint(gradientC)} 0%, transparent 65%)`,
          pageBg,
        ].join(",");

  return `:root{
--site-gradient:${gradient};
--site-primary:${primary};
--site-primary-rgb:${hexToRgb(primary)};
--site-secondary:${secondary};
--site-accent:${accent};
--site-accent-rgb:${hexToRgb(accent)};
--site-text:${text};
--site-heading:${heading};
--site-link:${link};
--site-page-bg:${pageBg};
--site-header-bg:${headerBg};
--site-header-top-bg:${headerTopBg};
--site-header-link:${headerLink};
--site-header-link-hover:${headerLinkHover};
--site-footer-bg:${footerBg};
--site-border:${border};
--site-card-bg:${cardBg};
--site-card-border:${cardBorder};
--site-muted-bg:color-mix(in srgb, ${pageBg} 94%, ${text} 6%);
--site-muted-text:color-mix(in srgb, ${text} 62%, ${pageBg} 38%);
--font-heading:"${headingFont}", Georgia, serif;
--font-body:"${bodyFont}", system-ui, -apple-system, sans-serif;
--font-nav:"${navFont}", system-ui, sans-serif;
--nav-weight:${safeNum(t.navWeight, 500, 100, 900)};
--nav-size:${safeNum(t.navSize, 15, 10, 32)}px;
--font-article:"${articleFont}", Georgia, serif;
--font-size-base:${safeNum(t.baseSize, 16, 12, 32)}px;
--heading-scale:${safeNum(t.headingScale, 1.25, 0.5, 3)};
--heading-weight:${safeNum(t.headingWeight, 700, 100, 900)};
--body-weight:${safeNum(t.bodyWeight, 400, 100, 900)};
--line-height:${safeNum(t.lineHeight, 1.65, 1, 3)};
--letter-spacing:${safeNum(t.letterSpacing, 0, -2, 10)}px;
--site-max-width:${safeNum(l.siteMaxWidth, 1280, 640, 2400)}px;
--article-width:${safeNum(l.articleWidth, 760, 480, 1400)}px;
--sidebar-width:${safeNum(l.sidebarWidth, 300, 160, 600)}px;
--header-height:${safeNum(l.headerHeight, 68, 36, 240)}px;
--card-radius:${safeNum(l.radius, 8, 0, 64)}px;
--card-shadow:${shadow};
--section-spacing:${safeNum(l.sectionSpacing, 36, 0, 160)}px;
--grid-gap:${safeNum(l.gridGap, 24, 0, 96)}px;
}
@media (max-width: 767px){:root{
--font-size-base:${safeNum(m.baseSize, 16, 12, 32)}px;
--line-height:${safeNum(m.lineHeight, 1.6, 1, 3)};
--article-font-size:${safeNum(m.articleSize, 17, 12, 32)}px;
--article-h1-size:${safeNum(m.h1Size, 28, 16, 72)}px;
--article-h2-size:${safeNum(m.h2Size, 21, 14, 56)}px;
--article-h3-size:${safeNum(m.h3Size, 18, 12, 48)}px;
}}`;
}


/** Google Fonts stylesheet href for the configured font families. */
export function fontsHref(settings: SiteSettings): string {
  const families = Array.from(
    new Set(
      [
        settings.typography.headingFont,
        settings.typography.bodyFont,
        settings.typography.navFont,
        settings.typography.articleFont,
      ].filter(Boolean),
    ),
  );
  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
