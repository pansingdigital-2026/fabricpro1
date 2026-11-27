import { describe, expect, it } from "vitest";

import { publishUpdateSchema, uploadArticleSchema } from "./agent/schema";
import {
  APPROVED_CATEGORIES,
  APPROVED_TAGS,
  MAX_ARTICLE_TAGS,
  PUBLISHED_ARTICLE_TAXONOMY,
  isApprovedCategorySlug,
  isApprovedTagSlug,
  resolveApprovedCategory,
  resolveApprovedTags,
  resolveArticleReassignment,
} from "./taxonomy";

describe("approved taxonomy", () => {
  it("contains exactly 12 core textile categories with descriptions and 32 approved tags", () => {
    expect(APPROVED_CATEGORIES).toHaveLength(12);
    expect(APPROVED_CATEGORIES.every((c) => c.description.trim().length > 0)).toBe(true);
    expect(APPROVED_TAGS).toHaveLength(32);
    expect(new Set(APPROVED_CATEGORIES.map((c) => c.slug)).size).toBe(12);
    expect(new Set(APPROVED_TAGS.map((t) => t.slug)).size).toBe(32);
  });

  it("maps every published article to an approved category and at most 4 approved tags", () => {
    const entries = Object.entries(PUBLISHED_ARTICLE_TAXONOMY);
    expect(entries.length).toBe(7);
    for (const [slug, mapping] of entries) {
      expect(isApprovedCategorySlug(mapping.categorySlug), `${slug} category`).toBe(true);
      expect(mapping.tagSlugs.length, `${slug} tag count`).toBeGreaterThanOrEqual(2);
      expect(mapping.tagSlugs.length, `${slug} tag max`).toBeLessThanOrEqual(MAX_ARTICLE_TAGS);
      expect(new Set(mapping.tagSlugs).size, `${slug} duplicate tags`).toBe(mapping.tagSlugs.length);
      for (const tagSlug of mapping.tagSlugs) {
        expect(isApprovedTagSlug(tagSlug), `${slug} tag ${tagSlug}`).toBe(true);
      }
    }
  });

  it("resolves exact and alias categories strictly to the 12 approved categories", () => {
    expect(resolveApprovedCategory("Textile Machinery")?.slug).toBe("textile-machinery");
    expect(resolveApprovedCategory("machinery")?.slug).toBe("textile-machinery");
    expect(resolveApprovedCategory("Supply Chain")?.slug).toBe("supply-chain-and-sourcing");
    expect(resolveApprovedCategory("Unrelated Topic")).toBeNull();
  });

  it("resolves approved tags, caps at 4, deduplicates aliases, and reports unmatched tags", () => {
    const result = resolveApprovedTags([
      "rPET",
      "Recycled Polyester",
      "Sustainable Fabrics",
      "Sourcing",
      "Certification",
      "Traceability",
      "Random Unapproved Tag",
    ]);
    expect(result.matched.map((t) => t.slug)).toEqual([
      "recycled-polyester",
      "sustainable-fabrics",
      "sourcing",
      "certification",
    ]);
    expect(result.truncated).toBe(true);
    expect(result.unmatched).toEqual(["Random Unapproved Tag"]);
  });

  it("falls back to legacy mapping for unlisted articles and enforces max 4 tags", () => {
    const result = resolveArticleReassignment("some-draft-article", "sustainability", [
      "rpet",
      "circularity",
      "dpp",
      "certifications",
      "sourcing",
    ]);
    expect(result.categorySlug).toBe("sustainable-fabrics");
    expect(result.tagSlugs).toEqual([
      "recycled-polyester",
      "circular-textiles",
      "digital-product-passports",
      "certification",
    ]);
    expect(result.tagSlugs.length).toBeLessThanOrEqual(4);
  });

  it("rejects more than 4 tags in automated update schemas", () => {
    const base = {
      title: "Test Automated News",
      excerpt: "Short summary of the automated textile news article.",
      bodyMarkdown: "Detailed body content for the automated textile news article.",
      sourceName: "Textile World",
      sourceUrl: "https://example.com/news/1",
    };
    expect(
      uploadArticleSchema.safeParse({
        ...base,
        tags: ["sourcing", "weaving", "automation", "cotton"],
      }).success,
    ).toBe(true);
    expect(
      publishUpdateSchema.safeParse({
        ...base,
        tags: ["sourcing", "weaving", "automation", "cotton", "spinning"],
      }).success,
    ).toBe(false);
  });
});