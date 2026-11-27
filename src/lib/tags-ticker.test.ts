import { describe, expect, it } from "vitest";

import {
  buildSingleStepTickerTrack,
  chunkTagsIntoSets,
  clampTickerTipCenter,
  estimateTickerTipWidth,
  orderTagsForDailyTicker,
  TICKER_HOLD_MS,
  TICKER_SET_SIZE,
} from "./tags-ticker";
import type { Tag } from "./types";

function makeTag(id: string, name: string): Tag {
  return { id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), description: null, seo: {} };
}

describe("tags-ticker", () => {
  it("uses 4 visible tags and a 10-second hold duration", () => {
    expect(TICKER_SET_SIZE).toBe(4);
    expect(TICKER_HOLD_MS).toBe(10000);
  });

  it("ranks tags with published articles today ahead of older and unused tags", () => {
    const tags = [
      makeTag("t-unused", "Unused"),
      makeTag("t-old", "Older Topic"),
      makeTag("t-today-low", "Today One"),
      makeTag("t-today-high", "Today Three"),
    ];
    const published = [
      { id: "c1", published_at: "2026-11-27T04:00:00Z" },
      { id: "c2", published_at: "2026-11-27T05:00:00Z" },
      { id: "c3", published_at: "2026-11-27T06:00:00Z" },
      { id: "c4", published_at: "2026-11-20T06:00:00Z" },
      { id: "c-future", published_at: "2026-11-28T06:00:00Z" },
    ];
    const links = [
      { content_id: "c1", tag_id: "t-today-high" },
      { content_id: "c2", tag_id: "t-today-high" },
      { content_id: "c3", tag_id: "t-today-high" },
      { content_id: "c1", tag_id: "t-today-low" },
      { content_id: "c4", tag_id: "t-old" },
      { content_id: "c-future", tag_id: "t-unused" },
    ];

    const ordered = orderTagsForDailyTicker(tags, links, published, {
      now: new Date("2026-11-27T07:00:00Z"),
      timeZone: "UTC",
      rng: () => 0.5,
    });

    expect(ordered.map((t) => t.id)).toEqual([
      "t-today-high",
      "t-today-low",
      "t-old",
      "t-unused",
    ]);
  });

  it("builds a seamless 1-by-1 loop track by appending the first 4 tags when more than 4 exist", () => {
    const tags = Array.from({ length: 6 }, (_, i) => makeTag(`t${i + 1}`, `Tag ${i + 1}`));
    const track = buildSingleStepTickerTrack(tags, 4);
    expect(track.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "t1", "t2", "t3", "t4"]);
  });

  it("leaves the track unchanged when there are 4 or fewer tags", () => {
    const tags = Array.from({ length: 4 }, (_, i) => makeTag(`t${i + 1}`, `Tag ${i + 1}`));
    const track = buildSingleStepTickerTrack(tags, 4);
    expect(track.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("splits tags into sets of 4 and pads the final set when there are more than 4 tags", () => {
    const tags = Array.from({ length: 7 }, (_, i) => makeTag(`t${i + 1}`, `Tag ${i + 1}`));
    const sets = chunkTagsIntoSets(tags, 4);

    expect(sets).toHaveLength(2);
    expect(sets[0]?.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(sets[1]?.map((t) => t.id)).toEqual(["t5", "t6", "t7", "t1"]);
  });

  it("keeps a single set when there are 4 or fewer tags", () => {
    const tags = Array.from({ length: 4 }, (_, i) => makeTag(`t${i + 1}`, `Tag ${i + 1}`));
    const sets = chunkTagsIntoSets(tags, 4);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toHaveLength(4);
  });
});
describe("ticker tag hover tooltip", () => {
  it("estimates a wider tooltip for longer tag names", () => {
    const short = estimateTickerTipWidth("#AI");
    const long = estimateTickerTipWidth("#Generative AI Models");
    expect(short).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(short);
  });

  it("keeps the tooltip centered when it fits inside the ticker strip", () => {
    expect(clampTickerTipCenter(200, 400, 100)).toBe(200);
  });

  it("pushes the tooltip back inside the strip near the left edge", () => {
    expect(clampTickerTipCenter(10, 400, 100)).toBe(50);
  });

  it("pushes the tooltip back inside the strip near the right edge", () => {
    expect(clampTickerTipCenter(395, 400, 100)).toBe(350);
  });

  it("centers a tooltip that is wider than the strip itself", () => {
    expect(clampTickerTipCenter(10, 120, 400)).toBe(60);
  });
});
