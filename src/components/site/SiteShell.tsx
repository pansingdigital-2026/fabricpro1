import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, Search } from "lucide-react";

import { BackToTop } from "./BackToTop";
import { SiteSearchBox } from "./SiteSearchBox";
import { MagazineHeader } from "./MagazineHeader";
import type { MenuItem, SiteBootstrap } from "@/lib/types";

function NavLinks({ items, onNavigate }: { items: MenuItem[]; onNavigate?: () => void }) {
  return (
    <>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target={item.target === "_blank" ? "_blank" : undefined}
          rel={item.target === "_blank" ? "noreferrer" : undefined}
          onClick={onNavigate}
          className="site-nav-link"
        >
          {item.label}
        </a>
      ))}
    </>
  );
}

export function SiteShell({
  bootstrap,
  children,
}: {
  bootstrap: SiteBootstrap;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { settings } = bootstrap;
  const headerMenuSlug = settings.header?.menuSlug || "main";
  const primary =
    bootstrap.menus[headerMenuSlug] ?? bootstrap.menus["main"] ?? bootstrap.menus["primary"] ?? [];
  const footerMenu = bootstrap.menus["footer"] ?? [];
  const socialLinks: [string, string][] = Object.entries(settings.general.social ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  useEffect(() => {
    if (typeof window === "undefined" || settings.layout.headerStyle === "magazine") return;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 12 : y > 48));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [settings.layout.headerStyle]);

  return (
    <div className="site-root">
      {settings.layout.headerStyle === "magazine" ? <MagazineHeader bootstrap={bootstrap} items={primary} /> : <header className={`site-header${settings.layout.stickyHeader === false ? " site-header--static" : ""}${scrolled ? " is-scrolled" : ""}`}>
        <div className="site-container site-header-inner">
          <Link to="/" className="site-brand">
            {settings.branding.logoUrl || settings.branding.logoMobileUrl ? (
              <picture>
                {settings.branding.logoMobileUrl ? (
                  <source media="(max-width: 899px)" srcSet={settings.branding.logoMobileUrl} />
                ) : null}
                <img
                  src={settings.branding.logoUrl || settings.branding.logoMobileUrl}
                  alt={settings.general.siteName}
                />
              </picture>
            ) : (
              <span className="site-brand-text">{settings.general.siteName}</span>
            )}
          </Link>

          <nav className="site-nav" aria-label="Primary">
            <NavLinks items={primary} />
          </nav>

          <div className="site-header-actions">
            {settings.header?.showCta && settings.header.ctaLabel && settings.header.ctaUrl ? (
              <a className="site-button site-header-cta" href={settings.header.ctaUrl}>
                {settings.header.ctaLabel}
              </a>
            ) : null}
            {settings.header?.showSearch === false ? null : (
              <>
                <div className="site-header-search-desktop">
                  <SiteSearchBox placeholder="Search articles" />
                </div>
                <Link
                  to="/search"
                  search={{ q: "", page: 1 }}
                  className="site-icon-button site-header-search-mobile"
                  aria-label="Search"
                >
                  <Search size={20} />
                </Link>
              </>
            )}
            <button
              type="button"
              className="site-icon-button site-menu-toggle"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="site-mobile-nav">
            <NavLinks items={primary} onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
      </header>}

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="site-container site-footer-bar">
          <div className="site-footer-identity">
            {settings.branding.footerLogoUrl || settings.branding.logoUrl ? (
              <Link to="/" className="site-footer-logo">
                <img
                  src={settings.branding.footerLogoUrl || settings.branding.logoUrl}
                  alt={settings.general.siteName}
                />
              </Link>
            ) : (
              <p className="site-footer-brand">{settings.general.siteName}</p>
            )}
            {settings.footer?.description ? (
              <p className="site-footer-tagline">{settings.footer.description}</p>
            ) : null}
          </div>

          {settings.footer?.showMenu !== false && footerMenu.length ? (
            <nav className="site-footer-links" aria-label="Footer">
              <NavLinks items={footerMenu} />
            </nav>
          ) : null}

          {settings.footer?.showSocial !== false && socialLinks.length ? (
            <div className="site-footer-social">
              {socialLinks.map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noreferrer noopener">
                  {key}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="site-container site-footer-legal">
          <span>
            {settings.general.footerCopyright ||
              `© ${new Date().getFullYear()} ${settings.general.siteName}`}
          </span>
          {settings.general.rssEnabled ? <a href="/rss.xml">RSS</a> : null}
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
