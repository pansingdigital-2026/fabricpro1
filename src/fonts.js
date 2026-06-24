export const fontPresets = {
  gilroy: {
    label: "Gilroy / Avenir",
    stack: "Gilroy, 'Avenir Next', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  system: {
    label: "System sans serif",
    stack: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  roboto: {
    label: "Roboto (all weights)",
    stack: "Roboto, Arial, sans-serif",
    google: "Roboto:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,700;1,900"
  },
  "roboto-condensed": {
    label: "Roboto Condensed (all weights)",
    stack: "'Roboto Condensed', 'Arial Narrow', Arial, sans-serif",
    google: "Roboto+Condensed:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,700;1,900"
  },
  "roboto-slab": {
    label: "Roboto Slab (all weights)",
    stack: "'Roboto Slab', Georgia, serif",
    google: "Roboto+Slab:wght@100;200;300;400;500;600;700;800;900"
  },
  "roboto-mono": {
    label: "Roboto Mono (all weights)",
    stack: "'Roboto Mono', 'SFMono-Regular', Consolas, monospace",
    google: "Roboto+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,700"
  },
  "roboto-serif": {
    label: "Roboto Serif (all weights)",
    stack: "'Roboto Serif', Georgia, serif",
    google: "Roboto+Serif:opsz,wght@8..144,100..900"
  },
  "roboto-flex": {
    label: "Roboto Flex (variable)",
    stack: "'Roboto Flex', Roboto, Arial, sans-serif",
    google: "Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000"
  },
  "segoe-ui": {
    label: "Segoe UI",
    stack: "'Segoe UI', SegoeUI, Arial, sans-serif"
  },
  "segoe-variable": {
    label: "Segoe UI Variable",
    stack: "'Segoe UI Variable', 'Segoe UI', SegoeUI, Arial, sans-serif"
  },
  "segoe-display": {
    label: "Segoe UI Display",
    stack: "'Segoe UI Display', 'Segoe UI', SegoeUI, Arial, sans-serif"
  },
  "segoe-print": {
    label: "Segoe Print",
    stack: "'Segoe Print', 'Segoe UI', cursive"
  },
  "segoe-script": {
    label: "Segoe Script",
    stack: "'Segoe Script', 'Segoe UI', cursive"
  },
  custom: {
    label: "Custom font stack",
    stack: ""
  }
};

export function safeFontStack(value = "") {
  return String(value).replace(/[;{}<>]/g, "").trim();
}

export function fontStackFor(key = "gilroy", customStack = "") {
  if (key === "custom") return safeFontStack(customStack) || fontPresets.gilroy.stack;
  return fontPresets[key]?.stack || fontPresets.gilroy.stack;
}

export function fontOptions({ includeGlobal = false, includeCustom = true } = {}) {
  const options = includeGlobal ? [{ key: "global", label: "Use global font" }] : [];
  return [
    ...options,
    ...Object.entries(fontPresets)
      .filter(([key]) => includeCustom || key !== "custom")
      .map(([key, preset]) => ({ key, label: preset.label }))
  ];
}

export function googleFontUrl(keys = []) {
  const families = [...new Set(keys)]
    .map((key) => fontPresets[key]?.google)
    .filter(Boolean);
  if (!families.length) return "";
  return `https://fonts.googleapis.com/css2?${families.map((family) => `family=${family}`).join("&")}&display=swap`;
}

export function fontHeadTags(settings = {}) {
  const typographyFonts = Object.values(settings.typography || {}).map((item) => item?.font);
  const url = googleFontUrl([settings.fontPreset || "gilroy", ...typographyFonts]
    .filter((key) => key && key !== "global" && key !== "custom"));
  if (!url) return "";
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${url.replaceAll("&", "&amp;")}">`;
}
