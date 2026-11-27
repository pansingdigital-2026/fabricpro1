import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildSingleStepTickerTrack,
  clampTickerTipCenter,
  estimateTickerTipWidth,
  TICKER_HOLD_MS,
  TICKER_SET_SIZE,
} from "@/lib/tags-ticker";
import type { MenuItem, SiteBootstrap } from "@/lib/types";

export function MagazineHeader({ bootstrap, items }: { bootstrap: SiteBootstrap; items: MenuItem[] }) {
  const { settings, tags = [] } = bootstrap;
  const [open, setOpen] = useState(false);
  const selectedSlugs = settings.header.tagSlugs?.split(",").map((slug) => slug.trim()).filter(Boolean) ?? [];
  const visibleTags = useMemo(
    () =>
      selectedSlugs.length
        ? selectedSlugs.flatMap((slug) => tags.filter((tag) => tag.slug === slug))
        : tags,
    [selectedSlugs.join(","), tags],
  );
  const canCycle = visibleTags.length > TICKER_SET_SIZE;
  const trackItems = useMemo(
    () => buildSingleStepTickerTrack(visibleTags, TICKER_SET_SIZE),
    [visibleTags],
  );
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const topicsRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; left: number } | null>(null);

  function showTip(target: HTMLElement, label: string) {
    const host = topicsRef.current;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const center = rect.left + rect.width / 2 - hostRect.left;
    setTip({
      label,
      left: clampTickerTipCenter(center, hostRect.width, estimateTickerTipWidth(label)),
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setOffset(0);
    setAnimate(true);
  }, [visibleTags.length]);

  useEffect(() => {
    if (!canCycle || paused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setAnimate(true);
      setOffset((current) => (current >= visibleTags.length ? 1 : current + 1));
    }, TICKER_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [canCycle, paused, reducedMotion, offset, visibleTags.length]);

  const showTags = settings.header.showTags !== false && visibleTags.length > 0;
  const mobileLogoUrl = settings.branding.logoMobileUrl || settings.branding.logoUrl;
  const banner = settings.header.bannerUrl ? (
    <img src={settings.header.bannerUrl} alt="Advertisement" className="site-header-banner-image" />
  ) : null;

  function stepTags(direction: -1 | 1) {
    if (!canCycle) return;
    if (direction === 1) {
      setAnimate(!reducedMotion);
      setOffset((current) => (current >= visibleTags.length ? 1 : current + 1));
      return;
    }
    if (offset === 0) {
      setAnimate(!reducedMotion);
      setOffset(visibleTags.length - 1);
      return;
    }
    setAnimate(!reducedMotion);
    setOffset((current) => Math.max(0, current - 1));
  }

  function handleTrackTransitionEnd() {
    if (canCycle && offset >= visibleTags.length) {
      setAnimate(false);
      setOffset(0);
    }
  }

  const slotWidthPct = 100 / TICKER_SET_SIZE;

  return (
    <>
      {/* Normal sticky mobile header (logo, menu button, search button) */}
      <header className={`site-header site-header--mobile-only${settings.layout.stickyHeader ? "" : " site-header--static"}`}>
        <div className="site-container site-header-inner">
          <Link to="/" className="site-brand">
            {mobileLogoUrl ? (
              <img src={mobileLogoUrl} alt={settings.general.siteName} />
            ) : (
              <span className="site-brand-text">{settings.general.siteName}</span>
            )}
          </Link>
          <div className="site-header-actions">
            {settings.header.showSearch !== false ? (
              <Link
                to="/search"
                search={{ q: "", page: 1 }}
                className="site-icon-button site-header-search-mobile"
                aria-label="Search"
              >
                <Search size={20} />
              </Link>
            ) : null}
            <button
              type="button"
              className="site-icon-button site-menu-toggle"
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="magazine-mobile-menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open ? (
          <nav id="magazine-mobile-menu" className="site-mobile-nav" aria-label="Mobile primary">
            {items.map((item) => (
              <a key={item.id} href={item.url} target={item.target === "_blank" ? "_blank" : undefined} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} className="site-nav-link" onClick={() => setOpen(false)}>{item.label}</a>
            ))}
          </nav>
        ) : null}
      </header>

      {/* Desktop masthead (scrolls away naturally when scrolling down) */}
      <div className="site-masthead-bar">
        <div className="site-container site-masthead">
          <Link to="/" className="site-brand site-masthead-brand">
            {settings.branding.logoUrl ? (
              <img src={settings.branding.logoUrl} alt={settings.general.siteName} />
            ) : <span className="site-brand-text">{settings.general.siteName}</span>}
          </Link>
          <div className="site-header-banner">
            {banner && settings.header.bannerLink ? (
              <a href={settings.header.bannerLink} target="_blank" rel="noopener noreferrer">{banner}</a>
            ) : banner}
          </div>
        </div>
      </div>

      {/* Desktop slim sticky menu bar (stays pinned on scroll) */}
      <header className={`site-menu-band${settings.layout.stickyHeader ? " site-menu-band--sticky" : ""}`}>
        <div className="site-container site-menu-band-inner">
          <nav className="site-magazine-nav" aria-label="Primary">
            {items.map((item) => (
              <a key={item.id} href={item.url} target={item.target === "_blank" ? "_blank" : undefined} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} className="site-nav-link">{item.label}</a>
            ))}
          </nav>
          {settings.header.showSearch !== false ? (
            <Button asChild variant="ghost" size="icon" className="site-magazine-search">
              <Link to="/search" search={{ q: "", page: 1 }} aria-label="Search" title="Search articles"><Search /></Link>
            </Button>
          ) : null}
          {showTags ? (
            <div
              className="site-header-topics"
              ref={topicsRef}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            >
              <div className="site-header-tag-viewport" aria-label="Topics" role="navigation">
                <div
                  className={`site-header-tag-track${animate && !reducedMotion ? " is-animated" : ""}${canCycle ? "" : " is-static"}`}
                  style={{ transform: canCycle ? `translate3d(-${offset * slotWidthPct}%, 0, 0)` : undefined }}
                  onTransitionEnd={handleTrackTransitionEnd}
                >
                  {trackItems.map((tag, idx) => {
                    const isVisible = canCycle
                      ? idx >= offset && idx < offset + TICKER_SET_SIZE
                      : true;
                    const isLastVisible = canCycle
                      ? idx === offset + TICKER_SET_SIZE - 1
                      : idx === trackItems.length - 1;
                    const label = `#${tag.name.replace(/^#/, "")}`;
                    return (
                      <div
                        key={`${idx}-${tag.id}`}
                        className={`site-header-tag-slot${isLastVisible ? " is-last-visible" : ""}`}
                        aria-hidden={!isVisible}
                      >
                        <Link
                          to="/tag/$slug"
                          params={{ slug: tag.slug }}
                          search={{ page: 1 }}
                          className="site-header-tag"
                          tabIndex={isVisible ? 0 : -1}
                          onMouseEnter={(event) => showTip(event.currentTarget, label)}
                          onMouseLeave={() => setTip(null)}
                          onFocus={(event) => showTip(event.currentTarget, label)}
                          onBlur={() => setTip(null)}
                        >
                          {label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
              {canCycle ? (
                <div className="site-topic-controls">
                  <Button variant="ghost" size="icon" className="site-topic-arrow" aria-label="Previous tags" title="Previous tags" onClick={() => stepTags(-1)}><ChevronLeft /></Button>
                  <Button variant="ghost" size="icon" className="site-topic-arrow" aria-label="Next tags" title="Next tags" onClick={() => stepTags(1)}><ChevronRight /></Button>
                </div>
              ) : null}
              {tip ? (
                <span className="site-header-tag-tip" style={{ left: `${tip.left}px` }} aria-hidden="true">
                  {tip.label}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}