import { describe, expect, it } from "vitest";

import { DEFAULT_AUTHOR, DEFAULT_AUTHOR_LINKEDIN, getAuthorLinkedIn, resolveAuthor } from "@/lib/authors";
import { folderForContentType, MEDIA_FOLDERS } from "@/lib/media-folders";
import { verifyAgentAuth, verifyBearerKey } from "./auth";
import { markdownToSafeHtml } from "./sanitize";
import {
  finalizeUpdateSchema,
  normalizeSourceUrl,
  publishUpdateSchema,
  uploadArticleSchema,
  validateRemoteImageUrl,
} from "./schema";

describe("verifyAgentAuth", () => {
  it("returns 503 when PUBLISH_API_KEY is not configured", () => {
    const req = new Request("https://fabric-pro.com/api/public/agent/updates", {
      headers: { Authorization: "Bearer anything" },
    });
    const res = verifyAgentAuth(req, {});
    expect(res).toEqual({
      ok: false,
      status: 503,
      error: "Agent publishing is not configured. Set PUBLISH_API_KEY on the server.",
    });
  });

  it("returns 401 when Bearer header is missing or wrong", () => {
    const env = { PUBLISH_API_KEY: "super-secret-key-123" };
    const noHeader = verifyAgentAuth(new Request("https://fabric-pro.com/api/public/agent/updates"), env);
    expect(noHeader.ok).toBe(false);
    if (!noHeader.ok) expect(noHeader.status).toBe(401);

    const wrong = verifyAgentAuth(
      new Request("https://fabric-pro.com/api/public/agent/updates", {
        headers: { Authorization: "Bearer wrong-key" },
      }),
      env,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.status).toBe(401);
  });

  it("accepts a matching Bearer key", () => {
    const env = { PUBLISH_API_KEY: "super-secret-key-123" };
    const res = verifyAgentAuth(
      new Request("https://fabric-pro.com/api/public/agent/updates", {
        headers: { Authorization: "Bearer super-secret-key-123" },
      }),
      env,
    );
    expect(res).toEqual({ ok: true });
  });

  it("enforces separate keys for article, image, and finalize endpoints", () => {
    const env = {
      UPDATE_ARTICLE_API_KEY: "article-secret",
      UPDATE_IMAGE_API_KEY: "image-secret",
      UPDATE_FINALIZE_API_KEY: "finalize-secret",
    };
    const reqWith = (key: string) =>
      new Request("https://fabric-pro.com/api/public/agent/updates/article", {
        headers: { Authorization: `Bearer ${key}` },
      });

    expect(verifyBearerKey(reqWith("article-secret"), "UPDATE_ARTICLE_API_KEY", env)).toEqual({ ok: true });
    expect(verifyBearerKey(reqWith("article-secret"), "UPDATE_IMAGE_API_KEY", env).ok).toBe(false);
    expect(verifyBearerKey(reqWith("image-secret"), "UPDATE_IMAGE_API_KEY", env)).toEqual({ ok: true });
    expect(verifyBearerKey(reqWith("finalize-secret"), "UPDATE_FINALIZE_API_KEY", env)).toEqual({ ok: true });
    expect(verifyBearerKey(reqWith("image-secret"), "UPDATE_FINALIZE_API_KEY", env).ok).toBe(false);
  });
});

describe("publishUpdateSchema & duplicate normalization", () => {
  it("accepts a valid update payload and strips unknown type fields", () => {
    const parsed = publishUpdateSchema.safeParse({
      title: "Google updates Search AI Overviews",
      excerpt: "Google rolled out expanded AI Overviews across 100+ countries with new citation links.",
      bodyMarkdown: "## What changed\n\nGoogle announced broader availability of AI Overviews today.",
      sourceName: "Search Engine Land",
      sourceUrl: "https://searchengineland.com/google-ai-overviews-2026/",
      type_slug: "playbook",
      status: "draft",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("type_slug" in parsed.data).toBe(false);
      expect("status" in parsed.data).toBe(false);
    }
  });

  it("normalizes duplicate source URLs across trailing slash, case, and hash", () => {
    expect(normalizeSourceUrl("https://Example.COM/news/story/")).toBe(
      normalizeSourceUrl("https://example.com/news/story#section"),
    );
  });
});

describe("validateRemoteImageUrl (SSRF protection)", () => {
  it("blocks private IPs, localhost, and non-HTTPS URLs", () => {
    const blocked = [
      "http://example.com/photo.jpg",
      "https://localhost/photo.jpg",
      "https://127.0.0.1/photo.jpg",
      "https://10.0.0.5/photo.jpg",
      "https://192.168.1.10/photo.jpg",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/photo.jpg",
      "https://service.internal/img.png",
    ];
    for (const url of blocked) {
      expect(validateRemoteImageUrl(url).ok, `expected ${url} to be blocked`).toBe(false);
    }
  });

  it("allows public HTTPS image URLs", () => {
    expect(validateRemoteImageUrl("https://images.example.com/news/hero.webp").ok).toBe(true);
  });
});

describe("markdownToSafeHtml", () => {
  it("converts Markdown and strips scripts, iframes, and event handlers", () => {
    const html = markdownToSafeHtml(
      '## Headline\n\nSafe paragraph with [link](javascript:alert(1)).\n\n<script>alert(1)</script><img src="https://x.com/a.jpg" onerror="alert(2)">',
    );
    expect(html).toContain("<h2>Headline</h2>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});

describe("default author fallback", () => {
  it("defaults to Pankaj Singh with his LinkedIn URL when article has no author", () => {
    const author = resolveAuthor(null);
    expect(author.name).toBe("Pankaj Singh");
    expect(author.slug).toBe("pankaj-singh");
    expect(getAuthorLinkedIn(author)).toBe(DEFAULT_AUTHOR_LINKEDIN);
    expect(DEFAULT_AUTHOR.social_links["linkedin"]).toBe("https://www.linkedin.com/in/pankajsinghin/");
  });
});

describe("3-step Updates schemas & Media folders", () => {
  it("validates Upload article and Mark ready payloads", () => {
    const article = uploadArticleSchema.safeParse({
      title: "Google launches new Ads reporting metric",
      excerpt: "Google Ads rolled out a new cross-channel conversion reporting metric for advertisers.",
      bodyMarkdown: "## Summary\n\nAdvertisers can now compare cross-channel conversions directly.",
      sourceName: "Google Ads Blog",
      sourceUrl: "https://blog.google/products/ads-commerce/new-metric/",
      seo: { title: "Google Ads New Metric", description: "Cross-channel conversion reporting." },
    });
    expect(article.success).toBe(true);

    const readyOk = finalizeUpdateSchema.safeParse({
      draftId: "11111111-1111-4111-8111-111111111111",
      mediaId: "22222222-2222-4222-8222-222222222222",
    });
    expect(readyOk.success).toBe(true);

    const readyBad = finalizeUpdateSchema.safeParse({ draftId: "not-a-uuid", mediaId: "" });
    expect(readyBad.success).toBe(false);
  });

  it("defines 4 Media folders and maps article sections to their folders", () => {
    expect(MEDIA_FOLDERS.map((f) => f.id)).toEqual(["branding", "news", "blogs", "insights"]);
    expect(folderForContentType("news")).toBe("news");
    expect(folderForContentType("blogs")).toBe("blogs");
    expect(folderForContentType("insights")).toBe("insights");
  });
});