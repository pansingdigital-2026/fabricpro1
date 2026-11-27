import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/MediaPicker";
import {
  Btn,
  Field,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import { db as supabase } from "@/lib/db/client";
import { saveSettingsGroup } from "@/lib/admin/api";
import { DEFAULT_SETTINGS, FONT_CHOICES, mergeSettings } from "@/lib/defaults";
import type { SiteSettings } from "@/lib/types";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const TABS = [
  "general",
  "branding",
  "colors",
  "typography",
  "layout",
  "header",
  "footer",
  "article",
  "seo",
  "ads",
  "newsletter",
  "contact",
] as const;

type Tab = (typeof TABS)[number];

function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "site_settings"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("site_settings").select("key, value");
      if (error) throw new Error(error.message);
      return mergeSettings((rows ?? []) as { key: string; value: unknown }[]);
    },
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  function patch<K extends Tab>(group: K, value: Partial<SiteSettings[K]>) {
    setSettings((s) => ({ ...s, [group]: { ...s[group], ...value } }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSettingsGroup(tab, settings[tab]);
      if (tab === "header") await saveSettingsGroup("layout", settings.layout);
      void qc.invalidateQueries({ queryKey: ["admin", "site_settings"] });
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Panel
        title={`${tab[0]?.toUpperCase()}${tab.slice(1)} settings`}
        actions={
          <Btn disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save section"}
          </Btn>
        }
      >
        {tab === "general" ? <GeneralTab s={settings} patch={patch} /> : null}
        {tab === "branding" ? <BrandingTab s={settings} patch={patch} /> : null}
        {tab === "colors" ? <ColorsTab s={settings} patch={patch} /> : null}
        {tab === "typography" ? <TypographyTab s={settings} patch={patch} /> : null}
        {tab === "layout" ? <LayoutTab s={settings} patch={patch} /> : null}
        {tab === "header" ? <HeaderTab s={settings} patch={patch} /> : null}
        {tab === "footer" ? <FooterTab s={settings} patch={patch} /> : null}
        {tab === "article" ? <ArticleTab s={settings} patch={patch} /> : null}
        {tab === "seo" ? <SeoTab s={settings} patch={patch} /> : null}
        {tab === "ads" ? <AdsTab s={settings} patch={patch} /> : null}
        {tab === "newsletter" ? <NewsletterTab s={settings} patch={patch} /> : null}
        {tab === "contact" ? <ContactTab s={settings} patch={patch} /> : null}
      </Panel>
    </div>
  );
}

type Patch = <K extends Tab>(group: K, value: Partial<SiteSettings[K]>) => void;
interface TabProps {
  s: SiteSettings;
  patch: Patch;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-input bg-background"
        />
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

function GeneralTab({ s, patch }: TabProps) {
  const g = s.general;
  return (
    <Grid>
      <Field label="Site name">
        <TextInput value={g.siteName} onChange={(e) => patch("general", { siteName: e.target.value })} />
      </Field>
      <Field label="Tagline">
        <TextInput value={g.tagline} onChange={(e) => patch("general", { tagline: e.target.value })} />
      </Field>
      <Field label="Site URL" hint="Used for canonicals, RSS and sitemap.">
        <TextInput value={g.siteUrl} onChange={(e) => patch("general", { siteUrl: e.target.value })} />
      </Field>
      <Field label="Contact email">
        <TextInput
          value={g.contactEmail}
          onChange={(e) => patch("general", { contactEmail: e.target.value })}
        />
      </Field>
      <NumberField
        label="Posts per page"
        value={g.postsPerPage}
        onChange={(v) => patch("general", { postsPerPage: v })}
      />
      <Field label="Date format">
        <TextInput
          value={g.dateFormat}
          onChange={(e) => patch("general", { dateFormat: e.target.value })}
        />
      </Field>
      <Field label="Footer copyright" className="sm:col-span-2">
        <TextInput
          value={g.footerCopyright}
          onChange={(e) => patch("general", { footerCopyright: e.target.value })}
        />
      </Field>
      <Field label="GA4 measurement ID">
        <TextInput
          value={g.analytics.ga4}
          onChange={(e) =>
            patch("general", { analytics: { ...g.analytics, ga4: e.target.value } })
          }
        />
      </Field>
      <Field label="Google Tag Manager ID">
        <TextInput
          value={g.analytics.gtm}
          onChange={(e) =>
            patch("general", { analytics: { ...g.analytics, gtm: e.target.value } })
          }
        />
      </Field>
      <Field label="Search Console verification">
        <TextInput
          value={g.analytics.searchConsole}
          onChange={(e) =>
            patch("general", { analytics: { ...g.analytics, searchConsole: e.target.value } })
          }
        />
      </Field>
      <Toggle
        label="Enable RSS feed"
        checked={g.rssEnabled}
        onChange={(v) => patch("general", { rssEnabled: v })}
      />
      <div className="sm:col-span-2 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Article share icons
        </p>
        <Grid>
          {(["instagram", "linkedin", "email", "x", "facebook"] as const).map((key) => (
            <Toggle
              key={key}
              label={`Show ${key}`}
              checked={g.shareIcons?.[key] ?? ["instagram", "linkedin", "email"].includes(key)}
              onChange={(v) =>
                patch("general", { shareIcons: { ...(g.shareIcons ?? {}), [key]: v } })
              }
            />
          ))}
        </Grid>
      </div>
      <div className="sm:col-span-2 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Social profiles
        </p>
        <Grid>
          {["x", "facebook", "instagram", "linkedin", "youtube", "threads"].map((key) => (
            <Field key={key} label={key}>
              <TextInput
                value={g.social[key] ?? ""}
                onChange={(e) =>
                  patch("general", { social: { ...g.social, [key]: e.target.value } })
                }
              />
            </Field>
          ))}
        </Grid>
      </div>
    </Grid>
  );
}

function BrandingTab({ s, patch }: TabProps) {
  const b = s.branding;
  return (
    <Grid>
      <MediaPicker label="Header logo" defaultFolder="branding" value={b.logoUrl} onChange={(v) => patch("branding", { logoUrl: v })} />
      <MediaPicker
        label="Footer logo"
        defaultFolder="branding"
        value={b.footerLogoUrl ?? ""}
        onChange={(v) => patch("branding", { footerLogoUrl: v })}
      />
      <MediaPicker
        label="Dark logo"
        defaultFolder="branding"
        value={b.logoDarkUrl}
        onChange={(v) => patch("branding", { logoDarkUrl: v })}
      />
      <MediaPicker
        label="Mobile logo"
        defaultFolder="branding"
        value={b.logoMobileUrl}
        onChange={(v) => patch("branding", { logoMobileUrl: v })}
      />
      <MediaPicker
        label="Favicon"
        defaultFolder="branding"
        value={b.faviconUrl}
        onChange={(v) => patch("branding", { faviconUrl: v })}
      />
      <MediaPicker
        label="Default share image"
        defaultFolder="branding"
        value={b.defaultShareImage}
        onChange={(v) => patch("branding", { defaultShareImage: v })}
      />
    </Grid>
  );
}

function ColorsTab({ s, patch }: TabProps) {
  const c = s.colors;
  const keys: [keyof typeof c, string][] = [
    ["primary", "Primary"],
    ["secondary", "Secondary"],
    ["accent", "Accent"],
    ["text", "Body text"],
    ["heading", "Headings"],
    ["link", "Links"],
    ["pageBg", "Page background"],
    ["headerTopBg", "Header top bar (logo area)"],
    ["headerBg", "Header / menu bar background"],
    ["headerLink", "Header / navigation links"],
    ["headerLinkHover", "Header links (hover)"],
    ["footerBg", "Footer background"],
    ["border", "Borders"],
    ["cardBg", "Article card background"],
    ["cardBorder", "Article card border"],
  ];
  const gradientKeys: [keyof typeof c, string][] = [
    ["gradientA", "Gradient colour 1 (top left)"],
    ["gradientB", "Gradient colour 2 (top right)"],
    ["gradientC", "Gradient colour 3 (bottom)"],
  ];
  return (
    <div className="grid gap-6">
      <Grid>
        {keys.map(([key, label]) => (
          <ColorField
            key={key}
            label={label}
            value={String(c[key] ?? "#000000")}
            onChange={(v) => patch("colors", { [key]: v } as Partial<typeof c>)}
          />
        ))}
      </Grid>
      <Panel title="Homepage ambient gradient">
        <Grid>
          <Toggle
            label="Enable gradient"
            checked={c.gradientEnabled !== false}
            onChange={(v) => patch("colors", { gradientEnabled: v } as Partial<typeof c>)}
          />
          {gradientKeys.map(([key, label]) => (
            <ColorField
              key={key}
              label={label}
              value={String(c[key] ?? "#ffffff")}
              onChange={(v) => patch("colors", { [key]: v } as Partial<typeof c>)}
            />
          ))}
          <Field label="Gradient intensity (%)">
            <TextInput
              type="number"
              min={0}
              max={100}
              value={String(c.gradientStrength ?? 22)}
              onChange={(e) =>
                patch("colors", { gradientStrength: Number(e.target.value) } as Partial<typeof c>)
              }
            />
          </Field>
        </Grid>
      </Panel>
    </div>
  );
}

function TypographyTab({ s, patch }: TabProps) {
  const t = s.typography;
  const fonts: [keyof typeof t, string][] = [
    ["headingFont", "Heading font"],
    ["bodyFont", "Body font"],
    ["navFont", "Navigation font"],
    ["articleFont", "Article font"],
  ];
  const m = t.mobile ?? DEFAULT_SETTINGS.typography.mobile!;
  const mobileFields: [keyof typeof m, string, number][] = [
    ["baseSize", "Mobile base size (px)", 1],
    ["articleSize", "Mobile article text (px)", 1],
    ["h1Size", "Mobile H1 (px)", 1],
    ["h2Size", "Mobile H2 (px)", 1],
    ["h3Size", "Mobile H3 (px)", 1],
    ["lineHeight", "Mobile line height", 0.05],
  ];
  return (
    <div className="grid gap-6">
    <Grid>

      {fonts.map(([key, label]) => (
        <Field key={key} label={label}>
          <SelectInput
            value={String(t[key])}
            onChange={(e) => patch("typography", { [key]: e.target.value } as Partial<typeof t>)}
          >
            {FONT_CHOICES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </SelectInput>
        </Field>
      ))}
      <NumberField
        label="Navigation weight (boldness)"
        step={100}
        value={t.navWeight ?? 500}
        onChange={(v) => patch("typography", { navWeight: v })}
      />
      <NumberField
        label="Navigation size (px)"
        value={t.navSize ?? 15}
        onChange={(v) => patch("typography", { navSize: v })}
      />
      <NumberField
        label="Base font size (px)"
        value={t.baseSize}
        onChange={(v) => patch("typography", { baseSize: v })}
      />
      <NumberField
        label="Heading scale"
        step={0.01}
        value={t.headingScale}
        onChange={(v) => patch("typography", { headingScale: v })}
      />
      <NumberField
        label="Heading weight"
        step={100}
        value={t.headingWeight}
        onChange={(v) => patch("typography", { headingWeight: v })}
      />
      <NumberField
        label="Body weight"
        step={100}
        value={t.bodyWeight}
        onChange={(v) => patch("typography", { bodyWeight: v })}
      />
      <NumberField
        label="Line height"
        step={0.05}
        value={t.lineHeight}
        onChange={(v) => patch("typography", { lineHeight: v })}
      />
      <NumberField
        label="Letter spacing (px)"
        step={0.01}
        value={t.letterSpacing}
        onChange={(v) => patch("typography", { letterSpacing: v })}
      />
    </Grid>
    <Panel title="Mobile typography (screens under 768px)">
      <Grid>
        {mobileFields.map(([key, label, step]) => (
          <NumberField
            key={key}
            label={label}
            step={step}
            value={Number(m[key])}
            onChange={(v) => patch("typography", { mobile: { ...m, [key]: v } })}
          />
        ))}
      </Grid>
    </Panel>
    </div>
  );

}

function LayoutTab({ s, patch }: TabProps) {
  const l = s.layout;
  return (
    <Grid>
      <NumberField
        label="Site max width (px)"
        value={l.siteMaxWidth}
        onChange={(v) => patch("layout", { siteMaxWidth: v })}
      />
      <NumberField
        label="Article width (px)"
        value={l.articleWidth}
        onChange={(v) => patch("layout", { articleWidth: v })}
      />
      <NumberField
        label="Sidebar width (px)"
        value={l.sidebarWidth}
        onChange={(v) => patch("layout", { sidebarWidth: v })}
      />
      <Field label="Header style">
        <SelectInput
          value={l.headerStyle}
          onChange={(e) =>
            patch("layout", { headerStyle: e.target.value as typeof l.headerStyle })
          }
        >
          <option value="classic">Classic</option>
          <option value="centered">Centered</option>
          <option value="compact">Compact</option>
          <option value="magazine">Magazine — logo above menu, search and tags</option>
        </SelectInput>
      </Field>
      <NumberField
        label="Header height (px)"
        value={l.headerHeight}
        onChange={(v) => patch("layout", { headerHeight: v })}
      />
      <Field label="Card style">
        <SelectInput
          value={l.cardStyle}
          onChange={(e) => patch("layout", { cardStyle: e.target.value as typeof l.cardStyle })}
        >
          <option value="bordered">Bordered</option>
          <option value="plain">Plain</option>
          <option value="elevated">Elevated</option>
        </SelectInput>
      </Field>
      <NumberField
        label="Corner radius (px)"
        value={l.radius}
        onChange={(v) => patch("layout", { radius: v })}
      />
      <Field label="Shadow">
        <SelectInput
          value={l.shadow}
          onChange={(e) => patch("layout", { shadow: e.target.value as typeof l.shadow })}
        >
          <option value="none">None</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
        </SelectInput>
      </Field>
      <NumberField
        label="Section spacing (px)"
        value={l.sectionSpacing}
        onChange={(v) => patch("layout", { sectionSpacing: v })}
      />
      <NumberField
        label="Grid gap (px)"
        value={l.gridGap}
        onChange={(v) => patch("layout", { gridGap: v })}
      />
      <Toggle
        label="Sticky header"
        checked={l.stickyHeader}
        onChange={(v) => patch("layout", { stickyHeader: v })}
      />
    </Grid>
  );
}

function HeaderTab({ s, patch }: TabProps) {
  const h = s.header;
  return (
    <Grid>
      <Field label="Header style">
        <SelectInput value={s.layout.headerStyle} onChange={(e) => patch("layout", { headerStyle: e.target.value as SiteSettings["layout"]["headerStyle"] })}>
          <option value="classic">Classic</option>
          <option value="centered">Centered</option>
          <option value="compact">Compact</option>
          <option value="magazine">Magazine — logo above menu, search and tags</option>
        </SelectInput>
      </Field>
      {s.layout.headerStyle === "magazine" ? <>
        <Toggle label="Show tags in menu bar" checked={h.showTags !== false} onChange={(v) => patch("header", { showTags: v })} />
        <Field label="Tag slugs (comma-separated, blank for all tags)">
          <TextInput value={h.tagSlugs ?? ""} onChange={(e) => patch("header", { tagSlugs: e.target.value })} />
        </Field>
        <MediaPicker label="Header advertising banner (optional)" defaultFolder="branding" value={h.bannerUrl ?? ""} onChange={(v) => patch("header", { bannerUrl: v })} />
        <Field label="Advertising banner link">
          <TextInput value={h.bannerLink ?? ""} onChange={(e) => patch("header", { bannerLink: e.target.value })} />
        </Field>
      </> : null}
      <Field label="Menu slug">
        <TextInput value={h.menuSlug} onChange={(e) => patch("header", { menuSlug: e.target.value })} />
      </Field>
      <Field label="CTA label">
        <TextInput value={h.ctaLabel} onChange={(e) => patch("header", { ctaLabel: e.target.value })} />
      </Field>
      <Field label="CTA URL">
        <TextInput value={h.ctaUrl} onChange={(e) => patch("header", { ctaUrl: e.target.value })} />
      </Field>
      <Toggle label="Show header" checked={h.visible} onChange={(v) => patch("header", { visible: v })} />
      <Toggle
        label="Show search"
        checked={h.showSearch}
        onChange={(v) => patch("header", { showSearch: v })}
      />
      <Toggle
        label="Show social icons"
        checked={h.showSocial}
        onChange={(v) => patch("header", { showSocial: v })}
      />
      <Toggle label="Show CTA button" checked={h.showCta} onChange={(v) => patch("header", { showCta: v })} />
    </Grid>
  );
}

function FooterTab({ s, patch }: TabProps) {
  const f = s.footer;
  return (
    <Grid>
      <Field label="Footer description" className="sm:col-span-2">
        <TextArea
          value={f.description}
          onChange={(e) => patch("footer", { description: e.target.value })}
        />
      </Field>
      <Field label="Contact details" className="sm:col-span-2">
        <TextArea
          value={f.contactDetails}
          onChange={(e) => patch("footer", { contactDetails: e.target.value })}
        />
      </Field>
      <Toggle label="Show logo" checked={f.showLogo} onChange={(v) => patch("footer", { showLogo: v })} />
      <Toggle label="Show menu" checked={f.showMenu} onChange={(v) => patch("footer", { showMenu: v })} />
      <Toggle
        label="Show social"
        checked={f.showSocial}
        onChange={(v) => patch("footer", { showSocial: v })}
      />
      <Toggle
        label="Show newsletter"
        checked={f.showNewsletter}
        onChange={(v) => patch("footer", { showNewsletter: v })}
      />
    </Grid>
  );
}

function ArticleTab({ s, patch }: TabProps) {
  const a = s.article;
  const keys = Object.keys(a) as (keyof typeof a)[];
  return (
    <Grid>
      {keys.map((key) => (
        <Toggle
          key={key}
          label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
          checked={a[key]}
          onChange={(v) => patch("article", { [key]: v } as Partial<typeof a>)}
        />
      ))}
    </Grid>
  );
}

function SeoTab({ s, patch }: TabProps) {
  const seo = s.seo;
  return (
    <Grid>
      <Field label="Title template" hint="Use %s for the page title and %site% for the site name.">
        <TextInput
          value={seo.defaultTitleTemplate}
          onChange={(e) => patch("seo", { defaultTitleTemplate: e.target.value })}
        />
      </Field>
      <Field label="Twitter handle">
        <TextInput
          value={seo.twitterHandle}
          onChange={(e) => patch("seo", { twitterHandle: e.target.value })}
        />
      </Field>
      <Field label="Default meta description" className="sm:col-span-2">
        <TextArea
          value={seo.defaultDescription}
          onChange={(e) => patch("seo", { defaultDescription: e.target.value })}
        />
      </Field>
      <Field label="Organisation name">
        <TextInput
          value={seo.organizationName}
          onChange={(e) => patch("seo", { organizationName: e.target.value })}
        />
      </Field>
      <MediaPicker
        label="Organisation logo"
        defaultFolder="branding"
        value={seo.organizationLogo}
        onChange={(v) => patch("seo", { organizationLogo: v })}
      />
      <MediaPicker
        label="Default share image"
        defaultFolder="branding"
        value={seo.defaultOgImage}
        onChange={(v) => patch("seo", { defaultOgImage: v })}
      />
      <Toggle
        label="Allow search engines to index this site"
        checked={seo.indexSite}
        onChange={(v) => patch("seo", { indexSite: v })}
      />
    </Grid>
  );
}

function AdsTab({ s, patch }: TabProps) {
  const ads = s.ads;
  return (
    <div className="space-y-4">
      {Object.entries(ads).map(([slot, cfg]) => (
        <div key={slot} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold capitalize text-foreground">
              {slot.replace(/([A-Z])/g, " $1")}
            </p>
            <Toggle
              label="Enabled"
              checked={cfg.enabled}
              onChange={(v) => patch("ads", { [slot]: { ...cfg, enabled: v } })}
            />
          </div>
          <TextArea
            rows={3}
            placeholder="Ad embed code"
            value={cfg.code}
            onChange={(e) => patch("ads", { [slot]: { ...cfg, code: e.target.value } })}
          />
          <div className="mt-2 flex gap-4">
            <Toggle
              label="Desktop"
              checked={cfg.desktop}
              onChange={(v) => patch("ads", { [slot]: { ...cfg, desktop: v } })}
            />
            <Toggle
              label="Mobile"
              checked={cfg.mobile}
              onChange={(v) => patch("ads", { [slot]: { ...cfg, mobile: v } })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsletterTab({ s, patch }: TabProps) {
  const n = s.newsletter;
  return (
    <Grid>
      <Field label="Provider">
        <SelectInput
          value={n.provider}
          onChange={(e) => patch("newsletter", { provider: e.target.value })}
        >
          <option value="database">Store in database</option>
          <option value="external">External endpoint</option>
        </SelectInput>
      </Field>
      <Field label="External endpoint">
        <TextInput
          value={n.endpoint}
          onChange={(e) => patch("newsletter", { endpoint: e.target.value })}
        />
      </Field>
      <Field label="Heading">
        <TextInput value={n.heading} onChange={(e) => patch("newsletter", { heading: e.target.value })} />
      </Field>
      <Field label="Button label">
        <TextInput
          value={n.buttonLabel}
          onChange={(e) => patch("newsletter", { buttonLabel: e.target.value })}
        />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <TextArea
          value={n.description}
          onChange={(e) => patch("newsletter", { description: e.target.value })}
        />
      </Field>
    </Grid>
  );
}

function ContactTab({ s, patch }: TabProps) {
  const c = s.contact;
  return (
    <Grid>
      <Field label="Heading">
        <TextInput value={c.heading} onChange={(e) => patch("contact", { heading: e.target.value })} />
      </Field>
      <Field label="Success message">
        <TextInput
          value={c.successMessage}
          onChange={(e) => patch("contact", { successMessage: e.target.value })}
        />
      </Field>
      <Field label="Intro" className="sm:col-span-2">
        <TextArea value={c.intro} onChange={(e) => patch("contact", { intro: e.target.value })} />
      </Field>
    </Grid>
  );
}
