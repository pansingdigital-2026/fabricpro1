import type { Tag } from "./types";

export const TICKER_SET_SIZE = 4;
export const TICKER_HOLD_MS = 10000;

export interface PublishedContentRef {
  id: string;
  published_at: string | null;
}

export interface ContentTagLink {
  content_id: string;
  tag_id: string;
}

function formatDay(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Weighted shuffle without replacement: higher weights tend to appear first. */
function weightedShuffle<T>(items: { item: T; weight: number }[], rng: () => number): T[] {
  return items
    .map(({ item, weight }) => {
      const u = Math.max(rng(), 1e-9);
      const w = Math.max(weight, 1);
      return { item, score: Math.pow(u, 1 / w) };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Orders tags for the magazine header ticker:
 * 1) Tags with the most published articles today (weighted random shuffle)
 * 2) Tags with published articles overall (weighted random shuffle)
 * 3) Remaining tags (shuffled)
 */
export function orderTagsForDailyTicker(
  tags: Tag[],
  links: ContentTagLink[],
  published: PublishedContentRef[],
  options: { now?: Date; timeZone?: string; rng?: () => number } = {},
): Tag[] {
  if (tags.length <= 1) return [...tags];

  const now = options.now ?? new Date();
  const tz = options.timeZone || "UTC";
  const rng = options.rng ?? Math.random;
  const todayKey = formatDay(now, tz);
  const nowMs = now.getTime();

  const publishedIds = new Set<string>();
  const todayIds = new Set<string>();

  for (const row of published) {
    if (row.published_at) {
      const pubDate = new Date(row.published_at);
      if (Number.isNaN(pubDate.getTime()) || pubDate.getTime() > nowMs) continue;
      publishedIds.add(row.id);
      if (formatDay(pubDate, tz) === todayKey) {
        todayIds.add(row.id);
      }
    } else {
      publishedIds.add(row.id);
    }
  }

  const todayCounts = new Map<string, number>();
  const totalCounts = new Map<string, number>();

  for (const link of links) {
    if (!publishedIds.has(link.content_id)) continue;
    totalCounts.set(link.tag_id, (totalCounts.get(link.tag_id) ?? 0) + 1);
    if (todayIds.has(link.content_id)) {
      todayCounts.set(link.tag_id, (todayCounts.get(link.tag_id) ?? 0) + 1);
    }
  }

  const todayGroup: { item: Tag; weight: number }[] = [];
  const usedGroup: { item: Tag; weight: number }[] = [];
  const unusedGroup: { item: Tag; weight: number }[] = [];

  for (const tag of tags) {
    const todayCount = todayCounts.get(tag.id) ?? 0;
    const totalCount = totalCounts.get(tag.id) ?? 0;
    if (todayCount > 0) {
      todayGroup.push({ item: tag, weight: todayCount * todayCount });
    } else if (totalCount > 0) {
      usedGroup.push({ item: tag, weight: totalCount });
    } else {
      unusedGroup.push({ item: tag, weight: 1 });
    }
  }

  return [
    ...weightedShuffle(todayGroup, rng),
    ...weightedShuffle(usedGroup, rng),
    ...weightedShuffle(unusedGroup, rng),
  ];
}

/** Splits tags into sets of `setSize`, padding the final set so every slide shows a full set when possible. */
export function chunkTagsIntoSets<T extends { id: string }>(
  tags: T[],
  setSize = TICKER_SET_SIZE,
): T[][] {
  if (tags.length === 0) return [];
  if (tags.length <= setSize) return [tags];

  const sets: T[][] = [];
  for (let i = 0; i < tags.length; i += setSize) {
    const slice = tags.slice(i, i + setSize);
    if (slice.length < setSize) {
      const seen = new Set(slice.map((t) => t.id));
      for (const candidate of tags) {
        if (slice.length >= setSize) break;
        if (!seen.has(candidate.id)) {
          slice.push(candidate);
          seen.add(candidate.id);
        }
      }
    }
    sets.push(slice);
  }
  return sets;
}

/** Builds the track items for a 1-by-1 seamless loop showing `visibleCount` tags at a time. */
export function buildSingleStepTickerTrack<T>(
  tags: T[],
  visibleCount = TICKER_SET_SIZE,
): T[] {
  if (tags.length <= visibleCount) return [...tags];
  return [...tags, ...tags.slice(0, visibleCount)];
}

/** Rough pixel width of the hover tooltip that shows a tag's full name. */
export function estimateTickerTipWidth(label: string): number {
  const textWidth = Math.max(label.trim().length, 1) * 7.2;
  return Math.round(textWidth + 24);
}

/**
 * Keeps a tooltip centered on its tag while staying inside the ticker strip,
 * so long tag names never hang off the edge of the header bar.
 */
export function clampTickerTipCenter(centerX: number, hostWidth: number, tipWidth: number): number {
  if (!Number.isFinite(centerX)) return 0;
  if (hostWidth <= 0 || tipWidth <= 0) return Math.max(0, centerX);
  const half = tipWidth / 2;
  if (tipWidth >= hostWidth) return hostWidth / 2;
  return Math.min(Math.max(centerX, half), hostWidth - half);
}