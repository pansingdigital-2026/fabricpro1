import { slugify } from "./format";

export const MAX_ARTICLE_TAGS = 4;

export interface ApprovedCategory {
  name: string;
  slug: string;
  description: string;
  position: number;
}

export interface ApprovedTag {
  name: string;
  slug: string;
  categorySlug: string;
}

export const APPROVED_CATEGORIES: readonly ApprovedCategory[] = [
  {
    name: "Textile Industry",
    slug: "textile-industry",
    description: "Global textile market updates, mill expansions, trade shifts and business coverage",
    position: 0,
  },
  {
    name: "Textile Machinery",
    slug: "textile-machinery",
    description: "Weaving, knitting, spinning, automation, sensors and mill equipment upgrades",
    position: 1,
  },
  {
    name: "Sustainable Fabrics",
    slug: "sustainable-fabrics",
    description: "Lower-impact fibers, certified materials, eco-sourcing and sustainability claims",
    position: 2,
  },
  {
    name: "Textile Recycling",
    slug: "textile-recycling",
    description: "Circular textiles, fiber sorting, feedstock quality and mechanical or chemical recovery",
    position: 3,
  },
  {
    name: "Fabric Manufacturing",
    slug: "fabric-manufacturing",
    description: "Mill operations, weaving, knitting, quality control, energy efficiency and output",
    position: 4,
  },
  {
    name: "Apparel Materials",
    slug: "apparel-materials",
    description: "Garment fabrics, yarns, performance blends, trims and end-use material selection",
    position: 5,
  },
  {
    name: "Technical Textiles",
    slug: "technical-textiles",
    description: "Industrial, medical, protective, geotextile, automotive and nonwovens materials",
    position: 6,
  },
  {
    name: "Smart Textiles",
    slug: "smart-textiles",
    description: "Conductive fabrics, wearable sensors, electronic textiles and functional coatings",
    position: 7,
  },
  {
    name: "Dyeing and Finishing",
    slug: "dyeing-and-finishing",
    description: "Coloration, waterless dyeing, chemical management, coatings and wet processing",
    position: 8,
  },
  {
    name: "Supply Chain and Sourcing",
    slug: "supply-chain-and-sourcing",
    description: "Regional sourcing shifts, China+1 strategies, supplier qualification and traceability",
    position: 9,
  },
  {
    name: "Textile Exports",
    slug: "textile-exports",
    description: "Export hubs, trade agreements, tariffs, shipping corridors and global apparel trade",
    position: 10,
  },
  {
    name: "Policy and Regulations",
    slug: "policy-and-regulations",
    description: "Compliance, EPR rules, digital product passports, labor standards and trade policy",
    position: 11,
  },
] as const;

export const APPROVED_TAGS: readonly ApprovedTag[] = [
  // Textile Industry & Exports
  { name: "Textile Industry", slug: "textile-industry", categorySlug: "textile-industry" },
  { name: "Textile Exports", slug: "textile-exports", categorySlug: "textile-exports" },
  { name: "China+1 Sourcing", slug: "china-plus-one", categorySlug: "supply-chain-and-sourcing" },
  { name: "Trade Policy", slug: "trade-policy", categorySlug: "policy-and-regulations" },
  // Textile Machinery & Manufacturing
  { name: "Textile Machinery", slug: "textile-machinery", categorySlug: "textile-machinery" },
  { name: "Fabric Manufacturing", slug: "fabric-manufacturing", categorySlug: "fabric-manufacturing" },
  { name: "Weaving", slug: "weaving", categorySlug: "textile-machinery" },
  { name: "Knitting", slug: "knitting", categorySlug: "textile-machinery" },
  { name: "Spinning", slug: "spinning", categorySlug: "fabric-manufacturing" },
  { name: "Automation", slug: "automation", categorySlug: "textile-machinery" },
  { name: "Energy Monitoring", slug: "energy-monitoring", categorySlug: "fabric-manufacturing" },
  { name: "Mill Operations", slug: "mill-operations", categorySlug: "fabric-manufacturing" },
  // Sustainable Fabrics & Recycling
  { name: "Sustainable Fabrics", slug: "sustainable-fabrics", categorySlug: "sustainable-fabrics" },
  { name: "Textile Recycling", slug: "textile-recycling", categorySlug: "textile-recycling" },
  { name: "Recycled Textiles", slug: "recycled-textiles", categorySlug: "textile-recycling" },
  { name: "Recycled Polyester", slug: "recycled-polyester", categorySlug: "sustainable-fabrics" },
  { name: "Circular Textiles", slug: "circular-textiles", categorySlug: "textile-recycling" },
  { name: "Fiber Sorting", slug: "fiber-sorting", categorySlug: "textile-recycling" },
  { name: "Feedstock", slug: "feedstock", categorySlug: "textile-recycling" },
  { name: "Certification", slug: "certification", categorySlug: "sustainable-fabrics" },
  { name: "Bio-Based Fibers", slug: "bio-based-fibers", categorySlug: "sustainable-fabrics" },
  // Apparel, Technical & Smart Textiles
  { name: "Apparel Materials", slug: "apparel-materials", categorySlug: "apparel-materials" },
  { name: "Technical Textiles", slug: "technical-textiles", categorySlug: "technical-textiles" },
  { name: "Smart Textiles", slug: "smart-textiles", categorySlug: "smart-textiles" },
  { name: "Performance Fabrics", slug: "performance-fabrics", categorySlug: "apparel-materials" },
  { name: "Cotton", slug: "cotton", categorySlug: "apparel-materials" },
  { name: "Nonwovens", slug: "nonwovens", categorySlug: "technical-textiles" },
  // Dyeing, Sourcing & Compliance
  { name: "Dyeing and Finishing", slug: "dyeing-and-finishing", categorySlug: "dyeing-and-finishing" },
  { name: "Sourcing", slug: "sourcing", categorySlug: "supply-chain-and-sourcing" },
  { name: "Traceability", slug: "traceability", categorySlug: "supply-chain-and-sourcing" },
  { name: "Digital Product Passports", slug: "digital-product-passports", categorySlug: "policy-and-regulations" },
  { name: "Compliance", slug: "compliance", categorySlug: "policy-and-regulations" },
] as const;

export const APPROVED_CATEGORY_BY_SLUG = new Map<string, ApprovedCategory>(
  APPROVED_CATEGORIES.map((c) => [c.slug, c]),
);
export const APPROVED_TAG_BY_SLUG = new Map<string, ApprovedTag>(
  APPROVED_TAGS.map((t) => [t.slug, t]),
);
export const APPROVED_CATEGORY_SLUGS = new Set(APPROVED_CATEGORIES.map((c) => c.slug));
export const APPROVED_TAG_SLUGS = new Set(APPROVED_TAGS.map((t) => t.slug));

/** Legacy/synonym category slugs mapped cleanly onto the 12 approved Fabric-Pro categories. */
const CATEGORY_ALIAS_MAP: Record<string, string> = {
  machinery: "textile-machinery",
  sustainability: "sustainable-fabrics",
  recycling: "textile-recycling",
  manufacturing: "fabric-manufacturing",
  apparel: "apparel-materials",
  sourcing: "supply-chain-and-sourcing",
  "supply-chain": "supply-chain-and-sourcing",
  exports: "textile-exports",
  policy: "policy-and-regulations",
  regulations: "policy-and-regulations",
  dyeing: "dyeing-and-finishing",
  finishing: "dyeing-and-finishing",
};

/** Legacy/synonym tag slugs mapped cleanly onto the 32 approved Fabric-Pro tags. */
const TAG_ALIAS_MAP: Record<string, string> = {
  rpet: "recycled-polyester",
  "recycled-pet": "recycled-polyester",
  circularity: "circular-textiles",
  dpp: "digital-product-passports",
  "digital-product-passport": "digital-product-passports",
  certifications: "certification",
  "supply-chain": "sourcing",
  "china-1": "china-plus-one",
  "energy-efficiency": "energy-monitoring",
  "wet-processing": "dyeing-and-finishing",
  "garment-manufacturing": "fabric-manufacturing",
};

/** Curated taxonomy assignments for the initial published articles on fabric-pro.com. */
export const PUBLISHED_ARTICLE_TAXONOMY: Record<
  string,
  { categorySlug: string; tagSlugs: readonly string[] }
> = {
  "automated-weaving-lines-boost-output": {
    categorySlug: "textile-machinery",
    tagSlugs: ["textile-machinery", "weaving", "automation", "fabric-manufacturing"],
  },
  "energy-monitoring-textile-mills": {
    categorySlug: "textile-machinery",
    tagSlugs: ["textile-machinery", "energy-monitoring", "fabric-manufacturing", "mill-operations"],
  },
  "evaluate-sustainable-fabric-claims": {
    categorySlug: "sustainable-fabrics",
    tagSlugs: ["sustainable-fabrics", "sourcing", "certification", "recycled-textiles"],
  },
  "questions-before-recycled-polyester": {
    categorySlug: "sustainable-fabrics",
    tagSlugs: ["recycled-polyester", "sustainable-fabrics", "sourcing", "certification"],
  },
  "china-plus-one-textile-sourcing-asia": {
    categorySlug: "supply-chain-and-sourcing",
    tagSlugs: ["fabric-manufacturing", "sourcing", "textile-exports", "china-plus-one"],
  },
  "textile-recycling-capacity-gap": {
    categorySlug: "textile-recycling",
    tagSlugs: ["textile-recycling", "circular-textiles", "fiber-sorting", "sourcing"],
  },
  "sorting-quality-textile-recycling": {
    categorySlug: "textile-recycling",
    tagSlugs: ["textile-recycling", "fiber-sorting", "circular-textiles", "feedstock"],
  },
};

export function isApprovedCategorySlug(slug: string): boolean {
  return APPROVED_CATEGORY_SLUGS.has(slug);
}

export function isApprovedTagSlug(slug: string): boolean {
  return APPROVED_TAG_SLUGS.has(slug);
}

/** Resolve any category name or slug strictly to one of the 7 approved categories. */
export function resolveApprovedCategory(raw: string | null | undefined): ApprovedCategory | null {
  if (!raw) return null;
  const normalized = slugify(raw);
  if (!normalized) return null;
  const direct = APPROVED_CATEGORY_BY_SLUG.get(normalized);
  if (direct) return direct;
  const aliased = CATEGORY_ALIAS_MAP[normalized];
  return aliased ? (APPROVED_CATEGORY_BY_SLUG.get(aliased) ?? null) : null;
}

/** Resolve a list of tag names/slugs strictly to up to `max` (default 4) approved tags. */
export function resolveApprovedTags(
  rawTags: readonly string[],
  max = MAX_ARTICLE_TAGS,
): { matched: ApprovedTag[]; unmatched: string[]; truncated: boolean } {
  const matched: ApprovedTag[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = slugify(trimmed);
    const slug = APPROVED_TAG_BY_SLUG.has(normalized)
      ? normalized
      : (TAG_ALIAS_MAP[normalized] ?? null);
    const tag = slug ? (APPROVED_TAG_BY_SLUG.get(slug) ?? null) : null;
    if (!tag) {
      unmatched.push(trimmed);
      continue;
    }
    if (seen.has(tag.slug)) continue;
    if (matched.length >= max) {
      truncated = true;
      continue;
    }
    seen.add(tag.slug);
    matched.push(tag);
  }

  return { matched, unmatched, truncated };
}

/** Compute the approved category and up to 4 approved tags for an existing article. */
export function resolveArticleReassignment(
  articleSlug: string,
  oldCategorySlug: string | null | undefined,
  oldTagSlugs: readonly string[],
): { categorySlug: string | null; tagSlugs: string[] } {
  const curated = PUBLISHED_ARTICLE_TAXONOMY[articleSlug];
  if (curated) {
    return {
      categorySlug: curated.categorySlug,
      tagSlugs: curated.tagSlugs.slice(0, MAX_ARTICLE_TAGS),
    };
  }
  const category = resolveApprovedCategory(oldCategorySlug);
  const { matched } = resolveApprovedTags(oldTagSlugs, MAX_ARTICLE_TAGS);
  return {
    categorySlug: category?.slug ?? null,
    tagSlugs: matched.map((t) => t.slug),
  };
}