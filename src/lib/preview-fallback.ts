/**
 * Read-only Fabric-Pro seed data used ONLY when MySQL env vars (DB_HOST,
 * DB_NAME, DB_USER) are not configured (for example in live preview before
 * Hostinger MySQL is attached). When MySQL is configured, all reads go
 * directly to MySQL.
 */
import { DEFAULT_AUTHOR } from "./authors";
import { DEFAULT_SETTINGS } from "./defaults";
import { APPROVED_CATEGORIES, APPROVED_TAGS } from "./taxonomy";
import type {
  Author,
  Category,
  ContentItem,
  ContentType,
  HomepageSection,
  MenuItem,
  SiteBootstrap,
  SitePage,
  Tag,
} from "./types";

export const PREVIEW_CONTENT_TYPES: ContentType[] = [
  {
    id: "11111111-0000-4000-8000-000000000001",
    slug: "news",
    name: "News",
    plural_name: "News",
    description: "Latest textile industry news, mill upgrades, manufacturing investments, and market updates.",
    is_video: false,
    archive_path: "/news",
    position: 1,
    enabled: true,
    seo: {},
  },
  {
    id: "11111111-0000-4000-8000-000000000002",
    slug: "blogs",
    name: "Blog",
    plural_name: "Blogs",
    description: "Practical fabric sourcing guides, sustainability checklists, and buyer explainers.",
    is_video: false,
    archive_path: "/blogs",
    position: 2,
    enabled: true,
    seo: {},
  },
  {
    id: "11111111-0000-4000-8000-000000000003",
    slug: "insights",
    name: "Insight",
    plural_name: "Insights",
    description: "Deep analysis on global textile supply chains, recycling capacity, and sourcing strategy.",
    is_video: false,
    archive_path: "/insights",
    position: 3,
    enabled: true,
    seo: {},
  },
];

export const PREVIEW_CATEGORIES: Category[] = APPROVED_CATEGORIES.map((c, idx) => ({
  id: `22222222-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
  parent_id: null,
  name: c.name,
  slug: c.slug,
  description: c.description,
  image_url: null,
  heading: null,
  seo: {},
  position: c.position,
}));

export const PREVIEW_TAGS: Tag[] = APPROVED_TAGS.map((t, idx) => ({
  id: `33333333-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
  name: t.name,
  slug: t.slug,
  description: null,
  seo: {},
}));

const CAT_BY_SLUG = new Map(PREVIEW_CATEGORIES.map((c) => [c.slug, c]));
const TAG_BY_SLUG = new Map(PREVIEW_TAGS.map((t) => [t.slug, t]));

export const PREVIEW_AUTHORS: Author[] = [
  DEFAULT_AUTHOR,
  {
    id: "44444444-0000-4000-8000-000000000002",
    user_id: null,
    name: "Fabric-Pro Editorial Desk",
    slug: "fabric-pro-editorial-desk",
    bio: "The Fabric-Pro editorial team covers textile machinery, sustainable fabrics, sourcing, and circular manufacturing.",
    job_title: "Editorial Desk, Fabric-Pro",
    photo_url: null,
    social_links: {},
    seo: {},
  },
];

function pickCat(slug: string) {
  const c = CAT_BY_SLUG.get(slug);
  return c ? { id: c.id, name: c.name, slug: c.slug } : null;
}

function pickTags(slugs: string[]) {
  return slugs
    .map((s) => TAG_BY_SLUG.get(s))
    .filter((t): t is Tag => Boolean(t))
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
}

const DESK = PREVIEW_AUTHORS[1]!;

export const PREVIEW_CONTENT: ContentItem[] = [
  {
    id: "88888888-0000-4000-8000-000000000001",
    type_slug: "news",
    title: "Automated weaving lines help mills improve output and consistency",
    slug: "automated-weaving-lines-boost-output",
    excerpt:
      "Automation is becoming a practical upgrade path for mills that need better production control, lower downtime, and more consistent fabric quality.",
    body_html: `<h2>What happened</h2><p>Textile manufacturers are increasing investment in automated weaving and knitting lines as mills look for more reliable output, better quality visibility, and tighter control over production schedules.</p><p>The shift is not only about replacing manual work. Modern systems can help operators monitor machine performance, detect variation earlier, and reduce avoidable stoppages across high-volume fabric programs.</p><h2>Why it matters</h2><p>For fabric producers, consistency is often as important as speed. Automated lines can support tighter tolerances across repeat orders, reduce waste from defects, and make it easier to document production conditions for customers.</p><p>Buyers are also asking for shorter lead times and clearer traceability. Mills with stronger production data can respond faster when customers need updates, audits, or proof of process controls.</p><h2>What to watch</h2><p>The biggest gains are likely to come from mills that combine machinery upgrades with operator training, preventive maintenance, and better production planning. Automation is most useful when the team can act on the data it creates.</p><p>Suppliers should also watch how automation changes purchasing decisions. More mills may favor machinery that integrates easily with reporting systems, quality controls, and energy monitoring tools.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/news/textile-machinery-news.jpg",
    featured_image_alt: "Modern textile machinery running fabric through a bright manufacturing facility",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("textile-machinery")?.id ?? null,
    status: "published",
    is_featured: true,
    is_editors_pick: true,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 2,
    view_count: 142,
    seo: {
      title: "Automated Weaving Lines Help Mills Improve Output | Fabric-Pro",
      description:
        "New automated weaving line investments are helping textile mills improve output, quality consistency, and production visibility.",
    },
    related_ids: [],
    published_at: "2026-06-11T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    author: DESK,
    category: pickCat("textile-machinery"),
    tags: pickTags(["textile-machinery", "weaving", "automation", "fabric-manufacturing"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000002",
    type_slug: "blogs",
    title: "How to evaluate sustainable fabric claims before sourcing",
    slug: "evaluate-sustainable-fabric-claims",
    excerpt:
      "Sustainable fabric sourcing works best when teams review claims, documents, and production realities before committing to a supplier.",
    body_html: `<h2>Key takeaways</h2><ul><li>Ask suppliers to connect every sustainability claim to a document, standard, or production process.</li><li>Check whether certifications apply to the mill, the material, the transaction, or only the brand story.</li><li>Review performance, care, durability, and availability before choosing a lower-impact material.</li></ul><h2>Start with the exact claim</h2><p>Words like sustainable, eco-friendly, recycled, responsible, and low-impact can mean different things in different supply chains. Before comparing fabrics, write down the exact claim you need to verify.</p><p>For example, a recycled polyester fabric claim should make clear whether the recycled input is post-consumer or post-industrial, whether the percentage is measured by weight, and whether chain-of-custody documents are available.</p><h2>Review documents and scope</h2><p>Certifications are useful, but scope matters. A certificate may apply to a spinning mill, dye house, trading company, or finished fabric. Check the certificate holder, validity period, material category, and transaction requirements.</p><p>If a supplier cannot explain how the documentation follows the fabric from input to finished material, treat the claim as incomplete until the missing details are resolved.</p><h2>Balance impact with performance</h2><p>A fabric that looks better on paper may still fail if it cannot meet durability, colorfastness, hand feel, shrinkage, care, or compliance requirements. Sustainable sourcing should include both environmental claims and product performance.</p><p>The strongest sourcing decisions combine verified claims, reliable production, and a realistic understanding of how the fabric will be used.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/blogs/sustainable-fabric-sourcing.jpg",
    featured_image_alt: "Sustainable fabric swatches and recycled textile samples arranged on a white table",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("sustainable-fabrics")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: true,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 3,
    view_count: 118,
    seo: {
      title: "How to Evaluate Sustainable Fabric Claims Before Sourcing | Fabric-Pro",
      description:
        "A practical checklist for reviewing sustainable fabric claims, certifications, recycled-content statements, and supplier documentation.",
    },
    related_ids: [],
    published_at: "2026-06-10T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    author: DESK,
    category: pickCat("sustainable-fabrics"),
    tags: pickTags(["sustainable-fabrics", "sourcing", "certification", "recycled-textiles"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000003",
    type_slug: "insights",
    title: "The textile recycling capacity gap is becoming a sourcing issue",
    slug: "textile-recycling-capacity-gap",
    excerpt:
      "As recycled textile demand grows, sourcing teams need to understand capacity, feedstock quality, and the limits of current recycling infrastructure.",
    body_html: `<h2>Executive summary</h2><p>Recycled textile demand is rising, but available capacity is not evenly distributed across fibers, regions, and quality levels. This mismatch is becoming a sourcing issue rather than only a sustainability issue.</p><p>Brands and mills that want more recycled content need to understand where feedstock comes from, how it is sorted, and what quality can realistically be supplied at scale.</p><h2>Market context</h2><p>Textile recycling depends on more than one technology. Collection systems, sorting infrastructure, fiber identification, chemical or mechanical processing, and downstream spinning or fabric production all affect the final material.</p><p>When one part of that chain is weak, recycled-content programs can face higher costs, inconsistent inputs, or limited availability.</p><h2>Key trend</h2><p>The industry is moving from broad circularity commitments to practical sourcing questions. Teams are asking which fibers can be recovered, what blend limitations exist, and whether recycled inputs can meet performance needs for repeat production.</p><p>This creates opportunity for recyclers and mills that can provide consistent quality, credible traceability, and clear documentation.</p><h2>Strategic takeaway</h2><p>Textile recycling should be evaluated as a supply chain, not a single material claim. The companies that plan around feedstock quality and processing capacity will be better prepared as recycled-content expectations increase.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/insights/textile-recycling-insight.jpg",
    featured_image_alt: "Sorted textile scraps and recovered fibers on a clean materials lab bench",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("textile-recycling")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: false,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 2,
    view_count: 96,
    seo: {
      title: "Textile Recycling Capacity Gap Becomes a Sourcing Issue | Fabric-Pro",
      description:
        "Textile recycling capacity, fiber sorting, and feedstock quality are becoming important sourcing considerations for brands and mills.",
    },
    related_ids: [],
    published_at: "2026-06-09T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
    author: DESK,
    category: pickCat("textile-recycling"),
    tags: pickTags(["textile-recycling", "circular-textiles", "fiber-sorting", "sourcing"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000004",
    type_slug: "news",
    title: "Energy monitoring becomes a priority for textile mills",
    slug: "energy-monitoring-textile-mills",
    excerpt:
      "Machine-level energy monitoring is becoming a practical tool for mills that need better cost control and stronger sustainability reporting.",
    body_html: `<h2>What happened</h2><p>More textile mills are reviewing energy monitoring systems as operating costs, customer reporting requirements, and sustainability targets become harder to manage with manual records alone.</p><p>Machine-level monitoring can help production teams understand when energy use rises, which lines need attention, and where maintenance or scheduling changes may reduce waste.</p><h2>Why it matters</h2><p>Energy is one of the most important cost inputs in many textile operations. Better monitoring gives mills a clearer view of consumption across weaving, knitting, dyeing, finishing, and supporting utilities.</p><p>For customers, stronger energy data can also support supplier scorecards and environmental reporting.</p><h2>What to watch</h2><p>The next step for many mills will be connecting energy data with production output, quality records, and maintenance planning. That combination can make energy reporting more useful for both operations teams and buyers.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/news/textile-machinery-news.jpg",
    featured_image_alt: "Modern textile machinery inside a bright manufacturing facility",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("textile-machinery")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: false,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 2,
    view_count: 84,
    seo: {
      title: "Energy Monitoring Becomes a Priority for Textile Mills | Fabric-Pro",
      description:
        "Textile mills are using energy monitoring to track machine-level consumption, reduce waste, and support customer reporting needs.",
    },
    related_ids: [],
    published_at: "2026-06-08T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-08T00:00:00.000Z",
    updated_at: "2026-06-08T00:00:00.000Z",
    author: DESK,
    category: pickCat("textile-machinery"),
    tags: pickTags(["textile-machinery", "energy-monitoring", "fabric-manufacturing", "mill-operations"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000005",
    type_slug: "blogs",
    title: "Five questions to ask before buying recycled polyester fabric",
    slug: "questions-before-recycled-polyester",
    excerpt:
      "Recycled polyester can be a useful sourcing option, but buyers should verify content, documentation, quality, availability, and end-use fit.",
    body_html: `<h2>Key takeaways</h2><ul><li>Confirm recycled-content percentage and input type.</li><li>Check chain-of-custody documentation before placing bulk orders.</li><li>Test performance against the final product requirement.</li></ul><h2>Ask what the recycled input is</h2><p>Recycled polyester may come from post-consumer bottles, post-industrial waste, textile waste, or mixed sources. The input type affects claims, documentation, and sometimes performance.</p><p>Ask the supplier to state the recycled percentage by weight and explain how it is verified.</p><h2>Ask what documentation is available</h2><p>For brand programs, documentation often matters as much as the fiber itself. Review whether the certificate applies to the supplier, material, transaction, and production period.</p><h2>Ask whether supply is repeatable</h2><p>A fabric that works for a sample order may not be available at the same quality and price for repeat production. Before committing, check lead times, minimum order quantities, color availability, and future capacity.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/blogs/sustainable-fabric-sourcing.jpg",
    featured_image_alt: "Sustainable fabric samples arranged on a white studio table",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("sustainable-fabrics")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: false,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 2,
    view_count: 77,
    seo: {
      title: "Five Questions Before Buying Recycled Polyester Fabric | Fabric-Pro",
      description:
        "Use these five questions to review recycled polyester fabric claims, quality expectations, chain-of-custody documents, and supply reliability.",
    },
    related_ids: [],
    published_at: "2026-06-07T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-07T00:00:00.000Z",
    updated_at: "2026-06-07T00:00:00.000Z",
    author: DESK,
    category: pickCat("sustainable-fabrics"),
    tags: pickTags(["recycled-polyester", "sustainable-fabrics", "sourcing", "certification"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000006",
    type_slug: "insights",
    title: "Sorting quality will shape textile recycling economics",
    slug: "sorting-quality-textile-recycling",
    excerpt:
      "Textile recycling economics depend heavily on sorting quality, because cleaner feedstock can improve recovery rates and downstream material value.",
    body_html: `<h2>Executive summary</h2><p>Textile recycling does not begin at the recycling technology. It begins with collection and sorting. Better sorting quality can reduce contamination, improve fiber recovery, and make recycled inputs more predictable.</p><h2>Market context</h2><p>Many textile waste streams contain blends, trims, coatings, dyes, and finishes that complicate recycling. The more mixed the feedstock, the more difficult it becomes to produce consistent recycled material.</p><h2>Key trend</h2><p>Sorting technology and material identification are becoming more important as brands ask for higher recycled content and more reliable sourcing options.</p><h2>Strategic takeaway</h2><p>Companies that invest in better sorting, documentation, and feedstock preparation will be better positioned as textile recycling moves from pilot projects to repeat production.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/insights/textile-recycling-insight.jpg",
    featured_image_alt: "Sorted textile scraps and recovered fibers on a clean materials lab bench",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("textile-recycling")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: false,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 2,
    view_count: 68,
    seo: {
      title: "Sorting Quality Will Shape Textile Recycling Economics | Fabric-Pro",
      description:
        "Better textile sorting can improve recycling economics by raising feedstock quality, reducing contamination, and supporting more reliable fiber recovery.",
    },
    related_ids: [],
    published_at: "2026-06-06T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    author: DESK,
    category: pickCat("textile-recycling"),
    tags: pickTags(["textile-recycling", "fiber-sorting", "circular-textiles", "feedstock"]),
  },
  {
    id: "88888888-0000-4000-8000-000000000007",
    type_slug: "insights",
    title: "How China+1 Sourcing Is Reshaping Asia’s Textile Supply Chain",
    slug: "china-plus-one-textile-sourcing-asia",
    excerpt:
      "China remains important for fibers, fabrics, trims, machinery and speed. Vietnam, Bangladesh, India, Indonesia and Cambodia are the most visible beneficiaries, but each has different strengths and bottlenecks.",
    body_html: `<h2>Key Takeaways</h2><ul><li>China remains central to fiber, fabric, trims, machinery and scale manufacturing, so China+1 does not mean China exit.</li><li>Vietnam and Bangladesh are strong garment platforms, but both need stronger fabric and yarn backward linkages.</li><li>India's opportunity is larger when it combines cotton, MMF, technical textiles, processing, and integrated parks.</li><li>Indonesia and Cambodia benefit from diversification, but productivity, compliance, logistics and fabric access remain constraints.</li><li>Sourcing teams are increasingly evaluating Asia by resilience, compliance data, lead time, material availability and product specialization, not only FOB cost.</li><li>Exporters that can offer traceability, certified fabrics and reliable production planning will gain more than suppliers competing only on price.</li></ul><h2>Why This Insight Matters</h2><p>China+1 sourcing has moved from a procurement slogan to a supplier qualification exercise. Global buyers still need China's scale and upstream strength, but they are also asking where risk can be reduced without weakening cost, quality or speed. For Asian textile companies, the real question is not whether orders will move. It is which orders move, which countries can absorb them, and which suppliers can prove reliability beyond low pricing.</p><h2>Current Market Context</h2><p>Across Asia, the sourcing map is becoming more segmented. China remains a leader in synthetic fibers, fabric development, trims, machinery, finishing know-how and speed. Vietnam is attractive for export manufacturing and trade access, but its dependence on imported fabric limits full supply-chain control. Bangladesh continues to hold scale in garment exports, especially cotton apparel, while pushing toward higher-value items and better waste use. India is trying to position itself as a broader textile platform with cotton, MMF, technical textiles, large parks and policy support. Indonesia offers a mix of labor, domestic textile capacity and regional access, while Cambodia remains important for labor-intensive garment production.</p><h2>What Is Driving This Shift</h2><p><strong>Risk diversification:</strong> Pandemic disruption, shipping volatility, geopolitical uncertainty and tariff exposure have made single-country dependence less acceptable. Brands increasingly want parallel capacity across Asia.</p><p><strong>Fabric and material availability:</strong> Moving garment assembly is easier than moving yarn, fabric, dyeing, finishing, trims and testing. Countries with stronger backward integration are more likely to capture durable sourcing shifts.</p><p><strong>Compliance and traceability:</strong> Supplier choice is being influenced by audit history, environmental data, wastewater controls, restricted substances management, and documentation quality.</p><p><strong>Product specialization:</strong> Basic orders may move first, but long-term value will depend on performance fabrics, synthetic blends, recycled materials, outerwear, activewear, workwear and technical applications.</p><h2>Business Implications for Textile Companies</h2><ul><li>Mills should develop certified fabric programs instead of waiting for garment exporters to pull demand.</li><li>Garment exporters need dual strategies: maintain price competitiveness while adding design, fabric sourcing and compliance depth.</li><li>Brands should map Tier-2 fabric and dyeing exposure, not only Tier-1 garment factories.</li><li>Machinery suppliers can target modernization gaps in Vietnam, Bangladesh, India and Indonesia.</li><li>Investors should look for integrated suppliers that combine material access, processing, compliance systems and export relationships.</li></ul><h2>Practical Recommendations</h2><p>Map product categories by sourcing risk rather than shifting all orders together. Build relationships with fabric mills in target countries before moving garment production, create buyer-ready documentation for origin and testing, and use pilot orders to test quality, lead time and compliance before scaling.</p><h2>Future Outlook</h2><p>Over the next two to four years, China will remain deeply embedded in Asia's textile supply chain, but order allocation will continue to diversify. The strongest beneficiaries will be countries and suppliers that can combine competitive manufacturing with reliable fabric access, compliance documentation and predictable delivery.</p>`,
    body_markdown: null,
    editor_mode: "rich",
    featured_image_url: "/uploads/insights/china-plus-one-textile-sourcing-asia.webp",
    featured_image_alt:
      "Asia textile sourcing shift infographic showing China+1 movement toward India, Vietnam, Bangladesh and Indonesia",
    featured_image_caption: null,
    author_id: DESK.id,
    category_id: pickCat("supply-chain-and-sourcing")?.id ?? null,
    status: "published",
    is_featured: false,
    is_editors_pick: true,
    video_provider: null,
    video_url: null,
    video_thumbnail_url: null,
    reading_minutes: 5,
    view_count: 185,
    seo: {
      title: "China+1 Textile Sourcing in Asia | Fabric-Pro Insight",
      description:
        "China+1 sourcing is changing textile supply chains across India, Vietnam, Bangladesh, Indonesia and China. See what buyers should watch.",
    },
    related_ids: [],
    published_at: "2026-06-01T00:00:00.000Z",
    scheduled_for: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    author: DESK,
    category: pickCat("supply-chain-and-sourcing"),
    tags: pickTags(["fabric-manufacturing", "sourcing", "textile-exports", "china-plus-one"]),
  },
];

export const PREVIEW_MENUS: Record<string, MenuItem[]> = {
  main: [
    { id: "m1", menu_id: "main", parent_id: null, label: "Home", url: "/", target: "_self", position: 1 },
    { id: "m2", menu_id: "main", parent_id: null, label: "News", url: "/news", target: "_self", position: 2 },
    { id: "m3", menu_id: "main", parent_id: null, label: "Blogs", url: "/blogs", target: "_self", position: 3 },
    { id: "m4", menu_id: "main", parent_id: null, label: "Insights", url: "/insights", target: "_self", position: 4 },
    { id: "m5", menu_id: "main", parent_id: null, label: "About", url: "/p/about", target: "_self", position: 5 },
    { id: "m6", menu_id: "main", parent_id: null, label: "Contact", url: "/contact", target: "_self", position: 6 },
  ],
};

export const PREVIEW_HOMEPAGE_SECTIONS: HomepageSection[] = [
  {
    id: "66666666-0000-4000-8000-000000000001",
    block_type: "featured_with_sidebar",
    title: "Featured",
    subtitle: null,
    position: 1,
    enabled: true,
    settings: {
      source: "latest",
      limit: 7,
      sidebarTitle: "Latest articles",
      sidebarLimit: 5,
      showSearch: true,
      width: "container",
      padding: "lg",
      background: "gradient",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  },
  {
    id: "66666666-0000-4000-8000-000000000002",
    block_type: "article_grid",
    title: "Latest News",
    subtitle: null,
    position: 2,
    enabled: true,
    settings: {
      source: "type",
      typeSlug: "news",
      limit: 3,
      columns: 3,
      layout: "card",
      width: "container",
      padding: "lg",
      background: "page",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  },
  {
    id: "66666666-0000-4000-8000-000000000003",
    block_type: "article_grid",
    title: "Latest Blogs",
    subtitle: null,
    position: 3,
    enabled: true,
    settings: {
      source: "type",
      typeSlug: "blogs",
      limit: 3,
      columns: 3,
      layout: "card",
      width: "container",
      padding: "lg",
      background: "page",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  },
  {
    id: "66666666-0000-4000-8000-000000000004",
    block_type: "article_grid",
    title: "Latest Insights",
    subtitle: null,
    position: 4,
    enabled: true,
    settings: {
      source: "type",
      typeSlug: "insights",
      limit: 3,
      columns: 3,
      layout: "card",
      width: "container",
      padding: "lg",
      background: "page",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  },
  {
    id: "66666666-0000-4000-8000-000000000005",
    block_type: "newsletter",
    title: "Subscribe to Fabric-Pro",
    subtitle: "Get textile industry news, sourcing blogs, and expert insights in your inbox.",
    position: 5,
    enabled: true,
    settings: {
      width: "narrow",
      align: "center",
      padding: "lg",
      background: "muted",
      desktop: true,
      tablet: true,
      mobile: true,
    },
  },
];

export const PREVIEW_PAGES: SitePage[] = [
  {
    id: "99999999-0000-4000-8000-000000000001",
    title: "About Fabric-Pro",
    slug: "about",
    status: "published",
    seo: {
      title: "About Fabric-Pro | Textile Industry News and Insights",
      description:
        "Learn about Fabric-Pro, a news and article website covering textile industry updates, fabric innovation, sourcing, machinery, and sustainability.",
    },
    sections: [
      {
        id: "about-body",
        type: "rich_text",
        settings: {
          width: "narrow",
          padding: "md",
          html: `<p>Fabric-Pro publishes clear, useful coverage for professionals who follow the textile, fabric, apparel material, machinery, sourcing, sustainability, and circular materials sectors.</p><p>Our goal is simple: make important industry updates easy to scan, easy to understand, and easy to revisit.</p><h2>What we cover</h2><ul><li>Textile and fabric industry news</li><li>Machinery, manufacturing, dyeing, finishing, and production updates</li><li>Sustainable fabrics, recycled textiles, and circular supply chains</li><li>Sourcing, supplier, brand, and market developments</li><li>Practical blogs and industry insights</li></ul><h2>Editorial approach</h2><p>Fabric-Pro is built for readable publishing. Articles are written in plain language, organized with clear headings, and supported by SEO-ready metadata so readers and search engines can understand every page.</p>`,
        },
      },
    ],
    published_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
  },
];

export function getPreviewBootstrap(): SiteBootstrap {
  return {
    settings: DEFAULT_SETTINGS,
    menus: PREVIEW_MENUS,
    contentTypes: PREVIEW_CONTENT_TYPES,
    categories: PREVIEW_CATEGORIES,
    tags: PREVIEW_TAGS,
  };
}