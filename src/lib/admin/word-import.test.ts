// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { File as NodeFile } from "node:buffer";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { stripLeadingDuplicateExcerpt } from "@/lib/format";
import {
  parseWordHtml,
  readWordArticle,
  restoreWordHeadings,
  validateWordFile,
  WORD_MAX_BYTES,
} from "./word-import";

describe("Updates Word import", () => {
  const importFixture = async () => {
    const result = await mammoth.convertToHtml(
      { buffer: readFileSync(resolve("src/lib/admin/__fixtures__/google-news.docx")) },
      { transformDocument: restoreWordHeadings },
    );
    return parseWordHtml(result.value);
  };
  it("fills the supplied article title, SEO fields and original source hyperlink", async () => {
    const result = await importFixture();
    expect(result.title).toBe(
      "Google Expands AI Search Personalization With Wallet, Drive and Gemini",
    );
    expect(result.slug).toBe("google-ai-mode-personal-intelligence-update");
    expect(result.seo.title).toBe("Google Expands AI Search With Wallet and Personal Data");
    expect(result.seo.description).toBe(
      "Google expands Personal Intelligence in AI Mode with Wallet, Drive and Gemini integrations. Explore what personalized AI search means for digital marketers.",
    );
    expect(result.seo.focusKeyword).toBe("Google AI Mode personalization");
    expect(result.seo.sourceName).toBe("Google, The Keyword, November 23, 2026.");
    expect(result.seo.sourceUrl).toBe(
      "https://blog.google/products-and-platforms/products/search/google-search-personal-intelligence-apps/",
    );
  });
  it("preserves article headings, takeaways, body and inline hyperlinks without exposing metadata", async () => {
    const result = await importFixture();
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    expect(Array.from(doc.querySelectorAll("h2")).map((n) => n.textContent)).toEqual([
      "Key Takeaways",
      "What Google’s New Integrations Offer",
      "Search Intent Becomes More Individual",
      "Implications for SEO and GEO",
      "Measuring Visibility in Personalized Search",
      "Does This Change Google Advertising?",
    ]);
    expect(Array.from(doc.querySelectorAll("h3")).map((n) => n.textContent)).toEqual([
      "Google Wallet",
      "Google Drive",
      "Gemini",
    ]);
    expect(doc.querySelector("ul")?.children.length).toBe(3);
    expect(doc.querySelector("a")?.getAttribute("href")).toBe(
      "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide",
    );
    expect(doc.body.textContent).not.toContain("SEO Metadata");
    expect(doc.body.textContent).not.toContain("Main News Source:");
    expect(doc.body.textContent).toContain("actual performance data.");
  });
  it("uses the italic extract immediately after the title as the excerpt without repeating it in the body", async () => {
    const result = await importFixture();
    const extract =
      "Google is bringing spending information, personal documents and previous AI conversations into its search experience, introducing new considerations for SEO professionals and digital marketers.";
    expect(result.excerpt).toBe(extract);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    expect(doc.body.textContent).not.toContain(extract);
    expect(doc.querySelector("p")?.textContent).toContain("Google announced on November 23, 2026");
  });
  it("imports organisation and date, defaulting to Pankaj Singh", async () => {
    const result = await importFixture();
    expect(result.authorName).toBe("Pankaj Singh");
    expect(result.categoryName).toBe("SEO & Search");
    expect(result.tagNames).toEqual([
      "AI Search",
      "Search Personalization",
      "Generative Engine Optimization",
      "Google Search",
      "Search Analytics",
    ]);
    expect(result.publicationDate).toBe("2026-11-24T06:30:00.000Z");
  });
  it("uses the pre-title extract as the excerpt without repeating it in the body", async () => {
    const converted = await mammoth.convertToHtml(
      {
        buffer: readFileSync(
          resolve("src/lib/admin/__fixtures__/firebase-ai-analytics-agent-skills.docx"),
        ),
      },
      { transformDocument: restoreWordHeadings },
    );
    const result = parseWordHtml(converted.value);
    const extract =
      "Google is enabling AI coding assistants to support mobile app analytics implementation, potentially reducing the technical effort involved in configuring behavioral measurement.";
    expect(result.title).toBe(
      "Google Introduces Firebase AI Agent Skills for Mobile App Analytics",
    );
    expect(result.excerpt).toBe(extract);
    const doc = new DOMParser().parseFromString(result.html, "text/html");
    expect(doc.body.textContent).not.toContain(extract);
    expect(doc.querySelector("p")?.textContent).toContain(
      "Google updated its Analytics release notes on November 18, 2026",
    );
  });
  it("strips a labeled Extract section placed above the title from the body", () => {
    const result = parseWordHtml(
      "<p><strong>Extract</strong></p><p>Short standfirst above title.</p><h1>Headline</h1><p>First body paragraph.</p>",
    );
    expect(result.title).toBe("Headline");
    expect(result.excerpt).toBe("Short standfirst above title.");
    expect(result.html).not.toContain("Short standfirst above title.");
    expect(result.html).not.toContain("Extract");
    expect(result.html).toContain("First body paragraph.");
  });
  it("strips a duplicate leading excerpt paragraph when rendering already-saved articles", () => {
    const excerpt =
      "Unilever's marketing transformation combines AI-powered production, scientific product information, creator partnerships and performance measurement to support demand generation across global markets.";
    const body = `<p><em>Unilever’s marketing transformation combines AI-powered production, scientific product information, creator partnerships and performance measurement to support demand generation across global markets.</em></p><p>Unilever has disclosed significant improvements.</p>`;
    expect(stripLeadingDuplicateExcerpt(body, excerpt)).toBe(
      "<p>Unilever has disclosed significant improvements.</p>",
    );
    expect(
      stripLeadingDuplicateExcerpt("<p>Different opening paragraph.</p>", excerpt),
    ).toBe("<p>Different opening paragraph.</p>");
  });
  it("rejects articles assigned to another section", () => {
    expect(() =>
      parseWordHtml("<p>Section: Insights</p><h1>Wrong section</h1><p>Body</p>"),
    ).toThrow("Updates only");
  });
  it("strips executable markup and unsafe source URLs", () => {
    const result = parseWordHtml(
      '<p>Source URL: <a href="javascript:alert(1)">Bad source</a></p><h1>News</h1><p onclick="alert(1)">Text<script>alert(1)</script></p>',
    );
    expect(result.seo.sourceUrl).toBe("");
    expect(result.html).not.toMatch(/javascript:|onclick|<script/);
  });
  it("requires an article title and body", () => {
    expect(() => parseWordHtml("<p>SEO Metadata</p><p>SEO Title: Only SEO</p>")).toThrow("title");
    expect(() => parseWordHtml("<h1>Only a title</h1>")).toThrow("body");
  });
  it("rejects oversized, empty and non-Word files and explains older .doc conversion", () => {
    expect(() => validateWordFile({ name: "article.docx", size: WORD_MAX_BYTES + 1 })).toThrow(
      "10 MB",
    );
    expect(() => validateWordFile({ name: "article.docx", size: 0 })).toThrow("non-empty");
    expect(() => validateWordFile({ name: "article.pdf", size: 100 })).toThrow(".docx");
    expect(() => validateWordFile({ name: "article.doc", size: 100 })).toThrow("save it as .docx");
  });
  it("reports corrupted Word files without changing any article", async () => {
    await expect(
      readWordArticle(new NodeFile(["not a docx"], "broken.docx") as unknown as File),
    ).rejects.toThrow("could not be read");
  });
});
