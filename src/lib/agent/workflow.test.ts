import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {
  authors: [],
  categories: [],
  content: [],
  media: [],
  site_settings: [],
  automation_events: [],
};

function makeQuery(table: string) {
  let filters: Array<(r: Row) => boolean> = [];
  let insertRows: Row[] | null = null;
  let updatePatch: Row | null = null;
  let singleMode: "none" | "single" | "maybe" = "none";
  let limitCount: number | null = null;

  const run = () => {
    const list = tables[table] ?? [];
    if (insertRows) {
      const inserted = insertRows.map((r) => {
        const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
        list.push(row);
        return row;
      });
      return { data: singleMode === "none" ? inserted : (inserted[0] ?? null), error: null };
    }
    const matched = list.filter((r) => filters.every((fn) => fn(r)));
    if (updatePatch) {
      for (const r of matched) Object.assign(r, updatePatch);
      return { data: singleMode === "none" ? matched : (matched[0] ?? null), error: null };
    }
    const sliced = limitCount ? matched.slice(0, limitCount) : matched;
    return { data: singleMode === "none" ? sliced : (sliced[0] ?? null), error: null };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (payload: Row | Row[]) => {
      insertRows = Array.isArray(payload) ? payload : [payload];
      return builder;
    },
    update: (patch: Row) => {
      updatePatch = patch;
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    order: () => builder,
    limit: (n: number) => {
      limitCount = n;
      return builder;
    },
    single: () => {
      singleMode = "single";
      return Promise.resolve(run());
    },
    maybeSingle: () => {
      singleMode = "maybe";
      return Promise.resolve(run());
    },
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(run()).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/db.server", () => ({
  getAdminClient: () => ({ from: (table: string) => makeQuery(table) }),
}));

import {
  attachUpdateDraftImage,
  createUpdateDraft,
  finalizeUpdateDraft,
  publishAgentUpdate,
} from "./updates.server";

let uploadDir = "";

beforeAll(() => {
  uploadDir = mkdtempSync(path.join(tmpdir(), "cm-uploads-"));
  process.env["UPLOAD_DIR"] = uploadDir;
});

afterAll(() => {
  delete process.env["UPLOAD_DIR"];
  if (uploadDir) rmSync(uploadDir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  tables["authors"]!.push({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Pankaj Singh",
    slug: "pankaj-singh",
  });
});

async function makeSamplePng() {
  return sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 24, g: 56, b: 120 } },
  })
    .png()
    .toBuffer();
}

describe("Automated 3-step Updates workflow", () => {
  it("runs article → 1600x900 WebP image → mark ready (Off = review queue) with safe retries", async () => {
    const draft = await createUpdateDraft(
      {
        title: "Google rolls out AI Mode updates for marketers",
        excerpt: "Google expanded AI Mode reporting with new query visibility for digital marketers.",
        bodyMarkdown: "## What changed\n\nNew visibility metrics are rolling out globally.",
        sourceName: "Google Search Central",
        sourceUrl: "https://developers.google.com/search/blog/ai-mode-update",
        seo: { title: "Google AI Mode Update", description: "New visibility metrics." },
      },
      "job-1-article",
    );
    expect(draft.status).toBe("draft");
    expect(draft.author).toBe("Pankaj Singh");
    expect(draft.reused).toBe(false);

    // Retry with same idempotency key returns same draftId without duplicating
    const retryDraft = await createUpdateDraft(
      {
        title: "Google rolls out AI Mode updates for marketers",
        excerpt: "Google expanded AI Mode reporting with new query visibility for digital marketers.",
        bodyMarkdown: "## What changed\n\nNew visibility metrics are rolling out globally.",
        sourceName: "Google Search Central",
        sourceUrl: "https://developers.google/search/blog/ai-mode-update",
      },
      "job-1-article",
    );
    expect(retryDraft.draftId).toBe(draft.draftId);
    expect(retryDraft.reused).toBe(true);
    expect(tables["content"]!.length).toBe(1);

    // Duplicate sourceUrl without same key is rejected with 409
    await expect(
      createUpdateDraft({
        title: "Duplicate story",
        excerpt: "Another article trying to use the exact same source URL.",
        bodyMarkdown: "## Duplicate\n\nShould be blocked by duplicate sourceUrl check.",
        sourceName: "Google Search Central",
        sourceUrl: "https://developers.google.com/search/blog/ai-mode-update/",
      }),
    ).rejects.toThrow("already exists");

    // Upload image converts to 1600x900 WebP in Updates folder
    const png = await makeSamplePng();
    const img = await attachUpdateDraftImage({
      draftId: draft.draftId,
      buffer: png,
      fileName: "hero.png",
      altText: "Google AI Mode search interface diagram",
      idempotencyKey: "job-1-image",
    });
    expect(img.width).toBe(1600);
    expect(img.height).toBe(900);
    expect(img.publicUrl.endsWith(".webp")).toBe(true);
    expect(tables["media"]![0]?.["folder"]).toBe("news");

    // Retry image upload returns same mediaId without creating a duplicate media row
    const retryImg = await attachUpdateDraftImage({
      draftId: draft.draftId,
      buffer: png,
      fileName: "hero.png",
      altText: "Google AI Mode search interface diagram",
      idempotencyKey: "job-1-image",
    });
    expect(retryImg.mediaId).toBe(img.mediaId);
    expect(retryImg.reused).toBe(true);
    expect(tables["media"]!.length).toBe(1);

    // Mark ready rejects wrong mediaId
    await expect(
      finalizeUpdateDraft(
        { draftId: draft.draftId, mediaId: "99999999-9999-4999-8999-999999999999" },
        "https://fabric-pro.com",
      ),
    ).rejects.toThrow("does not belong to this draft");

    // Default Auto-publish = Off → Ready for review with admin link
    const ready = await finalizeUpdateDraft(
      { draftId: draft.draftId, mediaId: img.mediaId },
      "https://fabric-pro.com",
    );
    expect(ready.state).toBe("Ready for review");
    expect(ready.status).toBe("draft");
    expect("adminUrl" in ready && ready.adminUrl).toBe(
      `https://fabric-pro.com/admin/content/${draft.draftId}`,
    );

    // Turning Auto-publish On leaves existing review draft in the queue on retry
    tables["site_settings"]!.push({ key: "news_automation", value: { autoPublish: true } });
    const retryReady = await finalizeUpdateDraft(
      { draftId: draft.draftId, mediaId: img.mediaId },
      "https://fabric-pro.com",
    );
    expect(retryReady.state).toBe("Ready for review");
    expect(retryReady.reused).toBe(true);
  });

  it("publishes newly completed Updates when Auto-publish is On and enforces Off on existing endpoint", async () => {
    // Existing endpoint with Auto-publish Off (default) creates a review draft
    const queued = await publishAgentUpdate(
      {
        title: "Meta updates Advantage+ shopping campaigns",
        excerpt: "Meta announced new audience controls for Advantage+ shopping campaigns today.",
        bodyMarkdown: "## Campaign updates\n\nMarketers get finer budget controls.",
        sourceName: "Meta Business",
        sourceUrl: "https://www.facebook.com/business/news/advantage-plus-2026",
      },
      "https://fabric-pro.com",
    );
    expect(queued.state).toBe("Ready for review");
    expect(queued.status).toBe("draft");

    // Turn Auto-publish On → newly completed draft publishes live immediately
    tables["site_settings"]!.push({ key: "news_automation", value: { autoPublish: true } });
    const draft = await createUpdateDraft({
      title: "LinkedIn adds new B2B attribution insights",
      excerpt: "LinkedIn Campaign Manager adds multi-touch revenue attribution for B2B marketers.",
      bodyMarkdown: "## Attribution\n\nB2B teams can now trace pipeline touchpoints.",
      sourceName: "LinkedIn Marketing Blog",
      sourceUrl: "https://www.linkedin.com/business/marketing/blog/attribution-2026",
    });
    const img = await attachUpdateDraftImage({
      draftId: draft.draftId,
      buffer: await makeSamplePng(),
      fileName: "linkedin.png",
      altText: "LinkedIn B2B attribution chart",
    });
    const published = await finalizeUpdateDraft(
      { draftId: draft.draftId, mediaId: img.mediaId },
      "https://fabric-pro.com",
    );
    expect(published.state).toBe("Published");
    expect(published.status).toBe("published");
    expect("liveUrl" in published && published.liveUrl).toBe(
      `https://fabric-pro.com/news/${draft.slug}`,
    );
  });
});